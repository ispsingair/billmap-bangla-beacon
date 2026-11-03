import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRefresh, type Customer } from '@/lib/data';
import { formatBDT, PAYMENT_METHODS, todayISO } from '@/lib/billing';
import { monthLabel } from '@/lib/monthly';
import { markMonthsPaid, selectedSettlement } from '@/lib/settlement';

export function MarkPaidDialog({ customer, months, onClose }: { customer: Customer; months: string[]; onClose: () => void }) {
  const refresh = useRefresh();
  const [method, setMethod] = useState('cash');
  const [date, setDate] = useState(todayISO());
  const [receipt, setReceipt] = useState('');
  const [key] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const allocations = selectedSettlement(customer.bills, months);
  const total = allocations.reduce((sum, a) => sum + a.amount, 0);
  async function save() {
    if (!date || date > todayISO()) return void toast.error('Choose a payment date that is not in the future');
    setBusy(true);
    try {
      await markMonthsPaid(customer.id, customer.bills, months, { method, date, receipt, key });
      await refresh();
      toast.success('Selected billing months paid');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (error as { message?: string }).message ?? 'Payment could not be saved');
    } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => !open && !busy && onClose()}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Mark selected months paid</DialogTitle><p className="text-sm text-muted-foreground">{customer.name}</p></DialogHeader>
    <div className="max-h-56 divide-y overflow-y-auto">{customer.bills.filter(b => months.includes(b.billing_month)).map(b => <div key={b.id} className="flex justify-between gap-3 py-2 text-sm"><span>{monthLabel(b.billing_month)}</span><span className="num">{b.outstanding > 0 ? formatBDT(b.outstanding) : 'Paid'}</span></div>)}</div>
    <div><Label htmlFor="settlement-amount">Payment amount (৳)</Label><Input id="settlement-amount" readOnly value={total} /></div>
    <div className="grid grid-cols-2 gap-3"><div><Label>Method</Label><Select value={method} onValueChange={setMethod}><SelectTrigger aria-label="Payment method"><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="settlement-date">Payment date</Label><Input id="settlement-date" type="date" max={todayISO()} value={date} onChange={e => setDate(e.target.value)} /></div></div>
    <div><Label htmlFor="settlement-receipt">Receipt no. (optional)</Label><Input id="settlement-receipt" value={receipt} onChange={e => setReceipt(e.target.value)} /></div>
    <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button variant="collect" disabled={busy || total <= 0} onClick={save}>{busy ? 'Saving…' : 'Confirm payment'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}