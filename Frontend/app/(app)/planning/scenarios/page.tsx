"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, FlaskConical } from "lucide-react";
import { api, money } from "@/lib/api";
import { Page } from "@/components/page";
import { Alert, EmptyState, Field, Spinner, cx } from "@/components/ui";

type ScenarioResult={status:"ok"|"insufficient_data";historyMonths:number;baseline:{income:number;expenses:number;savings:number;investments:number;debtPayments:number};projected:{income:number;expenses:number;investments:number;savings:number;debtPayments:number};baselineRemaining:number;projectedRemaining:number;annualCashDifference:number;assumptions:Record<string,number>;notes:string[]};
const labels:Record<string,string>={income:"Income",expenses:"Expenses",savings:"Savings",investments:"Investments",debtPayments:"Debt payments"};

export default function ScenariosPage(){
 const [form,setForm]=useState({incomeChangePercent:0,expenseReductionPercent:0,additionalSavings:0,additionalInvestments:0,additionalDebtPayment:0});
 const simulate=useMutation({mutationFn:(body:unknown)=>api<ScenarioResult>("/planning/scenario",{method:"POST",body:JSON.stringify(body)})});
 const r=simulate.data;
 return <Page title="Scenario Simulator" description="Explore what-if changes without modifying your actual financial data.">
  <div className="grid items-start gap-5 xl:grid-cols-[minmax(320px,.78fr)_minmax(0,1.22fr)]">
   <section className="card p-5 xl:sticky xl:top-20"><div className="mb-5"><p className="text-xs font-bold uppercase tracking-[.1em] text-brand">Editable assumptions</p><h2 className="mt-1 text-lg font-semibold">Monthly changes</h2><p className="mt-1 text-sm text-muted">Adjust only the assumptions you want to test.</p></div>
    <form onSubmit={e=>{e.preventDefault();simulate.mutate(form)}} className="space-y-4">
     <Field label="Income change (%)" hint="Use a negative value for a decrease."><input className="field tnum" type="number" step="1" value={form.incomeChangePercent} onChange={e=>setForm({...form,incomeChangePercent:Number(e.target.value)})}/></Field>
     <Field label="Expense reduction (%)"><input className="field tnum" type="number" step="1" min="0" max="100" value={form.expenseReductionPercent} onChange={e=>setForm({...form,expenseReductionPercent:Number(e.target.value)})}/></Field>
     <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"><Field label="Additional savings"><input className="field tnum" type="number" step="100" min="0" value={form.additionalSavings} onChange={e=>setForm({...form,additionalSavings:Number(e.target.value)})}/></Field><Field label="Additional investments"><input className="field tnum" type="number" step="100" min="0" value={form.additionalInvestments} onChange={e=>setForm({...form,additionalInvestments:Number(e.target.value)})}/></Field></div>
     <Field label="Additional debt payment"><input className="field tnum" type="number" step="100" min="0" value={form.additionalDebtPayment} onChange={e=>setForm({...form,additionalDebtPayment:Number(e.target.value)})}/></Field>
     {simulate.error&&<Alert tone="danger">We couldn&apos;t calculate this scenario. Check the assumptions and try again.</Alert>}
     <button disabled={simulate.isPending} className="btn btn-primary w-full">{simulate.isPending?<><Spinner/>Simulating…</>:<>Run simulation <ArrowRight size={16}/></>}</button>
    </form>
    <p className="mt-4 text-xs text-muted">Simulation only. No transactions, budgets, or plans are changed.</p>
   </section>
   <section className="card min-h-[520px] p-5 md:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.1em] text-info">Projection</p><h2 className="mt-1 text-lg font-semibold">Estimated monthly impact</h2></div>{r&&<span className="badge badge-info">Based on {r.historyMonths} month{r.historyMonths===1?"":"s"}</span>}</div>
    {!r&&!simulate.isPending&&<EmptyState icon={<FlaskConical size={20}/>} title="Run a scenario" body="Your baseline and projected position will appear here for comparison."/>}
    {simulate.isPending&&<div className="grid min-h-80 place-items-center text-sm text-muted"><span className="flex items-center gap-2"><Spinner/>Calculating projection…</span></div>}
    {r&&<>{r.status!=="ok"&&<Alert tone="info" className="mb-4">More completed history is needed for a confident projection. The result below uses the available data.</Alert>}
     <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr]"><div className="rounded-xl border border-edge bg-panel/60 p-4"><h3 className="mb-3 font-semibold">Current baseline</h3>{Object.entries(r.baseline).map(([k,v])=><div className="flex justify-between border-b border-edge py-2.5 text-sm last:border-0" key={k}><span className="text-muted">{labels[k]||k}</span><b className="tnum">{money(v)}</b></div>)}<div className="mt-3 flex justify-between border-t border-edge pt-3"><b>Remaining</b><b className="tnum">{money(r.baselineRemaining)}</b></div></div>
      <div className="hidden place-items-center text-brand md:grid"><ArrowRight size={22}/></div>
      <div className="rounded-xl border border-brand/20 bg-brandSoft/50 p-4"><h3 className="mb-3 font-semibold text-brandStrong">Projected</h3>{Object.entries(r.projected).map(([k,v])=><div className="flex justify-between border-b border-brand/10 py-2.5 text-sm last:border-0" key={k}><span className="text-muted">{labels[k]||k}</span><b className="tnum">{money(v)}</b></div>)}<div className="mt-3 flex justify-between border-t border-brand/15 pt-3"><b>Remaining</b><b className="tnum text-brand">{money(r.projectedRemaining)}</b></div></div></div>
     <div className="mt-5 rounded-xl border border-edge p-4"><p className="text-xs font-medium text-muted">Estimated annual cash difference</p><p className={cx("tnum mt-1 text-3xl font-bold tracking-tight",r.annualCashDifference>=0?"text-success":"text-danger")}>{r.annualCashDifference>=0?"+":"−"}{money(Math.abs(r.annualCashDifference))}</p>{r.notes.length>0&&<p className="mt-2 text-xs text-muted">{r.notes.join(" ")}</p>}</div>
    </>}
   </section>
  </div>
 </Page>
}
