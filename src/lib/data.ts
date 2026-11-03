import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { customerStatus, todayISO, type BillStatus } from "./billing";
import { billSummary, type MonthlyBill } from './monthly';

export type Collector = Tables<"collectors">;
export type Zone = Omit<Tables<"zones">, "polygon"> & { polygon: [number, number][] };
export type Customer = Tables<"customers"> & { status: BillStatus; bills: MonthlyBill[] };
export type Payment = Tables<"payments">;

export type AppData = {
  collectors: Collector[];
  zones: Zone[];
  customers: Customer[];
  todayPayments: Payment[];
  bills: MonthlyBill[];
  payments: Payment[];
  role: 'admin' | 'collector' | null;
};

async function fetchAll(): Promise<AppData> {
  const today = todayISO();
  const roles = await supabase.from('user_roles').select('*');
  if(roles.error) throw roles.error;
  const { data: identity } = await supabase.auth.getUser();
  const role = roles.data?.find(r=>r.user_id===identity.user?.id)?.role ?? null;
  if(role) {const sync=await supabase.rpc('sync_billing');if(sync.error)throw sync.error;}
  const [c, z, cu, p, b] = await Promise.all([
    supabase.from("collectors").select("*").order("name"),
    supabase.from("zones").select("*").order("name"),
    supabase.from("customers").select("*").order("name"),
    supabase.from("payments").select("*").order('paid_on',{ascending:false}),
    supabase.from('bill_balances').select('*').order('billing_month'),
  ]);
  const err = c.error || z.error || cu.error || p.error || b.error;
  if (err) throw err;
  const bills = (b.data ?? []).filter(x=>x.id&&x.customer_id&&x.billing_month&&x.due_date).map(x=>({...x,amount:Number(x.amount),opening_paid:Number(x.opening_paid),outstanding:Number(x.outstanding)})) as MonthlyBill[];
  return {
    collectors: c.data ?? [],
    zones: (z.data ?? []).map((zone) => ({
      ...zone,
      polygon: Array.isArray(zone.polygon) ? (zone.polygon as [number, number][]) : [],
    })),
    customers: (cu.data ?? []).map((x) => {const monthly=bills.filter(b=>b.customer_id===x.id);const summary=billSummary(monthly,today);return {...x,bills:monthly,due_amount:summary.outstanding,due_date:summary.due_date,status:summary.status};}),
    todayPayments: (p.data ?? []).filter(p=>p.paid_on===today&&!p.voided_at),
    payments:p.data ?? [], bills, role,
  };
}

export const appDataQuery = queryOptions({ queryKey: ["app-data"], queryFn: fetchAll });

export function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["app-data"] });
}
