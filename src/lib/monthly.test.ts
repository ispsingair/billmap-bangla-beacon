import { describe, expect, it } from 'vitest';
import { billSummary, filterCustomers, type CustomerFilters, type MonthlyBill } from './monthly';

const makeBill = (id:string, customer:string, month:string, outstanding:number, due:string):MonthlyBill => ({
  id, customer_id:customer, billing_month:month, amount:800, opening_paid:0,
  outstanding, due_date:due, created_at:'2026-11-01T00:00:00Z',
});
const bills = [makeBill('sep','a','2026-09-01',800,'2026-09-10'),makeBill('oct','a','2026-10-01',300,'2026-10-10'),makeBill('nov','a','2026-11-01',800,'2026-11-10'),makeBill('other','b','2026-11-01',0,'2026-11-10')];
const customers = [
  {id:'a',name:'Rahim customer',phone:'01712345678',address:'Zone B road',zone_id:'b-zone',created_at:'2026-11-01'},
  {id:'b',name:'Other customer',phone:'01812345678',address:'Zone A road',zone_id:'a-zone',created_at:'2026-10-01'},
];
const zones=[{id:'b-zone',collector_id:'rahim'},{id:'a-zone',collector_id:'other'}];
const filters:CustomerFilters={search:'',zone:'all',collector:'all',status:'all',due:'all',months:[],sort:'name'};
describe('monthly records',()=>{
  it('totals Sep, Oct and Nov outstanding and uses oldest unpaid due date',()=>{
    expect(billSummary(bills.filter(b=>b.customer_id==='a'),'2026-11-03')).toEqual({outstanding:1900,due_date:'2026-09-10',status:'overdue'});
  });
  it('keeps partial-month remaining amounts in the total',()=>{
    expect(billSummary([makeBill('nov','a','2026-11-01',250,'2026-11-10')],'2026-11-03').outstanding).toBe(250);
  });
  it('combines zone, collector, search, due amount and selected month records',()=>{
    const found=filterCustomers(customers,bills,zones,{...filters,zone:'b-zone',collector:'rahim',search:'017123',due:'has',months:['2026-09-01']});
    expect(found.map(c=>c.id)).toEqual(['a']);expect(found[0]?.outstanding).toBe(800);
    expect(filterCustomers(customers,bills,zones,{...filters,zone:'b-zone',collector:'other'})).toHaveLength(0);
  });
  it('supports several selected months without including others',()=>{
    expect(filterCustomers(customers,bills,zones,{...filters,months:['2026-09-01','2026-10-01']})[0]?.outstanding).toBe(1100);
  });
  it('no-due filter excludes outstanding customer',()=>{
    expect(filterCustomers(customers,bills,zones,{...filters,due:'none'}).map(c=>c.id)).toEqual(['b']);
  });
});