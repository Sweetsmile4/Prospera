"use client";
import Link from "next/link";
import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {api,money} from "@/lib/api";
import {TrendChart} from "@/components/charts";

type Health={status:string;score:number;rating:string;breakdown:Record<string,{score:number;max:number;detail:string}>};
type Safe={status:string;safeToSpend:number;shortfall:number;until:string;reasons:string[];breakdown:{label:string;amount:number;type:string}[]};
type Forecast={status:string;openingBalance:number;projectedBalance:number;startDate:string;events:{date:string;description:string;cashImpact:number;balance:number;actionUrl:string}[];assumptions:string[]};
type Emergency={status:string;currentAmount:number;monthlyEssentials:number;monthsCovered:number|null;targetAmount:number;targetMonths:number;gap:number;estimatedCompletionDate:string|null;reasons:string[]};
type Confidence={level:string;score:number;factors:{label:string;met:boolean;detail:string}[]};
type Month={actual:Record<string,number>;expected:Record<string,number>;income:number;expenses:number;savings:number;investments:number;debtPayments:number;projectedRemaining:number};
export function PlanningOverview({compact=false}:{compact?:boolean}){
 const [days,setDays]=useState(30);
 const health=useQuery({queryKey:["financial-health"],queryFn:()=>api<Health>("/financial-health")});
 const safe=useQuery({queryKey:["safe-to-spend"],queryFn:()=>api<Safe>("/safe-to-spend")});
 const forecast=useQuery({queryKey:["forecast",days],queryFn:()=>api<Forecast>("/forecast/cash-flow?days="+days)});
 const emergency=useQuery({queryKey:["emergency-fund"],queryFn:()=>api<Emergency>("/emergency-fund")});
 const confidence=useQuery({queryKey:["data-confidence"],queryFn:()=>api<Confidence>("/data-confidence")});
 const month=useQuery({queryKey:["monthly-forecast"],queryFn:()=>api<Month>("/forecast/month"),enabled:!compact});
 const queries=[health,safe,forecast,emergency,confidence,...(!compact?[month]:[])];
 return <div className="mb-5 space-y-5">
 {queries.some(q=>q.isLoading)&&<p role="status" className="card animate-pulse p-4 text-muted">Calculating your financial outlook…</p>}
 {queries.filter(q=>q.error).map((q,i)=><p role="alert" className="text-red-600" key={i}>{q.error?.message}<button className="ml-3 underline" onClick={()=>q.refetch()}>Retry</button></p>)}
 <div className="grid gap-4 md:grid-cols-3">
 <section className="card p-5"><p className="text-sm text-muted">Safe to spend · current outlook</p><p className="my-2 text-2xl font-bold">{safe.data?.status==="ok"?money(safe.data.safeToSpend):"Insufficient data"}</p>
 {safe.data&&<details><summary className="cursor-pointer text-sm text-brand">Calculation and reserves</summary><p className="my-2 text-xs text-muted">Until {new Date(safe.data.until).toLocaleDateString("en-IN")}. Future income is not spendable today.</p>{safe.data.reasons.map(r=><p className="my-1 text-sm" key={r}>{r}</p>)}{safe.data.breakdown.map(b=><div className="my-2 flex justify-between gap-3 text-sm" key={b.label}><span>{b.label}</span><span className="whitespace-nowrap">{b.type==="subtract"?"−":""}{money(b.amount)}</span></div>)}{safe.data.shortfall>0&&<p className="text-sm text-red-600">Projected shortfall: {money(safe.data.shortfall)}</p>}</details>}</section>
 <section className="card p-5"><p className="text-sm text-muted">Financial health</p><p className="my-2 text-2xl font-bold">{health.data?.status==="ok"?health.data.score+" / 100":"More history needed"}</p>
 {health.data&&<details open={!compact}><summary className="cursor-pointer text-sm text-brand">Why this score?</summary><p className="mt-2 text-xs text-muted">Deterministic tracking indicator, not a credit score.</p>{Object.entries(health.data.breakdown).map(([key,b])=><div className="mt-3" key={key}><div className="flex justify-between text-sm"><span className="capitalize">{key.replace(/([A-Z])/g," $1")}</span><b>{b.score}/{b.max}</b></div><p className="text-xs text-muted">{b.detail}</p></div>)}</details>}</section>
 <section className="card p-5"><p className="text-sm text-muted">Data confidence</p><p className="my-2 text-2xl font-bold capitalize">{confidence.data?.level||"—"}</p><p className="text-xs text-muted">Completeness of tracked data, not a guarantee.</p>{confidence.data&&<details open={!compact}><summary className="mt-2 cursor-pointer text-sm text-brand">Improve your data</summary>{confidence.data.factors.map(f=><p className="mt-2 text-sm" key={f.label}>{f.met?"✓":"○"} {f.label}<span className="block text-xs text-muted">{f.detail}</span></p>)}</details>}<Link href="/settings/financial" className="mt-3 inline-block text-sm text-brand">Financial preferences →</Link></section>
 </div>
 {!compact&&<><section className="card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Projected spendable cash</h2><select aria-label="Forecast horizon" className="field w-auto" value={days} onChange={e=>setDays(Number(e.target.value))}>{[7,30,60,90].map(n=><option key={n} value={n}>Next {n} days</option>)}</select></div><p className="my-3 text-sm text-muted">Projection — not actual transactions. Known commitments only.</p>
 {forecast.data?.events.length?<><TrendChart data={[{name:"Today",value:forecast.data.openingBalance},...forecast.data.events.map(e=>({name:new Date(e.date).toLocaleDateString("en-IN",{day:"numeric",month:"short"}),value:e.balance}))]}/><div className="max-h-80 overflow-auto"><table className="w-full min-w-[540px]"><thead><tr><th>Date</th><th>Projected event</th><th>Cash movement</th><th>Projected balance</th></tr></thead><tbody>{forecast.data.events.map((e,i)=><tr key={i}><td>{new Date(e.date).toLocaleDateString("en-IN")}</td><td><Link href={e.actionUrl} className="text-brand">{e.description}</Link></td><td>{money(e.cashImpact)}</td><td>{money(e.balance)}</td></tr>)}</tbody></table></div></>:<p className="py-8 text-muted">Add recurring income and bills to build a forecast.</p>}
 <details className="mt-4 text-sm text-muted"><summary>Forecast assumptions</summary>{forecast.data?.assumptions.map(a=><p className="mt-2" key={a}>{a}</p>)}</details></section>
 <div className="grid gap-5 xl:grid-cols-2"><section className="card p-5"><h2 className="font-semibold">Emergency fund</h2>
 {emergency.data&&<><p className="my-3 text-2xl font-bold">{money(emergency.data.currentAmount)}</p>{emergency.data.status==="ok"?<div className="space-y-2 text-sm"><p>{emergency.data.monthsCovered?.toFixed(1)} months covered · target {emergency.data.targetMonths} months</p><p>Monthly essentials: {money(emergency.data.monthlyEssentials)}</p><p>Target: {money(emergency.data.targetAmount)} · Gap: {money(emergency.data.gap)}</p><p>Estimated completion: {emergency.data.estimatedCompletionDate||"Set a contribution plan"}</p></div>:emergency.data.reasons.map(r=><p key={r} className="mt-2 text-sm text-muted">{r}</p>)}</>}
 <Link className="mt-4 inline-block text-brand text-sm" href="/settings/financial">Configure emergency savings →</Link></section>
 <section className="card p-5"><h2 className="mb-3 font-semibold">Month-end forecast</h2>{month.data&&<><div className="overflow-auto"><table className="w-full"><thead><tr><th>Category</th><th>Actual to date</th><th>Expected additional</th></tr></thead><tbody>{["income","expenses","savings","investments","debtPayments"].map(k=><tr key={k}><td className="capitalize">{k.replace(/([A-Z])/g," $1")}</td><td>{money(month.data!.actual[k]||0)}</td><td>{money(month.data!.expected[k]||0)}</td></tr>)}</tbody></table></div><p className="mt-4 font-semibold">Projected closing cash: {money(month.data.projectedRemaining)}</p><p className="mt-2 text-xs text-muted">Excludes unknown day-to-day spending and market-value changes.</p></>}</section></div></>}
 {compact&&<Link href="/planning" className="inline-block text-sm font-semibold text-brand">Explore forecasts and financial health →</Link>}
 <p className="text-xs text-muted">Projections are estimates based on your Finora data and assumptions.</p>
 </div>;
}
