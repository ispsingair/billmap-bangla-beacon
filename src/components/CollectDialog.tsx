import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
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
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("cash");
  const [date, setDate] = useState(todayISO());
  const [receipt, setReceipt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && customer) {
      setAmount(String(Number(customer.due_amount) || Number(customer.monthly_bill)));
      setMethod("cash");
      setDate(todayISO());
      setReceipt("");
    }
  }, [open, customer]);

  async function save() {
    if (!customer) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return void toast.error("Enter a valid amount");
    setSaving(true);
    const { error } = await supabase.from("payments").insert({
      customer_id: customer.id,
      collector_id: collectorId,
      amount: amt,
      method,
      paid_on: date,
      receipt_no: receipt.trim() || null,
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
          <div className="grid gap-1.5">
            <Label htmlFor="amt">Amount (৳)</Label>
            <Input id="amt" inputMode="decimal" className="num text-lg h-11" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
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
          <Button variant="collect" size="lg" className="w-full" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
