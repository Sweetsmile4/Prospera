"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, money } from "@/lib/api";
import { Page } from "@/components/page";
import { Alert, Field, MetricCard, Spinner } from "@/components/ui";

type DebtOrder = { id: string; name: string; balance: number; rate: number; emi: number };
type TimelineRow = { month: number; balance: number; interest: number; payment: number };
type DebtResult = { strategy: string; status: "ok" | "insufficient_data" | "not_amortizing"; order: DebtOrder[]; totalInterest: number; interestSaved: number | null; payoffMonths: number | null; debtFreeDate: string | null; monthlyPayment: number; timeline: TimelineRow[]; assumptions: string[] };

export default function DebtPlannerPage() {
  const [strategy, setStrategy] = useState<"snowball" | "avalanche">("avalanche"), [extra, setExtra] = useState(0);
  const plan = useMutation({ mutationFn: (b: unknown) => api<DebtResult>("/planning/debt", { method: "POST", body: JSON.stringify(b) }) });
  return <Page title="Debt Payoff Planner" description="Simulate debt payoff strategies. This is a simulation — it does not modify your actual liabilities.">
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(320px,.72fr)_minmax(0,1.28fr)]">
    <div className="xl:sticky xl:top-20"><div className="card p-5">
      <p className="mb-1 text-xs font-bold uppercase tracking-[.1em] text-brand">Editable assumptions</p>
      <h2 className="mb-4 text-lg font-semibold">Payoff strategy</h2>
      <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); plan.mutate({ strategy: fd.get("strategy"), extraPayment: Number(fd.get("extra") || 0) }); }} className="flex flex-wrap items-end gap-4">
        <Field label="Strategy" className="w-full"><select name="strategy" className="field" value={strategy} onChange={e => setStrategy(e.target.value as "snowball" | "avalanche")}><option value="snowball">Snowball (smallest balance first)</option><option value="avalanche">Avalanche (highest interest first)</option></select></Field>
        <Field label="Extra monthly payment" className="w-full"><input name="extra" type="number" step="0.01" min="0" value={extra} onChange={e => setExtra(Number(e.target.value))} className="field tnum" /></Field>
        <button disabled={plan.isPending} className="btn btn-primary w-full">{plan.isPending ? <><Spinner className="mr-2" />Calculating…</> : "Calculate payoff"}</button>
      </form>
      {plan.error && <Alert tone="danger" className="mt-4">{plan.error.message}</Alert>}
    </div><p className="mt-3 text-xs text-muted">Projection only. Payments are never applied automatically.</p></div>
    <div className="min-w-0">
    {plan.data && <>
      {plan.data.status !== "ok" && <Alert tone="warning" className="mb-4">{plan.data.status === "insufficient_data" ? "Add a minimum monthly payment to every active debt to generate a payoff projection." : "Your current minimum payments never fully amortize this debt (600-month projection). Try a higher extra monthly payment."}</Alert>}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <MetricCard label="Strategy" value={<span className="capitalize">{plan.data.strategy}</span>} />
        <MetricCard label="Payoff months" value={plan.data.payoffMonths ?? "—"} />
        <MetricCard label="Total interest" value={money(plan.data.totalInterest)} tone="warning" />
        <MetricCard label="Interest saved" value={plan.data.interestSaved === null ? "—" : money(plan.data.interestSaved)} tone="success" />
      </div>
      <div className="card mb-5 p-6">
        <div className="mb-1 flex items-center justify-between"><h2 className="text-lg font-semibold">Payoff order</h2>{plan.data.debtFreeDate && <span className="text-sm text-muted">Debt-free by <span className="font-semibold">{new Date(plan.data.debtFreeDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span></span>}</div>
        <p className="mb-4 text-sm text-muted">Monthly payment: <b className="tnum">{money(plan.data.monthlyPayment)}</b></p>
        <div className="space-y-3">{plan.data.order.map((d, i) => <div key={d.id} className="flex items-center justify-between gap-4 rounded-lg border border-edge px-4 py-3"><div className="flex min-w-0 items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-brandSoft text-sm font-bold text-brand">{i + 1}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{d.name}</p><p className="text-xs text-muted">{d.rate}% interest · {money(d.emi)} EMI</p></div></div><span className="tnum shrink-0 text-sm font-semibold">{money(d.balance)}</span></div>)}</div>
      </div>
      {plan.data.status === "ok" && plan.data.timeline.length > 0 && <div className="card p-6"><h2 className="mb-3 text-lg font-semibold">Projection (first 12 months)</h2>
        <div className="overflow-auto"><table className="w-full min-w-[400px]"><thead><tr><th className="text-left">Month</th><th className="text-right">Total balance</th><th className="text-right">Monthly interest</th><th className="text-right">Monthly payment</th></tr></thead><tbody>{plan.data.timeline.slice(0, 12).map((m, i) => <tr key={i}><td className="tnum">{m.month}</td><td className="tnum text-right">{money(m.balance)}</td><td className="tnum text-right">{money(m.interest)}</td><td className="tnum text-right font-semibold">{money(m.payment)}</td></tr>)}</tbody></table></div>
        <details className="mt-4 text-sm text-muted"><summary>Assumptions</summary>{plan.data.assumptions.map(a => <p className="mt-1.5" key={a}>{a}</p>)}</details>
      </div>}
      <p className="mt-4 text-xs text-muted">Simulation only. Payments are not automatically applied to your liabilities.</p>
    </>}
    {!plan.data && !plan.isPending && <div className="card grid min-h-[420px] place-items-center p-8 text-center"><div><p className="font-semibold">Your payoff projection</p><p className="mt-1 text-sm text-muted">Select a strategy and calculate to compare payoff timing and interest.</p></div></div>}
    </div></div>
  </Page>;
}
