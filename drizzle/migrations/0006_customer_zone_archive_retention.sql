ALTER TABLE public.customers ADD COLUMN archived_at timestamptz;
ALTER TABLE public.zones ADD COLUMN archived_at timestamptz;
CREATE INDEX customers_archived_at_idx ON public.customers(archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX zones_archived_at_idx ON public.zones(archived_at) WHERE archived_at IS NOT NULL;
REVOKE DELETE ON public.customers, public.zones FROM authenticated;

CREATE OR REPLACE FUNCTION public.can_access_customer(cid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT public.is_admin() OR EXISTS(SELECT 1 FROM public.customers c JOIN public.zones z ON z.id=c.zone_id JOIN public.user_roles r ON r.collector_id=z.collector_id WHERE c.id=cid AND c.archived_at IS NULL AND z.archived_at IS NULL AND r.user_id=auth.uid() AND r.role='collector'); $$;
DROP POLICY zones_read ON public.zones;
CREATE POLICY zones_read ON public.zones FOR SELECT TO authenticated USING (public.is_admin() OR (archived_at IS NULL AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.collector_id=zones.collector_id AND r.role='collector')));

CREATE FUNCTION public.set_record_archived(p_kind text,p_id uuid,p_archive boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
 IF p_archive IS NULL THEN RAISE EXCEPTION 'Archive action required'; END IF;
 IF p_kind='customers' THEN UPDATE public.customers SET archived_at=CASE WHEN p_archive THEN coalesce(archived_at,now()) ELSE NULL END WHERE id=p_id;
 ELSIF p_kind='zones' THEN UPDATE public.zones SET archived_at=CASE WHEN p_archive THEN coalesce(archived_at,now()) ELSE NULL END WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Invalid archive kind'; END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.set_record_archived(text,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_record_archived(text,uuid,boolean) TO authenticated;

CREATE FUNCTION public.validate_archive_change() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN IF NEW.archived_at IS NOT NULL THEN RAISE EXCEPTION 'New records must be active'; END IF;
 ELSIF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
  IF NEW.archived_at IS NOT NULL THEN NEW.archived_at:=coalesce(OLD.archived_at,now()); END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_customer_archive BEFORE INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.validate_archive_change();
CREATE TRIGGER validate_zone_archive BEFORE INSERT OR UPDATE ON public.zones FOR EACH ROW EXECUTE FUNCTION public.validate_archive_change();

CREATE OR REPLACE FUNCTION public.generate_monthly_bills() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer; BEGIN
INSERT INTO public.monthly_bills(customer_id,billing_month,amount,due_date) SELECT c.id,m::date,c.monthly_bill,(m+(c.billing_day-1)*interval '1 day')::date FROM public.customers c CROSS JOIN LATERAL generate_series(c.billing_start_month,date_trunc('month',timezone('Asia/Dhaka',now())),interval '1 month') m WHERE c.archived_at IS NULL AND c.recurring_enabled AND c.monthly_bill>0 ON CONFLICT(customer_id,billing_month) DO NOTHING;
GET DIAGNOSTICS n=ROW_COUNT; RETURN n; END; $$;

CREATE OR REPLACE FUNCTION public.assign_customer_zone() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ids uuid[]; BEGIN
 IF TG_OP='UPDATE' AND NEW.lat=OLD.lat AND NEW.lng=OLD.lng AND NEW.zone_id IS NOT DISTINCT FROM OLD.zone_id THEN RETURN NEW; END IF;
 IF NEW.archived_at IS NOT NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW.zone_id IS NULL AND OLD.zone_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.zones WHERE id=OLD.zone_id AND archived_at<=now()-interval '60 days') THEN RETURN NEW; END IF;
 SELECT array_agg(id) INTO ids FROM public.zones WHERE archived_at IS NULL AND public.zone_contains(polygon,NEW.lat,NEW.lng);
 IF cardinality(ids)=1 THEN NEW.zone_id:=ids[1]; ELSIF NEW.zone_id IS NOT NULL AND NOT coalesce(NEW.zone_id=ANY(ids),false) THEN RAISE EXCEPTION 'Selected active zone does not contain customer coordinates'; ELSIF cardinality(ids)>1 AND NEW.zone_id IS NULL THEN RAISE EXCEPTION 'Coordinates overlap multiple zones; select a containing zone'; END IF; RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.reconcile_zone_customers() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; ids uuid[]; target uuid; BEGIN
 IF NEW.archived_at IS NOT NULL THEN RETURN NEW; END IF;
 FOR c IN SELECT * FROM public.customers WHERE archived_at IS NULL AND (zone_id IS NULL OR EXISTS(SELECT 1 FROM public.zones WHERE id=zone_id AND archived_at IS NULL)) LOOP
 SELECT array_agg(id) INTO ids FROM public.zones WHERE archived_at IS NULL AND public.zone_contains(polygon,c.lat,c.lng);
 target:=CASE WHEN cardinality(ids)=1 THEN ids[1] WHEN c.zone_id=ANY(ids) THEN c.zone_id ELSE NULL END;
 IF cardinality(ids)>1 AND target IS NULL THEN CONTINUE; END IF;
 IF target IS DISTINCT FROM c.zone_id THEN UPDATE public.customers SET zone_id=target WHERE id=c.id; END IF;
 END LOOP; RETURN NEW; END; $$;

CREATE FUNCTION public.archive_purge_authorized() RETURNS boolean LANGUAGE sql STABLE SET search_path=public AS $$
SELECT (public.is_admin() OR (auth.uid() IS NULL AND session_user='postgres' AND coalesce(current_setting('role',true),'none')='none')) AND coalesce(current_setting('app.archive_purge',true),'')='on'; $$;
REVOKE ALL ON FUNCTION public.archive_purge_authorized() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.archive_purge_authorized() TO authenticated;
CREATE FUNCTION public.guard_archive_delete() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN IF NOT public.archive_purge_authorized() OR OLD.archived_at IS NULL OR OLD.archived_at>now()-interval '60 days' THEN RAISE EXCEPTION 'Archive retention has not elapsed or purge is unauthorized' USING ERRCODE='42501'; END IF; RETURN OLD; END; $$;
CREATE TRIGGER guard_customer_delete BEFORE DELETE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.guard_archive_delete();
CREATE TRIGGER guard_zone_delete BEFORE DELETE ON public.zones FOR EACH ROW EXECUTE FUNCTION public.guard_archive_delete();

CREATE OR REPLACE FUNCTION public.validate_monthly_bill() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE paid numeric; BEGIN
IF TG_OP='DELETE' THEN
 IF public.archive_purge_authorized() AND EXISTS(SELECT 1 FROM public.customers WHERE id=OLD.customer_id AND archived_at<=now()-interval '60 days') THEN RETURN OLD; END IF;
 IF EXISTS(SELECT 1 FROM public.payment_allocations WHERE bill_id=OLD.id) OR OLD.opening_paid>0 THEN RAISE EXCEPTION 'Paid bills cannot be deleted'; END IF; RETURN OLD;
END IF;
PERFORM 1 FROM public.customers WHERE id=NEW.customer_id AND archived_at IS NULL FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Customer is archived or missing'; END IF;
IF TG_OP='INSERT' AND NEW.opening_paid<>0 AND auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Record a collection instead'; END IF;
IF TG_OP='UPDATE' THEN
 IF auth.uid() IS NOT NULL AND (NEW.customer_id<>OLD.customer_id OR NEW.billing_month<>OLD.billing_month OR NEW.opening_paid<>OLD.opening_paid OR NEW.legacy_import<>OLD.legacy_import) THEN RAISE EXCEPTION 'Bill identity and historical credit cannot change'; END IF;
 SELECT coalesce(sum(a.amount),0)+OLD.opening_paid INTO paid FROM public.payment_allocations a JOIN public.payments p ON p.id=a.payment_id WHERE a.bill_id=OLD.id AND p.voided_at IS NULL;
 IF NEW.amount<paid THEN RAISE EXCEPTION 'Amount cannot be below payments'; END IF;
END IF; RETURN NEW; END; $$;

CREATE FUNCTION public.guard_archived_collection() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN PERFORM 1 FROM public.customers WHERE id=NEW.customer_id AND archived_at IS NULL FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Archived customers cannot receive collections'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER guard_archived_collection BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.guard_archived_collection();

CREATE FUNCTION public.purge_archived_records() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; z record; nc integer:=0; nz integer:=0; previous_flag text;
BEGIN
 IF NOT public.is_admin() AND NOT (auth.uid() IS NULL AND session_user='postgres' AND coalesce(current_setting('role',true),'none')='none') THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(600560);
 previous_flag:=coalesce(current_setting('app.archive_purge',true),'');
 PERFORM set_config('app.archive_purge','on',true);
 FOR c IN SELECT id FROM public.customers WHERE archived_at<=now()-interval '60 days' ORDER BY archived_at LIMIT 1000 FOR UPDATE LOOP
  DELETE FROM public.payment_allocations WHERE bill_id IN (SELECT id FROM public.monthly_bills WHERE customer_id=c.id) OR payment_id IN (SELECT id FROM public.payments WHERE customer_id=c.id);
  DELETE FROM public.monthly_bills WHERE customer_id=c.id;
  DELETE FROM public.payments WHERE customer_id=c.id;
  DELETE FROM public.customers WHERE id=c.id;
  nc:=nc+1;
 END LOOP;
 FOR z IN SELECT id FROM public.zones WHERE archived_at<=now()-interval '60 days' ORDER BY archived_at LIMIT 1000 FOR UPDATE LOOP
  UPDATE public.customers SET zone_id=NULL WHERE zone_id=z.id;
  DELETE FROM public.zones WHERE id=z.id;
  nz:=nz+1;
 END LOOP;
 PERFORM set_config('app.archive_purge',previous_flag,true);
 RETURN jsonb_build_object('customers',nc,'zones',nz);
END; $$;
REVOKE ALL ON FUNCTION public.purge_archived_records() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.purge_archived_records() TO authenticated;
COMMENT ON FUNCTION public.purge_archived_records() IS 'Admin or privileged postgres scheduler only. Permanently removes expired 60-day archives and financial dependencies, up to 1000 of each kind per run.';