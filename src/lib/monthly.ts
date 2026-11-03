import { customerStatus, todayISO, type BillStatus } from './billing';
export type MonthlyBill = { id: string; customer_id: string; billing_month: string; amount: number; due_date: string; opening_paid: number; outstanding: number; legacy_import: boolean };
export function monthLabel(month: string) { return new Date(`${month.slice(0,7)}-01T12:00:00`).toLocaleDateString('en-GB',{month:'long',year:'numeric'}); }
export function billSummary(bills: MonthlyBill[], today = todayISO()) {
  const outstanding = bills.reduce((sum,b)=>sum+Number(b.outstanding),0);
  const date = bills.filter(b=>b.outstanding>0).map(b=>b.due_date).sort()[0] ?? '';
  return { outstanding, due_date: date, status: customerStatus(outstanding,date,today) };
}
export type CustomerFilters = { search: string; zone: string; collector: string; status: 'all' | BillStatus; due: string; months: string[]; sort: string };
export function filterCustomers<T extends { id:string; name:string; phone:string; address:string; zone_id:string|null; created_at:string }>(customers:T[], bills:MonthlyBill[], zones:{id:string;collector_id:string|null}[], f:CustomerFilters) {
  return customers.map(c=>{const selected=bills.filter(b=>b.customer_id===c.id&&(!f.months.length||f.months.includes(b.billing_month)));return {...c,...billSummary(selected), hasMonths:selected.length>0};}).filter(c=>
    (!f.months.length||c.hasMonths)&&(!f.search.trim()||`${c.name} ${c.phone} ${c.address}`.toLowerCase().includes(f.search.trim().toLowerCase()))&&
    (f.zone==='all'||c.zone_id===f.zone)&&(f.collector==='all'||zones.find(z=>z.id===c.zone_id)?.collector_id===f.collector)&&
    (f.status==='all'||c.status===f.status)&&(f.due==='all'||(f.due==='none'?c.outstanding===0:c.outstanding>0))
  ).sort((a,b)=>f.sort==='due'?b.outstanding-a.outstanding:f.sort==='date'?(a.due_date||'9999').localeCompare(b.due_date||'9999'):f.sort==='recent'?b.created_at.localeCompare(a.created_at):a.name.localeCompare(b.name));
}