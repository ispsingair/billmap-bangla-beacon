import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
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
import { formatBDT } from "@/lib/billing";

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
      { key: "due_amount", label: "Due amount (৳)", type: "number" },
      { key: "due_date", label: "Due date", type: "date" },
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
      { key: "polygon", label: "Boundary points", full: true, hint: "lat,lng; lat,lng; … (3 or more corners)" },
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
    if (error) return toast.error(error.message);
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
          </TabsList>
          <TabsContent value="customers" className="mt-4">
            {header("customers", "Customers")}
            <ul className="divide-y rounded-xl border bg-card">
              {data.customers.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="truncate font-medium">{c.name}</span><StatusBadge status={c.status} /></div>
                    <div className="truncate text-xs text-muted-foreground">{zoneName(c.zone_id)} · <span className="num">{c.phone}</span> · Due <span className="num">{formatBDT(Number(c.due_amount))}</span></div>
                  </div>
                  {actions("customers", c, c.name)}
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="collectors" className="mt-4">
            {header("collectors", "Collectors")}
            <ul className="divide-y rounded-xl border bg-card">
              {data.collectors.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2">
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
                <li key={z.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="size-3 rounded-sm" style={{ backgroundColor: z.color }} />
                  <div className="flex-1"><div className="font-medium">{z.name}</div><div className="text-xs text-muted-foreground">Collector: {colName(z.collector_id)} · {data.customers.filter((c) => c.zone_id === z.id).length} customers</div></div>
                  {actions("zones", z, z.name)}
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </div>
      {edit && <EditDialog table={edit.table} row={edit.row} fields={fields[edit.table]} onClose={() => setEdit(null)} onSaved={refresh} />}
    </div>
  );
}

function parsePolygon(s: string): [number, number][] | null {
  const pts = s.split(";").map((p) => p.split(",").map((n) => Number(n.trim()))).filter((p) => p.length === 2 && p.every(Number.isFinite)) as [number, number][];
  return pts.length >= 3 ? pts : null;
}

function EditDialog({ table, row, fields, onClose, onSaved }: { table: Table; row: Record<string, string> | null; fields: FieldDef[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, string>>(() => row ?? { color: "#0e7490", lat: "23.8069", lng: "90.3687", monthly_bill: "800", due_amount: "800" });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.name?.trim()) return toast.error("Name is required");
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const v = form[f.key] ?? "";
      if (f.key === "polygon") {
        const poly = parsePolygon(v);
        if (!poly) return toast.error("Boundary needs at least 3 lat,lng points");
        payload.polygon = poly;
      } else if (f.type === "number") {
        if (v === "" || !Number.isFinite(Number(v))) return toast.error(`${f.label} must be a number`);
        payload[f.key] = Number(v);
      } else if (f.type === "select" || f.type === "date") {
        payload[f.key] = v || null;
        if (f.type === "date" && !v) delete payload[f.key];
      } else payload[f.key] = v.trim();
    }
    setSaving(true);
    const q = row?.id
      ? supabase.from(table).update(payload as never).eq("id", row.id)
      : supabase.from(table).insert(payload as never);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{row ? "Edit" : "Add"} {table.slice(0, -1)}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {fields.map((f) => (
            <div key={f.key} className={f.full ? "col-span-2 grid gap-1.5" : "grid gap-1.5"}>
              <Label>{f.label}</Label>
              {f.type === "select" ? (
                <Select value={form[f.key] || "__none"} onValueChange={(v) => set(f.key, v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {f.options!.map((o) => <SelectItem key={o.value || "__none"} value={o.value || "__none"}>{o.label}</SelectItem>)}
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
