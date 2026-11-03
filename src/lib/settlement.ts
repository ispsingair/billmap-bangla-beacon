import type { MonthlyBill } from './monthly';
import { supabase } from '@/integrations/supabase/client';

export function selectedSettlement(bills: MonthlyBill[], months: string[]) {
  if (!months.length) throw new Error('Select a billing month');
  return bills.filter(b => months.includes(b.billing_month) && b.outstanding > 0)
    .map(b => ({ bill_id: b.id, amount: b.outstanding }));
}

export async function markMonthsPaid(customerId: string, bills: MonthlyBill[], months: string[], details: { method: string; date: string; receipt: string; key: string }) {
  const allocations = selectedSettlement(bills, months);
  if (!allocations.length) throw new Error('Selected months are already paid');
  const result = await supabase.rpc('mark_months_paid', {
    p_customer: customerId, p_allocations: allocations, p_method: details.method,
    p_date: details.date, p_receipt: details.receipt.trim(), p_key: details.key,
  });
  if (result.error) throw result.error;
  return result.data;
}