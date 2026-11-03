import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Dialog,DialogContent,DialogHeader,DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Customer } from '@/lib/data';
import { formatBDT,todayISO } from '@/lib/billing';
import { monthLabel } from '@/lib/monthly';
import { customerStatus } from '@/lib/billing';
import { StatusBadge } from '@/components/StatusBadge';
import { MarkPaidDialog } from '@/components/MarkPaidDialog';
export function BillManager({customer,onClose,onSaved}:{customer:Customer;onClose:()=>void;onSaved:()=>void}) {
  const [payMonth,setPayMonth]=useState<string|null>(null);
  const [month,setMonth]=useState(todayISO().slice(0,7));const [amount,setAmount]=useState(String(customer.monthly_bill));const [date,setDate]=useState(`${month}-${String(customer.billing_day).padStart(2,'0')}`);const [id,setId]=useState<string|null>(null);const [busy,setBusy]=useState(false);
  async function save(){const n=Number(amount);if(!month||!date||!Number.isFinite(n)||n<0)return void toast.error('Enter a valid month, amount and due date');setBusy(true);const result=id?await supabase.from('monthly_bills').update({amount:n,due_date:date}).eq('id',id):await supabase.from('monthly_bills').insert({customer_id:customer.id,billing_month:`${month}-01`,amount:n,due_date:date});setBusy(false);if(result.error)return void toast.error(result.error.message);toast.success('Bill saved');onSaved();onClose();}
  return <><Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Monthly bills · {customer.name}</DialogTitle><p className="text-sm">Total outstanding {formatBDT(customer.due_amount)}</p></DialogHeader><div className="max-h-64 divide-y overflow-y-auto">{customer.bills.map(b=><div key={b.id} className="flex flex-wrap items-center gap-2 py-2 text-sm"><div className="min-w-0 flex-1">{monthLabel(b.billing_month)} <StatusBadge status={customerStatus(b.outstanding,b.due_date)} /><div className="text-xs text-muted-foreground">Bill {formatBDT(b.amount)} · Outstanding {formatBDT(b.outstanding)} · {b.due_date}</div></div><Button size="sm" variant="collect" disabled={b.outstanding<=0} onClick={()=>setPayMonth(b.billing_month)}>Mark Paid</Button><Button size="sm" variant="outline" onClick={()=>{setId(b.id);setMonth(b.billing_month.slice(0,7));setAmount(String(b.amount));setDate(b.due_date);}}>Edit</Button></div>)}</div><div className="grid grid-cols-2 gap-3"><div><Label>Month</Label><Input type="month" value={month} disabled={!!id} onChange={e=>{setMonth(e.target.value);setDate(`${e.target.value}-${String(customer.billing_day).padStart(2,'0')}`);}} /></div><div><Label>Amount (৳)</Label><Input value={amount} inputMode="decimal" onChange={e=>setAmount(e.target.value)} /></div><div><Label>Due date</Label><Input type="date" value={date} onChange={e=>setDate(e.target.value)} /></div></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>{setId(null);setAmount(String(customer.monthly_bill));}}>New bill</Button><Button disabled={busy} onClick={save}>Save bill</Button></div></DialogContent></Dialog>{payMonth && <MarkPaidDialog customer={customer} months={[payMonth]} onClose={()=>setPayMonth(null)} />}</>;
}