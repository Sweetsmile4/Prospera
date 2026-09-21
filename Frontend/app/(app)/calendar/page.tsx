"use client";import{useState}from"react";import{useQuery}from"@tanstack/react-query";import{api,money}from"@/lib/api";import{Page}from"@/components/page";
type CalEvent={date:string;title:string;amount:number;kind:"income"|"expense"|"saving"|"transfer"|"debt"|"sip"|"goal"|"sinking_fund";source?:string;account?:{name:string};category?:{name:string};details?:string};
const kindColor:Record<string,string>={income:"text-brand",expense:"text-red-600",saving:"text-blue-600",transfer:"text-muted",debt:"text-orange-600",sip:"text-purple-600",goal:"text-teal-600",sinking_fund:"text-amber-600"};
const kindBg:Record<string,string>={income:"bg-green-50",expense:"bg-red-50",saving:"bg-blue-50",transfer:"bg-gray-50",debt:"bg-orange-50",sip:"bg-purple-50",goal:"bg-teal-50",sinking_fund:"bg-amber-50"};
export default function CalendarPage(){
 const [months,setMonths]=useState(1);
 const q=useQuery({queryKey:["calendar",months],queryFn:()=>api<CalEvent[]>(`/calendar/financial?months=${months}`)});
 const grouped=q.data?Object.entries(q.data.reduce<Record<string,CalEvent[]>>((acc,e)=>{const d=new Date(e.date).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});(acc[d]=acc[d]||[]).push(e);return acc},{})):[];
 return <Page title="Financial Calendar" description="Upcoming bills, EMIs, goals, and recurring events." action={<select className="field w-auto" value={months} onChange={e=>setMonths(Number(e.target.value))}>{[1,2,3,6].map(n=><option key={n} value={n}>{n} month{n>1?"s":""}</option>)}</select>}>
 {q.isLoading&&<p className="text-muted">Loading calendar…</p>}
 {q.error&&<p className="text-red-600">{q.error.message}</p>}
 {grouped.length?grouped.map(([date,events])=><div key={date} className="mb-6"><h2 className="mb-3 text-sm font-semibold text-muted">{date}</h2><div className="space-y-2">{events.map((e,i)=><div key={i} className={`flex items-center justify-between rounded-xl border px-4 py-3 ${kindBg[e.kind]||"bg-white"}`}><div className="flex items-center gap-3"><span className={`inline-block h-2 w-2 rounded-full ${kindColor[e.kind]||"bg-gray-400"}`}/><div><p className="text-sm font-medium">{e.title}</p><p className="text-xs text-muted">{e.kind}{e.account?` · ${e.account.name}`:""}{e.category?` · ${e.category.name}`:""}</p></div></div><span className={`text-sm font-semibold ${kindColor[e.kind]||""}`}>{money(e.amount)}</span></div>)}</div></div>):!q.isLoading&&<p className="text-muted text-center py-12">No upcoming financial events. Add recurring transactions to populate your calendar.</p>}
 <p className="text-xs text-muted">Events are projected from your recurring transactions, bills, and financial commitments.</p>
 </Page>;
}