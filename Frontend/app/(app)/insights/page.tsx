"use client";import{useMutation,useQuery,useQueryClient}from"@tanstack/react-query";import{api,money}from"@/lib/api";import{Page}from"@/components/page";
type Anomaly={type:string;categoryId?:{name:string};title?:string;current:number;previous:number;change:number;changePercent:number};
type Subscription={title:string;amount:number;frequency:string;monthlyEquivalent:number;lastDate:string};
type DetectResult={title:string;amount:number;count:number;avgGap:number;confidence:number};
type SubAnalytics={monthlyTotal:number;annualTotal:number;count:number;subscriptions:{title:string;amount:number;frequency:string}[]};
type Milestone={type:string;title:string;description:string;achievedAt:string};
type MilestoneData={total:number;latest:Milestone|null;milestones:Milestone[]};
export default function InsightsPage(){
 const qc=useQueryClient();
 const anomalies=useQuery({queryKey:["anomalies"],queryFn:()=>api<Anomaly[]>("/insights/anomalies")});
 const analytics=useQuery({queryKey:["subscription-analytics"],queryFn:()=>api<SubAnalytics>("/subscriptions/analytics")});
 const detected=useQuery({queryKey:["subscription-detect"],queryFn:()=>api<DetectResult[]>("/subscriptions/detect")});
 const milestones=useQuery({queryKey:["milestones"],queryFn:()=>api<MilestoneData>("/milestones")});
 const detect=useMutation({mutationFn:()=>api<{newMilestones:Milestone[];count:number}>("/milestones/detect",{method:"POST"}),onSuccess:()=>{qc.invalidateQueries({queryKey:["milestones"]})}});
 return <Page title="Insights" description="Spending anomalies, subscription analytics, and pattern detection.">
 <div className="grid gap-5 xl:grid-cols-2">
 <section className="card p-5"><h2 className="font-semibold mb-3">Spending anomalies</h2>
 {anomalies.isLoading&&<p className="text-muted text-sm">Analyzing spending patterns…</p>}
 {anomalies.data?.length?anomalies.data.map((a,i)=><div key={i} className="border-b py-3 last:border-0"><div className="flex justify-between"><span className="text-sm font-medium">{a.categoryId?.name||a.title||"Category"}</span><span className={`text-sm font-semibold ${a.change>0?"text-red-600":"text-brand"}`}>{a.change>0?"↑":"↓"} {Math.abs(a.changePercent).toFixed(0)}%</span></div><p className="text-xs text-muted mt-1">Current: {money(a.current)} · Previous: {money(a.previous)}</p></div>):!anomalies.isLoading&&<p className="text-muted text-sm">No anomalies detected. At least 2 months of data is needed.</p>}
 </section>
 <section className="card p-5"><h2 className="font-semibold mb-3">Subscription analytics</h2>
 {analytics.isLoading&&<p className="text-muted text-sm">Loading…</p>}
 {analytics.data&&<><div className="grid grid-cols-3 gap-4 mb-4"><div><p className="text-xs text-muted">Monthly</p><p className="text-lg font-bold">{money(analytics.data.monthlyTotal)}</p></div><div><p className="text-xs text-muted">Annual</p><p className="text-lg font-bold">{money(analytics.data.annualTotal)}</p></div><div><p className="text-xs text-muted">Count</p><p className="text-lg font-bold">{analytics.data.count}</p></div></div>
 {analytics.data.subscriptions?.length>0&&<div className="space-y-2">{analytics.data.subscriptions.map((s,i)=><div key={i} className="flex justify-between text-sm"><span>{s.title}</span><span className="font-medium">{money(s.amount)} · {s.frequency}</span></div>)}</div>}
 {!analytics.data.count&&<p className="text-muted text-sm">No recurring bills tracked yet.</p>}</>}
 </section>
 </div>
 <section className="card p-5 mt-5"><h2 className="font-semibold mb-3">Possible subscriptions detected</h2>
 {detected.isLoading&&<p className="text-muted text-sm">Scanning transaction history…</p>}
 {detected.data?.length?detected.data.map((d,i)=><div key={i} className="flex items-center justify-between border-b py-3 last:border-0"><div><p className="text-sm font-medium">{d.title}</p><p className="text-xs text-muted">~{d.count} occurrences · avg {d.avgGap.toFixed(0)} days apart</p></div><div className="text-right"><p className="text-sm font-semibold">{money(d.amount)}</p><p className="text-xs text-muted">Confidence: {(d.confidence*100).toFixed(0)}%</p></div></div>):!detected.isLoading&&<p className="text-muted text-sm">No recurring patterns detected in your transaction history.</p>}
 </section>
 <section className="card p-5 mt-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Financial milestones</h2><button className="btn btn-primary" onClick={()=>detect.mutate()} disabled={detect.isPending}>{detect.isPending?"Checking…":"Check for new milestones"}</button></div>
 {detect.data?.count?<p className="mb-3 rounded-xl border border-brand/40 bg-mint px-4 py-3 text-sm text-brand"><b>{detect.data.count}</b> new milestone{detect.data.count>1?"s":""} achieved! {detect.data.newMilestones.map(m=>m.title).join(" · ")}</p>:null}
 {milestones.isLoading&&<p className="text-muted text-sm">Loading…</p>}
 {milestones.data?.milestones.length?<div className="space-y-2">{milestones.data.milestones.map(m=><div key={m.type} className="flex items-center justify-between border-b py-2 last:border-0"><div><p className="text-sm font-medium">{m.title}</p><p className="text-xs text-muted">{m.description}</p></div><span className="text-xs text-muted">{new Date(m.achievedAt).toLocaleDateString("en-IN")}</span></div>)}</div>:!milestones.isLoading&&<p className="text-muted text-sm">No milestones yet. Data-driven celebrations appear here as your finances grow.</p>}
 </section>
 </Page>;
}