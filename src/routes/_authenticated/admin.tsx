import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { appDataQuery, useRefresh, type Collector, type Customer, type Zone } from "@/lib/data";
import { formatBDT, todayISO, type BillStatus } from "@/lib/billing";
import { filterCustomers, type CustomerFilters } from "@/lib/monthly";
import { MonthSelection } from "@/components/MonthSelection";
import { BillManager } from "@/components/BillManager";
import { StaffSettings } from "@/components/StaffSettings";
import { CollectDialog } from "@/components/CollectDialog";
import { MarkPaidDialog } from "@/components/MarkPaidDialog";
import { containingZones, validPolygon } from "@/lib/zones";
const ZoneDrawing = lazy(()=>import('@/components/ZoneDrawing'));

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — NetCollect" },
      { name: "description", content: "Manage customers, collectors and zones." },
      { property: "og:title", content: "Admin — NetCollect" },
      { property: "og:description", content: "Manage customers, collectors and zones." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(appDataQuery),
  component: AdminPage,
});

type FieldDef = { key: string; label: string; type?: "text" | "number" | "date" | "color" | "select"; options?: { value: string; label: string }[]; full?: boolean; hint?: string };
type Table = "customers" | "collectors" | "zones";

function AdminPage() {
  const { data } = useSuspenseQuery(appDataQuery);
  const refresh = useRefresh();
  const [filters,setFilters]=useState<CustomerFilters>({search:'',zone:'all',collector:'all',status:'all',due:'all',months:[],sort:'name'});
  const [billCustomer,setBillCustomer]=useState<string|null>(null);
  const [collectCustomer,setCollectCustomer]=useState<string|null>(null);
  const [settlement,setSettlement]=useState<{customer:string;months:string[]}|null>(null);
  const filtered=filterCustomers(data.customers,data.bills,data.zones,filters);
  const change=(key:keyof CustomerFilters,value:string|string[])=>setFilters(f=>({...f,[key]:value}));
  const [edit, setEdit] = useState<{ table: Table; row: Record<string, string> | null } | null>(null);

  const zoneOpts = [{ value: "", label: "— None —" }, ...data.zones.map((z) => ({ value: z.id, label: z.name }))];
  const colOpts = [{ value: "", label: "— Unassigned —" }, ...data.collectors.map((c) => ({ value: c.id, label: c.name }))];
  const zoneName = (id: string | null) => data.zones.find((z) => z.id === id)?.name ?? "—";
  const colName = (id: string | null) => data.collectors.find((c) => c.id === id)?.name ?? "—";

  const fields: Record<Table, FieldDef[]> = {
    customers: [
      { key: "name", label: "Name", full: true },
      { key: "phone", label: "Phone" },
      { key: "zone_id", label: "Zone", type: "select", options: zoneOpts },
      { key: "address", label: "Address", full: true },
      { key: "lat", label: "Latitude", type: "number" },
      { key: "lng", label: "Longitude", type: "number" },
      { key: "monthly_bill", label: "Monthly bill (৳)", type: "number" },
      { key: "billing_day", label: "Monthly due day (1–28)", type: "number" },
      { key: "billing_start_month", label: "Billing start (first day)", type: "date" },
      { key: "recurring_enabled", label: "Recurring bills", type: "select", options:[{value:'true',label:'Enabled'},{value:'false',label:'Paused'}] },
    ],
    collectors: [
      { key: "name", label: "Name", full: true },
      { key: "phone", label: "Phone" },
      { key: "color", label: "Route colour", type: "color" },
    ],
    zones: [
      { key: "name", label: "Name" },
      { key: "color", label: "Colour", type: "color" },
      { key: "collector_id", label: "Collector", type: "select", options: colOpts, full: true },
      { key: "polygon", label: "Zone boundary", full: true },
    ],
  };

  function toForm(table: Table, row: Customer | Collector | Zone | null): Record<string, string> | null {
    if (!row) return null;
    const out: Record<string, string> = { id: row.id };
    for (const f of fields[table]) {
      const v = (row as Record<string, unknown>)[f.key];
      out[f.key] = f.key === "polygon" ? (v as [number, number][]).map((p) => p.join(",")).join("; ") : v == null ? "" : String(v);
    }
    return out;
  }

  async function remove(table: Table, id: string, label: string) {
    if (!confirm(`Delete ${label}?`)) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return void toast.error(error.message);
    toast.success("Deleted");
    refresh();
  }

  const header = (table: Table, label: string) => (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-semibold">{label}</h2>
      <Button size="sm" onClick={() => setEdit({ table, row: null })}><Plus /> Add</Button>
    </div>
  );
  const actions = (table: Table, row: Customer | Collector | Zone, label: string) => (
    <div className="flex shrink-0 gap-1">
      <Button size="icon" variant="ghost" onClick={() => setEdit({ table, row: toForm(table, row) })}><Pencil /></Button>
      <Button size="icon" variant="ghost" onClick={() => remove(table, row.id, label)}><Trash2 /></Button>
    </div>
  );

  if(data.role!=="admin")return <div className="p-6"><h1 className="font-bold">Admin access required</h1><Button asChild variant="outline"><Link to="/">Back to map</Link></Button></div>;
  return (
    <div className="min-h-dvh bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-3 py-2">
        <Button variant="ghost" size="icon" asChild><Link to="/"><ArrowLeft /></Link></Button>
        <h1 className="font-bold">Admin</h1>
      </header>
      <div className="mx-auto max-w-3xl p-3">
        <Tabs defaultValue="customers">
          <TabsList className="w-full">
            <TabsTrigger value="customers" className="flex-1">Customers ({data.customers.length})</TabsTrigger>
            <TabsTrigger value="collectors" className="flex-1">Collectors</TabsTrigger>
            <TabsTrigger value="zones" className="flex-1">Zones</TabsTrigger>
            <TabsTrigger value="payments" className="flex-1">Payments</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">Staff</TabsTrigger>
          </TabsList>
          <TabsContent value="customers" className="mt-4">
            {header("customers", "Customers")}
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Input className="col-span-full" aria-label="Search customers" placeholder="Name, phone or address" value={filters.search} onChange={e=>change('search',e.target.value)} />
              {([
                ['zone','Zone',[{value:'all',label:'All zones'},...zoneOpts.filter(x=>x.value)]],
                ['collector','Collector',[{value:'all',label:'All collectors'},...colOpts.filter(x=>x.value)]],
                ['status','Payment status',[{value:'all',label:'All statuses'},{value:'paid',label:'Paid'},{value:'unpaid',label:'Due'},{value:'overdue',label:'Overdue'}]],
                ['due','Due amount',[{value:'all',label:'All amounts'},{value:'none',label:'No due'},{value:'has',label:'Has due'}]],
                ['sort','Sort',[{value:'name',label:'Name'},{value:'due',label:'Due amount'},{value:'date',label:'Due date'},{value:'recent',label:'Recently added'}]],
              ] as [keyof CustomerFilters,string,{value:string;label:string}[]][]).map(([key,label,options])=><div key={key}><Label>{label}</Label><Select value={String(filters[key])} onValueChange={v=>change(key,v)}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>)}
              <MonthSelection months={[...new Set(data.bills.map(b=>b.billing_month))].sort().reverse()} selected={filters.months} onChange={v=>change('months',v)} />
            </div>
            <p className="mb-2 text-xs text-muted-foreground">{filtered.length} customers</p>
            <ul className="divide-y rounded-xl border bg-card">
              {filtered.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="truncate font-medium">{c.name}</span><StatusBadge status={c.status} /></div>
                    <div className="truncate text-xs text-muted-foreground">{zoneName(c.zone_id)} · <span className="num">{c.phone}</span> · Due <span className="num">{formatBDT(c.outstanding)}</span></div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1"><Button size="sm" variant="outline" onClick={()=>setBillCustomer(c.id)}>View</Button><Button size="sm" variant="collect" disabled={!filters.months.length || c.outstanding<=0} onClick={()=>setSettlement({customer:c.id,months:[...filters.months]})}>Mark selected months Paid</Button><Button size="sm" variant="collect" disabled={c.outstanding<=0} onClick={()=>setCollectCustomer(c.id)}>Collect</Button>{actions("customers", data.customers.find(x=>x.id===c.id) ?? c, c.name)}</div>
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="collectors" className="mt-4">
            {header("collectors", "Collectors")}
            <ul className="divide-y rounded-xl border bg-card">
              {data.collectors.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <span className="size-3 rounded-full" style={{ backgroundColor: c.color }} />
                  <div className="flex-1"><div className="font-medium">{c.name}</div><div className="num text-xs text-muted-foreground">{c.phone}</div></div>
                  <span className="text-xs text-muted-foreground">{data.zones.filter((z) => z.collector_id === c.id).map((z) => z.name).join(", ") || "No zone"}</span>
                  {actions("collectors", c, c.name)}
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="zones" className="mt-4">
            {header("zones", "Zones")}
            <ul className="divide-y rounded-xl border bg-card">
              {data.zones.map((z) => (
                <li key={z.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <span className="size-3 rounded-sm" style={{ backgroundColor: z.color }} />
                  <div className="flex-1"><div className="font-medium">{z.name}</div><div className="text-xs text-muted-foreground">Collector: {colName(z.collector_id)} · {data.customers.filter((c) => c.zone_id === z.id).length} customers</div></div>
                  {actions("zones", z, z.name)}
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="payments"><div className="divide-y">{data.payments.map(p=><div key={p.id} className="flex flex-wrap items-center gap-3 py-3 text-sm"><div className="flex-1">{data.customers.find(c=>c.id===p.customer_id)?.name}<div className="text-xs text-muted-foreground">{p.paid_on} · {p.method} · {p.receipt_no ?? '—'} · {p.allocated?'Monthly collection':'Historical receipt'}</div></div><b className="num">{formatBDT(p.amount)}</b>{p.voided_at?<span>Reversed</span>:p.allocated&&<Button size="sm" variant="outline" onClick={async()=>{const reason=prompt('Reason for reversing this collection');if(!reason)return;const r=await supabase.rpc('void_collection',{p_payment:p.id,p_reason:reason});if(r.error)toast.error(r.error.message);else refresh();}}>Reverse</Button>}</div>)}</div></TabsContent>
          <TabsContent value="settings"><Suspense fallback={<p>Loading staff…</p>}><StaffSettings collectors={data.collectors} /></Suspense></TabsContent>
        </Tabs>
      </div>
      {billCustomer && data.customers.find(c=>c.id===billCustomer) && <BillManager customer={data.customers.find(c=>c.id===billCustomer) as Customer} onClose={()=>setBillCustomer(null)} onSaved={refresh} />}
      <CollectDialog customer={data.customers.find(c=>c.id===collectCustomer) ?? null} collectorId={null} open={!!collectCustomer} onOpenChange={o=>!o&&setCollectCustomer(null)} />
      {settlement && data.customers.filter(c=>c.id===settlement.customer).map(c=><MarkPaidDialog key={c.id} customer={c} months={settlement.months} onClose={()=>setSettlement(null)} />)}
      {edit && <EditDialog zones={data.zones} table={edit.table} row={edit.row} fields={fields[edit.table]} onClose={() => setEdit(null)} onSaved={refresh} />}
    </div>
  );
}

function parsePolygon(s: string): [number, number][] | null {
  const pts = s.split(";").map((p) => p.split(",").map((n) => Number(n.trim()))).filter((p) => p.length === 2 && p.every(Number.isFinite)) as [number, number][];
  return pts.length >= 3 ? pts : null;
}

function EditDialog({ table, row, fields, onClose, onSaved, zones }: { zones:Zone[]; table: Table; row: Record<string, string> | null; fields: FieldDef[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, string>>(() => row ?? { color: "#0e7490", lat: "23.8069", lng: "90.3687", monthly_bill: "800", billing_day:"10",billing_start_month:todayISO().slice(0,7)+"-01",recurring_enabled:"true" });
  const [saving, setSaving] = useState(false);
  const [points,setPoints]=useState<[number,number][]>(()=>parsePolygon(row?.["polygon"]??"")??[]);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form["name"]?.trim()) return void toast.error("Name is required");
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const v = form[f.key] ?? "";
      if (f.key === "polygon") {
        if (!validPolygon(points)) return void toast.error("Draw a valid boundary with at least 3 points and no crossing edges");
        payload["polygon"] = points;
      } else if (f.type === "number") {
        if (v === "" || !Number.isFinite(Number(v))) return void toast.error(`${f.label} must be a number`);
        payload[f.key] = Number(v);
      } else if(f.key === "recurring_enabled") {payload[f.key]=v!=="false";
      } else if (f.type === "select" || f.type === "date") {
        payload[f.key] = v || null;
        if (f.type === "date" && !v) delete payload[f.key];
      } else payload[f.key] = v.trim();
    }
    if(table==='customers') {
      const matches=containingZones(Number(payload['lat']),Number(payload['lng']),zones);
      if(matches.length===1)payload['zone_id']=matches[0]?.id;
      else if(matches.length>1&&!matches.some(z=>z.id===payload['zone_id']))return void toast.error('Coordinates overlap zones; select a containing zone');
      else if(matches.length===0&&payload['zone_id'])return void toast.error('Selected zone does not contain these coordinates; choose None or adjust the boundary');
    }
    setSaving(true);
    const rowId=row?.["id"];
    const q = rowId
      ? supabase.from(table).update(payload as never).eq("id", rowId)
      : supabase.from(table).insert(payload as never);
    const { error } = await q;
    setSaving(false);
    if (error) return void toast.error(error.message);
    toast.success("Saved");
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto max-w-xl">
        <DialogHeader><DialogTitle>{row ? "Edit" : "Add"} {table.slice(0, -1)}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {fields.map((f) => (
            <div key={f.key} className={f.full ? "col-span-2 grid gap-1.5" : "grid gap-1.5"}>
              <Label>{f.label}</Label>
              {f.key === "polygon" ? <Suspense fallback={<p>Loading map…</p>}><ZoneDrawing points={points} zones={zones} onChange={setPoints} /></Suspense> : f.type === "select" ? (
                <Select value={form[f.key] || "__none"} onValueChange={(v) => set(f.key, v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(f.options ?? []).map((o) => <SelectItem key={o.value || "__none"} value={o.value || "__none"}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input type={f.type === "number" ? "text" : f.type ?? "text"} inputMode={f.type === "number" ? "decimal" : undefined} value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} className={f.type === "color" ? "h-9 p-1" : undefined} />
              )}
              {f.hint && <p className="text-[11px] text-muted-foreground">{f.hint}</p>}
            </div>
          ))}
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
