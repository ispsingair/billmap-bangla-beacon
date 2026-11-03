CREATE OR REPLACE FUNCTION public.mark_months_paid(p_customer uuid, p_allocations jsonb, p_method text, p_date date, p_receipt text, p_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE entry jsonb; balance numeric; pid uuid; payment_customer uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
  IF p_method IS NULL OR p_method NOT IN ('cash','bkash','nagad','rocket','bank') OR p_date IS NULL OR p_date > timezone('Asia/Dhaka',now())::date OR p_key IS NULL THEN RAISE EXCEPTION 'Invalid payment details'; END IF;
  PERFORM 1 FROM public.customers WHERE id=p_customer FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
  SELECT id, customer_id INTO pid, payment_customer FROM public.payments WHERE collection_key=p_key;
  IF pid IS NOT NULL THEN
    IF payment_customer<>p_customer THEN RAISE EXCEPTION 'Payment key belongs to another customer'; END IF;
    RETURN pid;
  END IF;
  IF p_allocations IS NULL OR jsonb_typeof(p_allocations)<>'array' THEN RAISE EXCEPTION 'Select billing months'; END IF;
  IF jsonb_array_length(p_allocations)=0 OR jsonb_array_length(p_allocations)>120 THEN RAISE EXCEPTION 'Select billing months'; END IF;
  FOR entry IN SELECT * FROM jsonb_array_elements(p_allocations) LOOP
    SELECT outstanding INTO balance FROM public.bill_balances WHERE id=(entry->>'bill_id')::uuid AND customer_id=p_customer;
    IF balance IS NULL OR balance<=0 OR (entry->>'amount') IS NULL OR (entry->>'amount')::numeric IS DISTINCT FROM balance THEN
      RAISE EXCEPTION 'Balance changed or month is already paid; refresh and try again';
    END IF;
  END LOOP;
  RETURN public.collect_months(p_customer,p_allocations,p_method,p_date,p_receipt,p_key);
END $$;
REVOKE ALL ON FUNCTION public.mark_months_paid(uuid,jsonb,text,date,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_months_paid(uuid,jsonb,text,date,text,uuid) TO authenticated;
COMMENT ON FUNCTION public.mark_months_paid(uuid,jsonb,text,date,text,uuid) IS 'Admin-only full remaining-balance settlement of explicitly selected monthly bills via existing transactional collection and payment history.';