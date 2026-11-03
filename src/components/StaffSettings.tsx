import { useSuspenseQuery,queryOptions,useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from '@/components/ui/select';
import type { Collector } from '@/lib/data';
const accountsQuery=queryOptions({queryKey:['staff-accounts'],queryFn:async()=>{const r=await supabase.rpc('list_staff_accounts');if(r.error)throw r.error;return r.data;}});
export function StaffSettings({collectors}:{collectors:Collector[]}) {
  const {data}=useSuspenseQuery(accountsQuery);const qc=useQueryClient();
  async function assign(user:string,value:string){const r=await supabase.rpc('set_staff_role',value==='admin'?{p_user:user,p_role:'admin'}:{p_user:user,p_role:'collector',p_collector:value});if(r.error)return void toast.error(r.error.message);toast.success('Staff assignment saved');await qc.invalidateQueries();}
  return <div className="divide-y">{data.map(u=><div key={u.user_id} className="flex flex-wrap items-center gap-3 py-3"><span className="min-w-0 flex-1 break-all text-sm">{u.email}</span><Select value={u.role==='admin'?'admin':u.collector_id??'pending'} onValueChange={v=>assign(u.user_id,v)}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending" disabled>Awaiting assignment</SelectItem><SelectItem value="admin">Admin</SelectItem>{collectors.map(c=><SelectItem key={c.id} value={c.id}>Collector: {c.name}</SelectItem>)}</SelectContent></Select></div>)}</div>;
}