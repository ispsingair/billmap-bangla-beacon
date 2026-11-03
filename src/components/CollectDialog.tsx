import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { monthLabel } from "@/lib/monthly";
import { formatBDT, PAYMENT_METHODS, todayISO } from "@/lib/billing";
import { useRefresh, type Customer } from "@/lib/data";

export function CollectDialog({
  customer,
  collectorId,
  open,
  onOpenChange,
}: {
  customer: Customer | null;
  collectorId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const refresh = useRefresh();
  const [allocations, setAllocations] = useState<Record<string,string>>({});
  const [key, setKey] = useState("");
  const [method, setMethod] = useState<string>("cash");
  const [date, setDate] = useState(todayISO());
  const [receipt, setReceipt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && customer) {
      setAllocations(Object.fromEntries(customer.bills.filter(b=>b.outstanding>0).map(b=>[b.id,String(b.outstanding)])));
      setKey(crypto.randomUUID());
      setMethod("cash");
      setDate(todayISO());
      setReceipt("");
    }
  }, [open, customer]);

  async function save() {
    if (!customer) return;
    const entries = Object.entries(allocations).map(([bill_id,amount])=>({bill_id,amount:Number(amount)}));
    const amt = entries.reduce((sum,e)=>sum+e.amount,0);
    if (!entries.length || entries.some(e=>!Number.isFinite(e.amount)||e.amount<=0||e.amount>(customer.bills.find(b=>b.id===e.bill_id)?.outstanding ?? 0))) return void toast.error("Enter valid amounts within each month’s outstanding balance");
    setSaving(true);
    const { error } = await supabase.rpc("collect_months", {
      p_customer: customer.id, p_allocations: entries, p_method: method,
      p_date: date, p_receipt: receipt.trim(), p_key: key,
    });
    setSaving(false);
    if (error) return void toast.error(error.message);
    toast.success(`${formatBDT(amt)} collected from ${customer.name}`);
    await refresh();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Collect payment</DialogTitle>
          {customer && (
            <p className="text-sm text-muted-foreground">
              {customer.name} · Due <span className="num font-semibold text-foreground">{formatBDT(Number(customer.due_amount))}</span>
            </p>
          )}
        </DialogHeader>
        <div className="grid gap-3">
          <div className="max-h-64 overflow-y-auto divide-y">
            {customer?.bills.map(b=><div key={b.id} className="flex items-center gap-3 py-2">
              <Checkbox aria-label={`Pay ${monthLabel(b.billing_month)}`} disabled={b.outstanding<=0} checked={b.id in allocations} onCheckedChange={checked=>setAllocations(prev=>{const next={...prev};if(checked)next[b.id]=String(b.outstanding);else delete next[b.id];return next;})} />
              <div className="min-w-0 flex-1 text-sm"><div>{monthLabel(b.billing_month)}</div><div className="text-xs text-muted-foreground">{b.outstanding>0?`Due ${b.due_date} · ${formatBDT(b.outstanding)}`:'Paid'}</div></div>
              {b.id in allocations && <Input aria-label={`Amount for ${monthLabel(b.billing_month)}`} className="w-24 num" inputMode="decimal" value={allocations[b.id]} onChange={e=>setAllocations(prev=>({...prev,[b.id]:e.target.value}))} />}
            </div>)}
          </div>
          <p className="text-sm">Collect <b className="num">{formatBDT(Object.values(allocations).reduce((s,v)=>s+Number(v||0),0))}</b> · Remaining <b className="num">{formatBDT(Math.max(0,Number(customer?.due_amount ?? 0)-Object.values(allocations).reduce((s,v)=>s+Number(v||0),0)))}</b></p>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="h-10 capitalize"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pdate">Date</Label>
              <Input id="pdate" type="date" className="h-10" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rcpt">Receipt no. (optional)</Label>
            <Input id="rcpt" value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder="R-12345" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="collect" size="lg" className="w-full" onClick={save} disabled={saving || !Object.keys(allocations).length}>
            {saving ? "Saving…" : "Save payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
