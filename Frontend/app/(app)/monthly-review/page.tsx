"use client";import{useState}from"react";import{useQuery}from"@tanstack/react-query";import{api,money}from"@/lib/api";import{Page}from"@/components/page";
type Review={income:number;expenses:number;savings:number;investments:number;debtReduction:number;netWorthChange:number;savingsRate:number;budgetPerformance:{total:number;within:number;exceeded:number};goalProgress:{name:string;current:number;target:number}[];insights:string[];priorities:string[];previousPeriod:{income:number;expenses:number;savings:number;investments:number}};
export default function MonthlyReview(){
 const now=new Date(),[year,setYear]=useState(now.getFullYear()),[month,setMonth]=useState(now.getMonth()+1);
 const q=useQuery({queryKey:["monthly-review",year,month],queryFn:()=>api<Review>(`/monthly-review?year=${year}&month=${month}`)});
 const d=q.data,pct=(a:number,b:number)=>b?((a-b)/b*100).toFixed(1):"0",fmt=(v:number)=>v>=0?`+${money(v)}`:money(v);
 const prev=d?.previousPeriod;
 return <Page title="Monthly Financial Review" description="A deterministic summary of your financial performance this month." action={<div className="flex gap-2"><select className="field w-auto" value={month} onChange={e=>setMonth(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{new Date(2024,i).toLocaleString("en-IN",{month:"long"})}</option>)}</select><select className="field w-auto" value={year} onChange={e=>setYear(Number(e.target.value))}>{[year-1,year,year+1].map(y=><option key={y} value={y}>{y}</option>)}</select></div>}>
 {q.isLoading&&<p className="text-muted">Loading review…</p>}
 {q.error&&<p className="text-red-600">{q.error.message}</p>}
 {d&&<><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
 <div className="card p-5"><p className="text-sm text-muted">Income</p><p className="mt-1 text-2xl font-bold text-brand">{money(d.income)}</p>{prev&&<p className="text-xs text-muted">{fmt(d.income-prev.income)} vs last month</p>}</div>
 <div className="card p-5"><p className="text-sm text-muted">Expenses</p><p className="mt-1 text-2xl font-bold">{money(d.expenses)}</p>{prev&&<p className="text-xs text-muted">{fmt(d.expenses-prev.expenses)} vs last month</p>}</div>
 <div className="card p-5"><p className="text-sm text-muted">Savings</p><p className="mt-1 text-2xl font-bold text-brand">{money(d.savings)}</p>{prev&&<p className="text-xs text-muted">{fmt(d.savings-prev.savings)} vs last month</p>}</div>
 <div className="card p-5"><p className="text-sm text-muted">Investments</p><p className="mt-1 text-2xl font-bold">{money(d.investments)}</p>{prev&&<p className="text-xs text-muted">{fmt(d.investments-prev.investments)} vs last month</p>}</div>
 </div>
 <div className="grid gap-4 md:grid-cols-3 mb-6">
 <div className="card p-5"><p className="text-sm text-muted">Savings rate</p><p className="mt-1 text-2xl font-bold">{d.savingsRate.toFixed(1)}%</p></div>
 <div className="card p-5"><p className="text-sm text-muted">Net worth change</p><p className={`mt-1 text-2xl font-bold ${d.netWorthChange>=0?"text-brand":"text-red-600"}`}>{fmt(d.netWorthChange)}</p></div>
 <div className="card p-5"><p className="text-sm text-muted">Debt reduced</p><p className="mt-1 text-2xl font-bold text-brand">{money(d.debtReduction)}</p></div>
 </div>
 {d.budgetPerformance&&<div className="card p-5 mb-6"><h2 className="font-semibold mb-3">Budget performance</h2><p className="text-sm text-muted">You stayed within {d.budgetPerformance.within} of {d.budgetPerformance.total} budgets.{d.budgetPerformance.exceeded>0?` ${d.budgetPerformance.exceeded} exceeded.`:""}</p></div>}
 {d.goalProgress?.length>0&&<div className="card p-5 mb-6"><h2 className="font-semibold mb-3">Goal progress</h2><div className="space-y-2">{d.goalProgress.map(g=><div key={g.name} className="flex justify-between text-sm"><span>{g.name}</span><span className="font-medium">{money(g.current)} / {money(g.target)}</span></div>)}</div></div>}
 {d.insights?.length>0&&<div className="card p-5 mb-6"><h2 className="font-semibold mb-3">Insights</h2><ul className="space-y-2">{d.insights.map((ins,i)=><li key={i} className="text-sm">{ins}</li>)}</ul></div>}
 {d.priorities?.length>0&&<div className="card p-5 mb-6"><h2 className="font-semibold mb-3">Priorities</h2><ul className="space-y-2">{d.priorities.map((p,i)=><li key={i} className="text-sm font-medium">{p}</li>)}</ul></div>}
 </>}
 <p className="text-xs text-muted">Projections are estimates based on your Finora data and assumptions.</p>
 </Page>;
}