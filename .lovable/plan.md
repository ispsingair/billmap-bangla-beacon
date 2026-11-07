# Controlled one-time reset — review before execution

## Current status
- Inspected HEAD: `ff5351d750d5217013736b6c225b7c92c2d1e3bc`.
- The previous reset migration was rejected and was not applied. No data deletion has executed.
- Current counts: customers **42**, zones **2**, monthly bills **83**, payments **45**, payment allocations **13**. These are inspection counts, not deletion counts.
- Preserve collectors **4**, staff role assignments **2**, auth users **2**, all authentication records and unrelated settings.
- Existing regression suite: **30 passing tests** before changes. Production build/typecheck not yet verified.
- Monthly billing schedule is active. Archive purge schedule is **not configured** yet.

## Revised safety approach
1. Apply the schema-only preparation below after review. It creates a durable one-use ledger and a privileged, security-invoker operation; it does not delete or alter customer data.
2. Execute the reset separately, only after explicit approval. A permanent ledger entry is written in the same transaction as deletion. Repeated or concurrent invocation fails before deletion, even if the function remains installed.
3. Recheck every foreign key in both directions using table identities and full definitions, plus trigger definitions. Abort on added or changed dependencies, cross-customer allocations, missing parents, or changed preserved rows.
4. Lock the target tables. Delete allocations, monthly bills, payments, customers, then zones. No `TRUNCATE`, cascaded reset, dynamic deletion, or auth/collector deletion.
5. Temporarily suspend only the three inspected retention/paid-bill delete guards inside the locked transaction; restore them before success. Any exception rolls back all deletions, guard changes and the ledger entry.
6. Verify returned deletion counts and empty target tables; retire the function with a separate schema-only migration after success. Keep the ledger permanently to prevent accidental reinstallation from permitting a second reset.

## Dependency classification
- `monthly_bills.customer_id → customers.id`: exclusively customer-owned.
- `payments.customer_id → customers.id`: exclusively customer-owned; its collector link does not make collectors payment-owned.
- `payment_allocations.bill_id → monthly_bills.id` and `payment_id → payments.id`: customer-owned only when both parents exist and belong to the same customer. Inspection found **0 mixed allocations**.
- `customers.zone_id → zones.id`: customer association; delete customers first.
- `zones.collector_id → collectors.id` and `payments.collector_id → collectors.id`: outgoing references to preserved collectors; never delete collectors.
- No other incoming dependencies were found. `bill_balances` is a derived view, not a separate row store.
- Inspected triggers: customer zone assignment, archive guard, archive validation, billing validation; monthly-bill validation; payment archive guard and last-payment update; zone archive guard, archive validation, polygon validation and customer reconciliation. No allocation triggers exist. Only the three deletion guards need temporary suspension.

## Proposed preparation migration (not applied)
```sql
CREATE TABLE IF NOT EXISTS public.one_time_data_operations (
  operation_key text PRIMARY KEY,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  deleted_counts jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT ALL ON public.one_time_data_operations TO service_role;
REVOKE ALL ON public.one_time_data_operations FROM anon, authenticated;
ALTER TABLE public.one_time_data_operations ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.one_time_data_operations IS
  'Permanent consumed-operation ledger. Never clear to repeat a customer reset.';

CREATE FUNCTION public.reset_customer_zones_once() RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  n integer;
  before_preserved jsonb;
  after_preserved jsonb;
BEGIN
  IF session_user <> 'postgres' OR current_user <> 'postgres'
     OR auth.uid() IS NOT NULL
     OR coalesce(current_setting('role',true),'none') <> 'none' THEN
    RAISE EXCEPTION 'Privileged database operator required';
  END IF;
  LOCK TABLE public.one_time_data_operations IN EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM public.one_time_data_operations
             WHERE operation_key='customer-zone-reset-2026-11-07') THEN
    RAISE EXCEPTION 'One-time reset already consumed';
  END IF;
  LOCK TABLE public.collectors, public.user_roles IN SHARE MODE;
  LOCK TABLE public.customers, public.zones, public.monthly_bills,
             public.payments, public.payment_allocations IN ACCESS EXCLUSIVE MODE;

  -- Exact bidirectional FK graph; added, removed or changed edges abort.
  IF EXISTS (
    WITH expected(child,parent,definition) AS (VALUES
      ('public.customers'::regclass,'public.zones'::regclass,
       'FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE SET NULL'),
      ('public.zones'::regclass,'public.collectors'::regclass,
       'FOREIGN KEY (collector_id) REFERENCES collectors(id) ON DELETE SET NULL'),
      ('public.monthly_bills'::regclass,'public.customers'::regclass,
       'FOREIGN KEY (customer_id) REFERENCES customers(id)'),
      ('public.payments'::regclass,'public.customers'::regclass,
       'FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE'),
      ('public.payments'::regclass,'public.collectors'::regclass,
       'FOREIGN KEY (collector_id) REFERENCES collectors(id) ON DELETE SET NULL'),
      ('public.payment_allocations'::regclass,'public.monthly_bills'::regclass,
       'FOREIGN KEY (bill_id) REFERENCES monthly_bills(id)'),
      ('public.payment_allocations'::regclass,'public.payments'::regclass,
       'FOREIGN KEY (payment_id) REFERENCES payments(id)')
    ), actual AS (
      SELECT conrelid child,confrelid parent,pg_get_constraintdef(oid) definition
      FROM pg_constraint WHERE contype='f' AND (
        conrelid IN ('public.customers'::regclass,'public.zones'::regclass,
                    'public.monthly_bills'::regclass,'public.payments'::regclass,
                    'public.payment_allocations'::regclass)
        OR confrelid IN ('public.customers'::regclass,'public.zones'::regclass,
                        'public.monthly_bills'::regclass,'public.payments'::regclass,
                        'public.payment_allocations'::regclass))
    )
    SELECT 1 FROM (
      (SELECT * FROM actual EXCEPT SELECT * FROM expected)
      UNION ALL
      (SELECT * FROM expected EXCEPT SELECT * FROM actual)
    ) difference
  ) THEN RAISE EXCEPTION 'FK graph changed or ambiguous; reset stopped'; END IF;

  IF (SELECT md5(string_agg(
       t.tgrelid::regclass::text||':'||t.tgname::text||':'||t.tgenabled::text
       ||':'||pg_get_triggerdef(t.oid)||':'||pg_get_functiondef(t.tgfoid),
       E'\n' ORDER BY t.tgrelid::regclass::text,t.tgname))
      FROM pg_trigger t WHERE NOT t.tgisinternal
      AND t.tgrelid IN ('public.customers'::regclass,'public.zones'::regclass,
                       'public.monthly_bills'::regclass,'public.payments'::regclass,
                       'public.payment_allocations'::regclass))
     IS DISTINCT FROM '79d7ba2944426b0c3f0665af5b0ea7f0' THEN
    RAISE EXCEPTION 'Inspected triggers changed; reset stopped';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payment_allocations a
    LEFT JOIN public.payments p ON p.id=a.payment_id
    LEFT JOIN public.monthly_bills b ON b.id=a.bill_id
    LEFT JOIN public.customers pc ON pc.id=p.customer_id
    LEFT JOIN public.customers bc ON bc.id=b.customer_id
    WHERE p.id IS NULL OR b.id IS NULL OR pc.id IS NULL OR bc.id IS NULL
       OR p.customer_id IS DISTINCT FROM b.customer_id
  ) OR EXISTS (
    SELECT 1 FROM public.monthly_bills b LEFT JOIN public.customers c ON c.id=b.customer_id
    WHERE c.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.payments p LEFT JOIN public.customers c ON c.id=p.customer_id
    WHERE c.id IS NULL
  ) THEN RAISE EXCEPTION 'Mixed ownership or missing customer dependency'; END IF;

  SELECT jsonb_build_object(
    'collectors',(SELECT md5(coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id)::text,''))
                  FROM public.collectors c),
    'user_roles',(SELECT md5(coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.user_id)::text,''))
                  FROM public.user_roles r),
    'auth_users',(SELECT md5(coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.id)::text,''))
                  FROM auth.users u)) INTO before_preserved;

  INSERT INTO public.one_time_data_operations(operation_key)
  VALUES ('customer-zone-reset-2026-11-07');
  ALTER TABLE public.customers DISABLE TRIGGER guard_customer_delete;
  ALTER TABLE public.zones DISABLE TRIGGER guard_zone_delete;
  ALTER TABLE public.monthly_bills DISABLE TRIGGER validate_monthly_bill;

  DELETE FROM public.payment_allocations a
  USING public.payments p, public.monthly_bills b
  WHERE a.payment_id=p.id AND a.bill_id=b.id AND p.customer_id=b.customer_id;
  GET DIAGNOSTICS n=ROW_COUNT;
  result:=result||jsonb_build_object('payment_allocations',n);
  DELETE FROM public.monthly_bills b USING public.customers c WHERE b.customer_id=c.id;
  GET DIAGNOSTICS n=ROW_COUNT;
  result:=result||jsonb_build_object('monthly_bills',n);
  DELETE FROM public.payments p USING public.customers c WHERE p.customer_id=c.id;
  GET DIAGNOSTICS n=ROW_COUNT;
  result:=result||jsonb_build_object('payments',n);
  DELETE FROM public.customers WHERE id IS NOT NULL;
  GET DIAGNOSTICS n=ROW_COUNT;
  result:=result||jsonb_build_object('customers',n);
  DELETE FROM public.zones WHERE id IS NOT NULL;
  GET DIAGNOSTICS n=ROW_COUNT;
  result:=result||jsonb_build_object('zones',n);

  ALTER TABLE public.customers ENABLE TRIGGER guard_customer_delete;
  ALTER TABLE public.zones ENABLE TRIGGER guard_zone_delete;
  ALTER TABLE public.monthly_bills ENABLE TRIGGER validate_monthly_bill;
  SELECT jsonb_build_object(
    'collectors',(SELECT md5(coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id)::text,''))
                  FROM public.collectors c),
    'user_roles',(SELECT md5(coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.user_id)::text,''))
                  FROM public.user_roles r),
    'auth_users',(SELECT md5(coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.id)::text,''))
                  FROM auth.users u)) INTO after_preserved;
  IF before_preserved IS DISTINCT FROM after_preserved THEN
    RAISE EXCEPTION 'Preserved rows changed; reset rolled back';
  END IF;
  UPDATE public.one_time_data_operations SET deleted_counts=result
  WHERE operation_key='customer-zone-reset-2026-11-07';
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.reset_customer_zones_once()
FROM PUBLIC, anon, authenticated, service_role;
```

## Subsequent archive work
After reviewed reset preparation and separately approved execution: finish admin Archive/Restore and Archived view; separate active records for all existing map/selectors; retain financial history until expiry; configure and verify a daily SQL-only purge; add archive and database regression checks. Do not publish. Daily purge means eligible deletion may be delayed up to 24 hours; verify database scheduler authorization instead of relying on app publication.

## Review boundary
This proposal is for review only. No deletion or migration will execute in this turn. The trigger fingerprint was read from the live database; any later definition or enabled-state change will stop execution. Approval permits preparing the migration; the destructive operation remains a separate explicitly approved step.