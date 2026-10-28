"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, money } from "@/lib/api";
import { TrendChart } from "@/components/charts";
import { Alert, Badge, Money, ProgressBar, Section, Spinner } from "@/components/ui";

type Health = { status: string; score: number; rating: string; breakdown: Record<string, { score: number; max: number; detail: string }> };
type Safe = { status: string; safeToSpend: number; shortfall: number; until: string; reasons: string[]; breakdown: { label: string; amount: number; type: string }[] };
type Forecast = { status: string; openingBalance: number; projectedBalance: number; startDate: string; events: { date: string; description: string; cashImpact: number; balance: number; actionUrl: string }[]; assumptions: string[] };
type Emergency = { status: string; currentAmount: number; monthlyEssentials: number; monthsCovered: number | null; targetAmount: number; targetMonths: number; gap: number; estimatedCompletionDate: string | null; reasons: string[] };
type Confidence = { level: string; score: number; factors: { label: string; met: boolean; detail: string }[] };
type Month = { actual: Record<string, number>; expected: Record<string, number>; income: number; expenses: number; savings: number; investments: number; debtPayments: number; projectedRemaining: number };

export function PlanningOverview({ compact = false }: { compact?: boolean }) {
  const [days, setDays] = useState(30);
  const health = useQuery({ queryKey: ["financial-health"], queryFn: () => api<Health>("/financial-health") });
  const safe = useQuery({ queryKey: ["safe-to-spend"], queryFn: () => api<Safe>("/safe-to-spend") });
  const forecast = useQuery({ queryKey: ["forecast", days], queryFn: () => api<Forecast>("/forecast/cash-flow?days=" + days) });
  const emergency = useQuery({ queryKey: ["emergency-fund"], queryFn: () => api<Emergency>("/emergency-fund") });
  const confidence = useQuery({ queryKey: ["data-confidence"], queryFn: () => api<Confidence>("/data-confidence") });
  const month = useQuery({ queryKey: ["monthly-forecast"], queryFn: () => api<Month>("/forecast/month"), enabled: !compact });
  const queries = [health, safe, forecast, emergency, confidence, ...(!compact ? [month] : [])];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return <div className="mb-5 space-y-5">
    {queries.some(q => q.isLoading) && <div className="card flex items-center gap-3 p-4 text-sm text-muted" role="status"><Spinner />Calculating your financial outlook…</div>}
    {queries.filter(q => q.error).map((q, i) => <Alert key={i} tone="danger" className="justify-between" title="Something went wrong">{q.error?.message} <button className="btn btn-secondary btn-sm" onClick={() => q.refetch()}>Retry</button></Alert>)}
    <div className="grid gap-4 md:grid-cols-3">
      <section className="card p-5">
        <div className="flex items-center justify-between"><p className="text-[13px] font-medium text-muted">Safe to spend</p><Badge tone={safe.data?.status === "ok" ? "success" : "neutral"}>{safe.data?.status === "ok" ? "Current" : "No data"}</Badge></div>
        <p className="tnum mt-2 text-2xl font-bold tracking-tight">{safe.data?.status === "ok" ? money(safe.data.safeToSpend) : "—"}</p>
        {safe.data?.status !== "ok" && <p className="mt-1 text-xs text-muted">More information needed</p>}
        {safe.data && <details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-brand">Calculation and reserves</summary>
          <p className="mt-2 text-xs text-muted">Until {new Date(safe.data.until).toLocaleDateString("en-IN")}. Future income is not spendable today.</p>
          {safe.data.reasons.map(r => <p className="my-1.5 text-sm" key={r}>{r}</p>)}
          {safe.data.breakdown.map(b => <div className="my-1.5 flex justify-between gap-3 text-sm" key={b.label}><span>{b.label}</span><span className="tnum whitespace-nowrap">{b.type === "subtract" ? "−" : "+"} {money(b.amount)}</span></div>)}
          {safe.data.shortfall > 0 && <p className="text-sm font-medium text-danger">Projected shortfall: {money(safe.data.shortfall)}</p>}
        </details>}
      </section>
      <section className="card p-5">
        <div className="flex items-center justify-between"><p className="text-[13px] font-medium text-muted">Financial health</p>{health.data?.status === "ok" && <Badge tone="success">{health.data.rating}</Badge>}</div>
        <p className="tnum mt-2 text-2xl font-bold tracking-tight">{health.data?.status === "ok" ? `${health.data.score} / 100` : "—"}</p>
        {health.data?.status !== "ok" && <p className="mt-1 text-xs text-muted">More history needed</p>}
        {health.data && <details open={!compact} className="mt-3"><summary className="cursor-pointer text-sm font-medium text-brand">Why this score?</summary>
          <p className="mt-2 text-xs text-muted">Deterministic tracking indicator, not a credit score.</p>
          <div className="mt-3"><ProgressBar value={health.data.status === "ok" ? health.data.score : 0} size="sm" /></div>
          {Object.entries(health.data.breakdown).map(([key, b]) => <div className="mt-3" key={key}><div className="flex justify-between text-sm"><span className="capitalize">{cap(key.replace(/([A-Z])/g, " $1"))}</span><b className="tnum">{b.score}/{b.max}</b></div><p className="text-xs text-muted">{b.detail}</p></div>)}
        </details>}
      </section>
      <section className="card p-5">
        <div className="flex items-center justify-between gap-2"><p className="text-[13px] font-medium text-muted">Data confidence</p>{confidence.data && <Badge tone={confidence.data.level === "high" ? "success" : confidence.data.level === "medium" ? "warning" : "neutral"}>{cap(confidence.data.level)}</Badge>}</div>
        <p className="mt-2 text-2xl font-bold capitalize tracking-tight">{confidence.data?.level || "—"}</p>
        <p className="mt-1 text-xs text-muted">Completeness of tracked data, not a guarantee.</p>
        {confidence.data && <details open={!compact} className="mt-3"><summary className="cursor-pointer text-sm font-medium text-brand">Improve your data</summary>
          {confidence.data.factors.map(f => <p className="mt-2 text-sm" key={f.label}><span className={f.met ? "text-success" : "text-muted"}>{f.met ? "✓" : "○"}</span>{" "}{f.label}<span className="block text-xs text-muted">{f.detail}</span></p>)}
        </details>}
        <Link href="/settings/financial" className="mt-3 inline-flex text-sm font-semibold text-brand">Financial preferences →</Link>
      </section>
    </div>
    {!compact && <>
      <Section title="Projected spendable cash" description="Projection — not actual transactions. Known commitments only." action={<select aria-label="Forecast horizon" className="field w-auto" value={days} onChange={e => setDays(Number(e.target.value))}>{[7, 30, 60, 90].map(n => <option key={n} value={n}>Next {n} days</option>)}</select>}>
        {forecast.data?.events.length ? <>
          <TrendChart data={[{ name: "Today", value: forecast.data.openingBalance }, ...forecast.data.events.map(e => ({ name: new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), value: e.balance }))]} />
          <div className="mt-5 max-h-80 overflow-auto"><table className="w-full min-w-[540px]"><thead><tr><th>Date</th><th>Projected event</th><th>Cash movement</th><th>Projected balance</th></tr></thead><tbody>{forecast.data.events.map((e, i) => <tr key={i}><td>{new Date(e.date).toLocaleDateString("en-IN")}</td><td><Link href={e.actionUrl} className="text-brand">{e.description}</Link></td><td><Money value={e.cashImpact} signed /></td><td className="font-medium">{money(e.balance)}</td></tr>)}</tbody></table></div>
          <p className="mt-4 font-semibold">Projected closing cash: <Money value={forecast.data.projectedBalance} tone={forecast.data.projectedBalance >= 0 ? "positive" : "negative"} /></p>
        </> : <p className="py-8 text-center text-sm text-muted">Add recurring income and bills to build a forecast.</p>}
        <details className="mt-4 text-sm text-muted"><summary>Forecast assumptions</summary>{forecast.data?.assumptions.map(a => <p className="mt-2" key={a}>{a}</p>)}</details>
      </Section>
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Emergency fund">
          {emergency.data ? <>
            <div className="flex items-end justify-between gap-4"><p className="tnum text-3xl font-bold tracking-tight">{money(emergency.data.currentAmount)}</p>{emergency.data.status === "ok" ? <Badge tone="success">Funded</Badge> : <Badge tone="warning">In progress</Badge>}</div>
            {emergency.data.status === "ok" ? <div className="mt-4 space-y-2 text-sm"><p className="flex justify-between gap-3"><span className="text-muted">Months covered</span><b className="tnum">{emergency.data.monthsCovered?.toFixed(1)} of {emergency.data.targetMonths}</b></p><p className="flex justify-between gap-3"><span className="text-muted">Monthly essentials</span><b className="tnum">{money(emergency.data.monthlyEssentials)}</b></p><p className="flex justify-between gap-3"><span className="text-muted">Target</span><b className="tnum">{money(emergency.data.targetAmount)}</b></p><p className="flex justify-between gap-3"><span className="text-muted">Estimated completion</span><b>{emergency.data.estimatedCompletionDate ? new Date(emergency.data.estimatedCompletionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Set a contribution plan"}</b></p></div>
              : <div className="mt-4 space-y-2">{emergency.data.reasons.map(r => <p key={r} className="text-sm text-muted">• {r}</p>)}<p className="flex justify-between gap-3 pt-1 text-sm"><span className="text-muted">Current · Gap</span><b className="tnum">{money(emergency.data.currentAmount)} · {money(emergency.data.gap)}</b></p></div>}
            <div className="mt-4"><ProgressBar value={emergency.data.targetAmount ? emergency.data.currentAmount / emergency.data.targetAmount * 100 : 0} tone={emergency.data.gap <= 0 ? "success" : "warning"} showLabel /></div>
          </> : <p className="py-6 text-sm text-muted">No emergency fund data yet.</p>}
          <Link className="mt-4 inline-flex text-sm font-semibold text-brand" href="/settings/financial">Configure emergency savings →</Link>
        </Section>
        <Section title="Month-end forecast">
          {month.data ? <>
            <div className="overflow-auto"><table className="w-full"><thead><tr><th>Category</th><th>Actual to date</th><th>Expected additional</th></tr></thead><tbody>{["income", "expenses", "savings", "investments", "debtPayments"].map(k => <tr key={k}><td className="capitalize">{cap(k.replace(/([A-Z])/g, " $1"))}</td><td className="tnum">{money(month.data!.actual[k] || 0)}</td><td className="tnum">{money(month.data!.expected[k] || 0)}</td></tr>)}</tbody></table></div>
            <p className="mt-4 text-sm"><span className="text-muted">Projected closing cash: </span><b className="tnum">{money(month.data.projectedRemaining)}</b></p>
            <p className="mt-2 text-xs text-muted">Excludes unknown day-to-day spending and market-value changes.</p>
          </> : <p className="py-6 text-sm text-muted">Add recurring income and bills to build a month-end forecast.</p>}
        </Section>
      </div>
    </>}
    {compact && <Link href="/planning" className="inline-block text-sm font-semibold text-brand">Explore forecasts and financial health →</Link>}
    <p className="text-xs text-muted">Projections are estimates based on your Prospera data and assumptions.</p>
  </div>;
}
