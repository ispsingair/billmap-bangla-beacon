import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { customerStatus, todayISO, type BillStatus } from "./billing";

export type Collector = Tables<"collectors">;
export type Zone = Omit<Tables<"zones">, "polygon"> & { polygon: [number, number][] };
export type Customer = Tables<"customers"> & { status: BillStatus };
export type Payment = Tables<"payments">;

export type AppData = {
  collectors: Collector[];
  zones: Zone[];
  customers: Customer[];
  todayPayments: Payment[];
};

async function fetchAll(): Promise<AppData> {
  const today = todayISO();
  const [c, z, cu, p] = await Promise.all([
    supabase.from("collectors").select("*").order("name"),
    supabase.from("zones").select("*").order("name"),
    supabase.from("customers").select("*").order("name"),
    supabase.from("payments").select("*").eq("paid_on", today),
  ]);
  const err = c.error || z.error || cu.error || p.error;
  if (err) throw err;
  return {
    collectors: c.data ?? [],
    zones: (z.data ?? []).map((zone) => ({
      ...zone,
      polygon: Array.isArray(zone.polygon) ? (zone.polygon as [number, number][]) : [],
    })),
    customers: (cu.data ?? []).map((x) => ({
      ...x,
      status: customerStatus(Number(x.due_amount), x.due_date, today),
    })),
    todayPayments: p.data ?? [],
  };
}

export const appDataQuery = queryOptions({ queryKey: ["app-data"], queryFn: fetchAll });

export function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["app-data"] });
}
