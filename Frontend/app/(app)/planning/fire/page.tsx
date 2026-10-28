"use client";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, money } from "@/lib/api";
import { Page } from "@/components/page";
import { Alert, Field, MetricCard, ProgressBar, Spinner } from "@/components/ui";

type FireResult = { status: "ok" | "insufficient_data"; fireNumber: number; inflatedTarget: number; currentPortfolio: number; gap: number; yearsToFI: number | null; projectedPortfolioAtRetirement: number; monthlyContribution: number; monthlyExpenses: number; yearsRemaining: number; assumptions: { currentAge: number; retirementAge: number; annualReturn: number; inflation: number; withdrawalRate: number } };

export default function FirePlannerPage() {
  const [custom, setCustom] = useState(false);
  const [form, setForm] = useState({ currentAge: 30, retirementAge: 55, monthlyExpenses: 30000, currentPortfolio: 0, monthlyContribution: 5000, expectedAnnualReturn: 10, inflationRate: 6, safeWithdrawalRate: 4 });
  const saved = useQuery({ queryKey: ["fire"], queryFn: () => api<FireResult>("/planning/fire") });
  const customPlan = useMutation({ mutationFn: (b: unknown) => api<FireResult>("/planning/fire", { method: "POST", body: JSON.stringify(b) }) });
  const result = custom ? customPlan.data : saved.data;
  const fiProgress = result ? Math.min(100, result.inflatedTarget > 0 ? (result.currentPortfolio / result.inflatedTarget) * 100 : 0) : 0;
  const fields: [string, keyof typeof form, "age" | "money" | "pct"][] = [["Current age", "currentAge", "age"], ["Target retirement age", "retirementAge", "age"], ["Monthly expenses", "monthlyExpenses", "money"], ["Current portfolio", "currentPortfolio", "money"], ["Monthly contribution", "monthlyContribution", "money"], ["Expected annual return (%)", "expectedAnnualReturn", "pct"], ["Inflation rate (%)", "inflationRate", "pct"], ["Safe withdrawal rate (%)", "safeWithdrawalRate", "pct"]];
  const toBody = { currentAge: form.currentAge, targetRetirementAge: form.retirementAge, monthlyExpenses: form.monthlyExpenses, currentInvestments: form.currentPortfolio, monthlyInvestment: form.monthlyContribution, expectedAnnualReturn: form.expectedAnnualReturn, inflationRate: form.inflationRate, safeWithdrawalRate: form.safeWithdrawalRate };
  return <Page title="FIRE / Retirement Planner" description="Estimate your path to financial independence. All assumptions are configurable.">
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(340px,.85fr)_minmax(0,1.15fr)]">
    <div className="card p-5 xl:sticky xl:top-20">
      <p className="mb-1 text-xs font-bold uppercase tracking-[.1em] text-brand">Editable assumptions</p>
      <h2 className="mb-4 text-lg font-semibold">Retirement model</h2>
      <div className="mb-5 flex items-center gap-3 max-sm:flex-col max-sm:items-stretch">
        <button type="button" className={`btn ${!custom ? "btn-primary" : "btn-secondary"}`} onClick={() => setCustom(false)}>Use saved preferences</button>
        <button type="button" className={`btn ${custom ? "btn-primary" : "btn-secondary"}`} onClick={() => setCustom(true)}>Custom parameters</button>
      </div>
      {custom && <form onSubmit={e => { e.preventDefault(); customPlan.mutate(toBody); }} className="grid gap-4 md:grid-cols-2">
        {fields.map(([label, key, kind]) => <Field key={key} label={label}><input className="field w-full" type="number" step={kind === "pct" ? 0.1 : 100} min={0} max={kind === "age" ? 100 : undefined} value={form[key]} onChange={e => setForm({ ...form, [key]: Number(e.target.value) })} /></Field>)}
        <div><button disabled={customPlan.isPending} className="btn btn-primary">{customPlan.isPending ? <><Spinner className="mr-2" />Calculating…</> : "Calculate FIRE projection"}</button></div>
      </form>}
      {custom && customPlan.error && <Alert tone="danger" className="mt-4">{customPlan.error.message}</Alert>}
      {!custom && !saved.data && !saved.isLoading && <p className="text-muted">Set your FIRE preferences in <a href="/settings/financial" className="text-brand underline">Financial Preferences</a> first.</p>}
      {saved.isLoading && !custom && <p className="text-muted">Loading projection…</p>}
    </div>
    <div className="min-w-0">
    {result && <>
      {result.status !== "ok" && <Alert tone="info" className="mb-4">Projection is based on monthly expenses — enter your FIRE preferences or use custom parameters for a full estimate.</Alert>}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <MetricCard label="FIRE target" value={money(result.fireNumber)} hint="Annual expenses / withdrawal rate" />
        <MetricCard label="Projected portfolio" value={money(result.projectedPortfolioAtRetirement)} tone={result.gap <= 0 ? "success" : "info"} hint="At retirement age" />
        <MetricCard label="Gap to FIRE" value={result.gap <= 0 ? "On track!" : money(result.gap)} tone={result.gap <= 0 ? "success" : "warning"} />
        <MetricCard label="Years to FI" value={result.yearsToFI != null ? `${result.yearsToFI} years` : "N/A"} hint="At current contribution rate" />
      </div>
      <div className="card mb-5 p-6"><h2 className="mb-2 text-lg font-semibold">FIRE progress</h2><ProgressBar value={fiProgress} tone={fiProgress >= 100 ? "success" : "brand"} showLabel /><p className="mt-2 text-sm text-muted"><b className="tnum">{fiProgress.toFixed(1)}%</b> of projected target ({money(result.currentPortfolio)} of {money(result.inflatedTarget)})</p></div>
      <div className="card mb-5 p-6"><h2 className="mb-4 text-lg font-semibold">Assumptions</h2><div className="grid gap-3 md:grid-cols-2 text-sm"><p><span className="text-muted">Current age: </span><b>{result.assumptions.currentAge}</b></p><p><span className="text-muted">Retirement age: </span><b>{result.assumptions.retirementAge}</b></p><p><span className="text-muted">Monthly expenses: </span><b className="tnum">{money(result.monthlyExpenses)}</b></p><p><span className="text-muted">Expected annual return: </span><b>{result.assumptions.annualReturn}%</b></p><p><span className="text-muted">Inflation rate: </span><b>{result.assumptions.inflation}%</b></p><p><span className="text-muted">Safe withdrawal rate: </span><b>{result.assumptions.withdrawalRate}%</b></p><p><span className="text-muted">Monthly contribution: </span><b className="tnum">{money(result.monthlyContribution)}</b></p><p><span className="text-muted">Years remaining: </span><b className="tnum">{result.yearsRemaining}</b></p></div></div>
      <p className="text-xs text-muted">Projections are estimates based on compound growth assumptions. They are not guarantees of future returns.</p>
    </>}
    {!result && !custom && !saved.isLoading && <p className="py-12 text-center text-muted">Configure your FIRE assumptions to see a projection.</p>}
    </div></div>
  </Page>;
}
