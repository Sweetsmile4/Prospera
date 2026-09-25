"use client";
import { useQuery,useMutation,useQueryClient } from "@tanstack/react-query"; import { useState } from "react"; import { api,money } from "@/lib/api"; import type { Category, Tx } from "@/lib/types"; import { Trash2,Eye,Check,Tag } from "lucide-react";
type Summary={total:number;byFlag:Record<string,number>};type Result={items:Tx[];total:number};
const FLAG_LABELS:Record<string,string>={uncategorized:"Uncategorized",possible_duplicate:"Duplicate",possible_subscription:"Subscription",unusual:"Unusual",large_transaction:"Large amount"};
const FLAG_COLORS:Record<string,string>={uncategorized:"bg-amber-100 text-amber-800",possible_duplicate:"bg-purple-100 text-purple-800",possible_subscription:"bg-sky-100 text-sky-800",unusual:"bg-orange-100 text-orange-800",large_transaction:"bg-red-100 text-red-800"};
export function NeedsAttention({onEdit}:{onEdit?:(t:Tx)=>void}){
  const qc=useQueryClient();const [flag,setFlag]=useState("");
  const summary=useQuery({queryKey:["attention-summary"],queryFn:()=>api<Summary>("/transactions/attention/summary")});
  const cq=useQuery({queryKey:["categories"],queryFn:()=>api<Category[]>("/categories")});
  const items=useQuery({queryKey:["attention",flag],queryFn:()=>api<Result>(flag?`/transactions/attention?flag=${flag}&limit=20`:"/transactions/attention?limit=20"),enabled:!!summary.data});
  const refresh=()=>{qc.invalidateQueries({queryKey:["attention"]});qc.invalidateQueries({queryKey:["attention-summary"]});qc.invalidateQueries({queryKey:["transactions"]});qc.invalidateQueries({queryKey:["transaction-summary"]});qc.invalidateQueries({queryKey:["accounts"]});qc.invalidateQueries({queryKey:["dashboard"]});qc.invalidateQueries({queryKey:["net-worth"]})};
  const resolve=useMutation({mutationFn:(t:Tx)=>api(`/transactions/${t._id}/attention/resolve`,{method:"POST",body:JSON.stringify({flags:t.attentionFlags||[]})}),onSuccess:refresh});
  const categorize=useMutation({mutationFn:({t,categoryId}:{t:Tx;categoryId:string})=>api(`/transactions/${t._id}/attention/categorize`,{method:"POST",body:JSON.stringify({categoryId})}),onSuccess:refresh});
  const del=useMutation({mutationFn:(id:string)=>api(`/transactions/${id}`,{method:"DELETE"}),onSuccess:refresh});
  const total=summary.data?.total||0;
  const handleCategorize=(t:Tx,categoryId:string)=>{if(categoryId)categorize.mutate({t,categoryId})};
  return <div className="card p-5">
    <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><Tag size={18} className="text-brand"/><h2 className="text-lg font-semibold">Needs attention</h2></div>{total>0&&<span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">{total} flagged</span>}</div>
    {summary.isLoading?<p className="text-sm text-muted">Scanning your last 90 days…</p>:summary.error?<p className="text-sm text-red-600">Failed to scan: {summary.error.message}</p>:<>
      <div className="mb-4 flex flex-wrap gap-2">{[["",`All (${total})`],...Object.entries(summary.data?.byFlag||{}).filter(([,n])=>n>0).map(([k,n])=>[k,`${FLAG_LABELS[k]||k} (${n})`] as [string,string])].map(([k,label])=><button key={k} onClick={()=>setFlag(k)} className={`rounded-full px-3 py-1 text-xs font-medium ${flag===k?"bg-ink text-white":k?"bg-surface text-muted":"bg-white text-muted border border-line"}`}>{label}</button>)}</div>
      {items.isFetching&&<p className="text-xs text-muted">Loading…</p>}
      {!items.isFetching&&items.data?.items.length===0&&<p className="py-4 text-sm text-muted">No transactions need attention</p>}
      {items.data?.items.map(t=><div key={t._id} className="flex flex-col gap-3 border-t border-border py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><p className="font-medium">{t.title}</p><p className="text-xs text-muted">{new Date(t.transactionDate).toLocaleDateString("en-IN")} · {t.accountId.name}{t.categoryId?` · ${t.categoryId.name}`:""}</p><div className="mt-1 flex flex-wrap gap-1">{(t.attentionFlags||[]).map(f=><span key={f} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${FLAG_COLORS[f]||"bg-surface text-muted"}`}>{FLAG_LABELS[f]||f}</span>)}</div></div>
        <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end"><p className={`font-semibold ${t.type==="income"?"text-brand":t.type==="expense"?"text-red-600":"text-blue-600"}`}>{t.type==="income"?"+":t.type==="expense"?"−":""}{money(t.amount)}</p>
          {(t.attentionFlags||[]).includes("uncategorized")&&(t.type==="income"||t.type==="expense")&&<select className="field max-w-[9rem]" defaultValue="" onChange={e=>handleCategorize(t,e.target.value)}><option value="">Categorize…</option>{(cq.data||[]).filter(c=>c.type===(t.type==="income"?"income":"expense")).map(c=><option value={c._id} key={c._id}>{c.name}</option>)}</select>}
          {(t.attentionFlags||[]).length>0&&<button aria-label="Resolve flag" className="btn btn-secondary" onClick={()=>resolve.mutate(t)}><Check size={14}/>Resolve</button>}
          <div className="flex gap-3 text-muted">{onEdit&&<button aria-label="Edit" onClick={()=>onEdit(t)}><Eye size={16}/></button>}<button aria-label="Delete" onClick={()=>confirm("Delete and reverse this transaction?")&&del.mutate(t._id)}><Trash2 size={16}/></button></div>
        </div>
      </div>)}
    </>}
  </div>;
}