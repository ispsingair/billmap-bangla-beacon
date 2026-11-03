INSERT INTO public.user_roles(user_id,role) SELECT id,'admin'::public.app_role FROM auth.users WHERE created_at<'2026-11-03 03:21:00+00' ON CONFLICT DO NOTHING;
ALTER TABLE public.customers ADD CONSTRAINT customer_billing_values CHECK(monthly_bill>=0 AND lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180);
CREATE INDEX zones_collector ON public.zones(collector_id);
CREATE FUNCTION public.validate_customer_billing() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF extract(day from NEW.billing_start_month)<>1 THEN RAISE EXCEPTION 'Billing start must be first day of month'; END IF; RETURN NEW; END $$;
CREATE TRIGGER validate_customer_billing BEFORE INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.validate_customer_billing();