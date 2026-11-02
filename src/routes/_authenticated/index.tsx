import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useState } from "react";
import { LogOut, MapPin, Navigation, Phone, Route as RouteIcon, Search, Settings, Wallet, Wifi, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, StatusDot } from "@/components/StatusBadge";
import { CollectDialog } from "@/components/CollectDialog";
import { supabase } from "@/integrations/supabase/client";
import { appDataQuery, type Customer } from "@/lib/data";
import { directionsUrl, formatBDT, type BillStatus } from "@/lib/billing";
import { cn } from "@/lib/utils";

const CustomerMap = lazy(() => import("@/components/CustomerMap"));

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Collection Map — NetCollect" },
      { name: "description", content: "Customer map with paid, due and overdue bills by zone." },
      { property: "og:title", content: "Collection Map — NetCollect" },
      { property: "og:description", content: "Customer map with paid, due and overdue bills by zone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(appDataQuery),
  component: MapPage,
});

type StatusFilter = "all" | BillStatus;

function MapPage() {
  const { data } = useSuspenseQuery(appDataQuery);
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [zoneId, setZoneId] = useState<string>("all");
  const [collectorId, setCollectorId] = useState<string>("all");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRoutes, setShowRoutes] = useState(false);
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: number } | null>(null);
  const [collectOpen, setCollectOpen] = useState(false);

  const zoneById = useMemo(() => new Map(data.zones.map((z) => [z.id, z])), [data.zones]);
  const collectorById = useMemo(() => new Map(data.collectors.map((c) => [c.id, c])), [data.collectors]);
  const collectorOf = (c: Customer) => {
    const z = c.zone_id ? zoneById.get(c.zone_id) : undefined;
    return z?.collector_id ? collectorById.get(z.collector_id) ?? null : null;
  };

  // Scope = zone + collector filters (used for summary)
  const scoped = useMemo(
    () =>
      data.customers.filter((c) => {
        if (zoneId !== "all" && c.zone_id !== zoneId) return false;
        if (collectorId !== "all") {
          const z = c.zone_id ? zoneById.get(c.zone_id) : undefined;
          if (z?.collector_id !== collectorId) return false;
        }
        return true;
      }),
    [data.customers, zoneId, collectorId, zoneById],
  );
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return scoped.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (s && !`${c.name} ${c.phone} ${c.address}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [scoped, status, q]);

  const summary = useMemo(() => {
    const ids = new Set(scoped.map((c) => c.id));
    return {
      total: scoped.length,
      paid: scoped.filter((c) => c.status === "paid").length,
      unpaid: scoped.filter((c) => c.status === "unpaid").length,
      overdue: scoped.filter((c) => c.status === "overdue").length,
      due: scoped.reduce((a, c) => a + Number(c.due_amount), 0),
      today: data.todayPayments.filter((p) => ids.has(p.customer_id)).reduce((a, p) => a + Number(p.amount), 0),
    };
  }, [scoped, data.todayPayments]);

  const selected = selectedId ? data.customers.find((c) => c.id === selectedId) ?? null : null;
  const selectedZone = zoneId !== "all" ? zoneById.get(zoneId) ?? null : null;

  function pick(c: Customer) {
    setSelectedId(c.id);
    setFocus({ lat: c.lat, lng: c.lng, key: Date.now() });
    setQ("");
  }

  const searchResults = q.trim() ? visible.slice(0, 6) : [];

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header */}
      <header className="z-[1001] flex items-center gap-2 border-b bg-card px-3 py-2">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><Wifi className="size-4" /></div>
        <span className="hidden font-bold sm:block">NetCollect</span>
        <div className="relative ml-1 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone or address" className="h-9 pl-8" />
          {searchResults.length > 0 && (
            <div className="absolute inset-x-0 top-full mt-1 overflow-hidden rounded-lg border bg-popover glass">
              {searchResults.map((c) => (
                <button key={c.id} onClick={() => pick(c)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent">
                  <StatusDot status={c.status} />
                  <span className="flex-1 truncate font-medium">{c.name}</span>
                  <span className="num text-xs text-muted-foreground">{c.phone}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" asChild title="Admin">
          <Link to="/admin"><Settings /></Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Sign out"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}
        >
          <LogOut />
        </Button>
      </header>

      {/* Filters */}
      <div className="z-[1000] flex items-center gap-2 overflow-x-auto border-b bg-card px-3 py-2 [scrollbar-width:none]">
        {(["all", "paid", "unpaid", "overdue"] as const).map((s) => (
          <Button key={s} variant="chip" size="sm" data-active={status === s} onClick={() => setStatus(s)} className="shrink-0">
            {s !== "all" && <StatusDot status={s} />}
            {s === "all" ? "All" : s === "unpaid" ? "Unpaid" : s === "paid" ? "Paid" : "Overdue"}
          </Button>
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-border" />
        <Select value={zoneId} onValueChange={(v) => { setZoneId(v); setSelectedId(null); }}>
          <SelectTrigger className="h-8 w-auto shrink-0 rounded-full text-xs"><SelectValue placeholder="Zone" /></SelectTrigger>
          <SelectContent className="z-[1100]">
            <SelectItem value="all">All zones</SelectItem>
            {data.zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={collectorId} onValueChange={setCollectorId}>
          <SelectTrigger className="h-8 w-auto shrink-0 rounded-full text-xs"><SelectValue placeholder="Collector" /></SelectTrigger>
          <SelectContent className="z-[1100]">
            <SelectItem value="all">All collectors</SelectItem>
            {data.collectors.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="chip" size="sm" data-active={showRoutes} onClick={() => setShowRoutes(!showRoutes)} className="shrink-0">
          <RouteIcon /> Routes
        </Button>
      </div>

      {/* Summary */}
      <div className="z-[1000] grid grid-cols-3 gap-px border-b bg-border sm:grid-cols-6">
        <Stat label="Customers" value={summary.total} />
        <Stat label="Paid" value={summary.paid} tone="paid" />
        <Stat label="Unpaid" value={summary.unpaid} tone="due" />
        <Stat label="Overdue" value={summary.overdue} tone="overdue" />
        <Stat label="Total due" value={formatBDT(summary.due)} />
        <Stat label="Collected today" value={formatBDT(summary.today)} tone="paid" />
      </div>

      {/* Map */}
      <main className="relative flex-1">
        <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading map…</div>}>
          <CustomerMap
            customers={visible}
            zones={data.zones}
            collectors={data.collectors}
            selectedId={selectedId}
            selectedZoneId={selectedZone?.id ?? null}
            showRoutes={showRoutes}
            focus={focus}
            onSelectCustomer={(id) => setSelectedId(id)}
            onSelectZone={(id) => { setZoneId(id); setSelectedId(null); }}
          />
        </Suspense>

        {selected ? (
          <CustomerCard
            c={selected}
            zoneName={selected.zone_id ? zoneById.get(selected.zone_id)?.name : undefined}
            collectorName={collectorOf(selected)?.name}
            onClose={() => setSelectedId(null)}
            onCollect={() => setCollectOpen(true)}
          />
        ) : selectedZone ? (
          <ZonePanel
            name={selectedZone.name}
            color={selectedZone.color}
            collector={selectedZone.collector_id ? collectorById.get(selectedZone.collector_id) ?? null : null}
            customers={scoped}
            onPick={pick}
            onClose={() => setZoneId("all")}
          />
        ) : null}
      </main>

      <CollectDialog
        customer={selected}
        collectorId={selected ? collectorOf(selected)?.id ?? null : null}
        open={collectOpen}
        onOpenChange={setCollectOpen}
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "paid" | "due" | "overdue" }) {
  return (
    <div className="bg-card px-3 py-1.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("num text-sm font-semibold", tone === "paid" && "text-paid", tone === "overdue" && "text-overdue", tone === "due" && "text-due-foreground")}>{value}</div>
    </div>
  );
}

const panel = "absolute inset-x-2 bottom-2 z-[1000] rounded-2xl border bg-card p-4 glass sm:inset-x-auto sm:left-3 sm:bottom-3 sm:w-96";

function CustomerCard({ c, zoneName, collectorName, onClose, onCollect }: {
  c: Customer; zoneName?: string; collectorName?: string; onClose: () => void; onCollect: () => void;
}) {
  return (
    <div className={panel}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-bold">{c.name}</h2>
            <StatusBadge status={c.status} />
          </div>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="size-3 shrink-0" />{c.address}</p>
          <a href={`tel:${c.phone}`} className="mt-0.5 flex items-center gap-1 text-xs text-primary"><Phone className="size-3" /><span className="num">{c.phone}</span></a>
        </div>
        <Button variant="ghost" size="icon" className="-mr-2 -mt-2" onClick={onClose}><X /></Button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <Field k="Monthly bill" v={formatBDT(Number(c.monthly_bill))} mono />
        <Field k="Due amount" v={formatBDT(Number(c.due_amount))} mono strong />
        <Field k="Collector" v={collectorName ?? "—"} />
        <Field k="Zone" v={zoneName ?? "—"} />
        <Field k="Last payment" v={c.last_payment_date ? `${formatBDT(Number(c.last_payment_amount))} · ${c.last_payment_date}` : "—"} mono />
        <Field k="Due date" v={c.due_date} mono />
      </dl>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="collect" size="lg" onClick={onCollect}>
          <Wallet /> Collect
        </Button>
        <Button variant="outline" size="lg" asChild>
          <a href={directionsUrl(c.lat, c.lng)} target="_blank" rel="noopener noreferrer"><Navigation /> Navigate</a>
        </Button>
      </div>
    </div>
  );
}

function Field({ k, v, mono, strong }: { k: string; v: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</dt>
      <dd className={cn("truncate", mono && "num", strong ? "text-sm font-bold" : "font-medium")}>{v}</dd>
    </div>
  );
}

function ZonePanel({ name, color, collector, customers, onPick, onClose }: {
  name: string; color: string; collector: { name: string; phone: string } | null; customers: Customer[];
  onPick: (c: Customer) => void; onClose: () => void;
}) {
  const due = customers.reduce((a, c) => a + Number(c.due_amount), 0);
  const count = (s: BillStatus) => customers.filter((c) => c.status === s).length;
  const order: Record<BillStatus, number> = { overdue: 0, unpaid: 1, paid: 2 };
  const sorted = [...customers].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <div className={cn(panel, "flex max-h-[55%] flex-col sm:max-h-[calc(100%-1.5rem)] sm:top-3")}>
      <div className="flex items-start gap-2">
        <span className="mt-1.5 size-3 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
        <div className="flex-1">
          <h2 className="text-base font-bold">{name}</h2>
          <p className="text-xs text-muted-foreground">
            Collector: <b className="text-foreground">{collector?.name ?? "Unassigned"}</b>
            {collector && <> · <a className="num text-primary" href={`tel:${collector.phone}`}>{collector.phone}</a></>}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="-mr-2 -mt-2" onClick={onClose}><X /></Button>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        <Mini label="Total" v={customers.length} />
        <Mini label="Paid" v={count("paid")} cls="text-paid" />
        <Mini label="Due" v={count("unpaid")} cls="text-due-foreground" />
        <Mini label="Overdue" v={count("overdue")} cls="text-overdue" />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Outstanding <b className="num text-foreground">{formatBDT(due)}</b></p>
      <ul className="-mx-2 mt-2 flex-1 overflow-y-auto">
        {sorted.map((c) => (
          <li key={c.id}>
            <button onClick={() => onPick(c)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent">
              <StatusDot status={c.status} />
              <span className="flex-1 truncate">{c.name}</span>
              <span className="num text-xs">{formatBDT(Number(c.due_amount))}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Mini({ label, v, cls }: { label: string; v: number; cls?: string }) {
  return (
    <div className="rounded-lg bg-muted py-1.5">
      <div className={cn("num text-base font-bold", cls)}>{v}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
