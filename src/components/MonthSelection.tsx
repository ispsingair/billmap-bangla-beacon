import { Checkbox } from '@/components/ui/checkbox';
import { monthLabel } from '@/lib/monthly';
import { Button } from '@/components/ui/button';
export function MonthSelection({months,selected,onChange}:{months:string[];selected:string[];onChange:(months:string[])=>void}) {
  return <div className="col-span-full"><div className="mb-2 flex items-center justify-between"><span className="text-sm font-medium">Billing months</span><Button size="sm" variant="ghost" onClick={()=>onChange([])}>All months</Button></div><div className="flex max-h-32 flex-wrap gap-x-4 gap-y-2 overflow-y-auto">{months.map(m=><label key={m} className="flex items-center gap-2 text-xs"><Checkbox checked={selected.includes(m)} onCheckedChange={checked=>onChange(checked?[...selected,m]:selected.filter(x=>x!==m))} />{monthLabel(m)}</label>)}</div></div>;
}