"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, money } from "@/lib/api";
import { Page } from "@/components/page";
import { ErrorState, InsightRow, MetricCard, ProgressBar, Section, Skeleton, cx } from "@/components/ui";
import { Lightbulb } from "lucide-react";

type Review = { income: number; expenses: number; savings: number; investments: number; savingsRate: number; netWorthChange: number | null; debtReduction: number; budgetPerformance: { total: number; within: number; exceeded: number } | null; goalProgress: { name: string; progress: number }[]; insights: string[]; priorities: string[]; previous: { income: number; expenses: number; savings: number; investments: number } };

export default function MonthlyReview() {
  const now = new Date(), [year, setYear] = useState(now.getFullYear()), [month, setMonth] = useState(now.getMonth() + 1);
  const q = useQuery({ queryKey: ["monthly-review", year, month], queryFn: () => api<Review>(`/monthly-review?year=${year}&month=${month}`) });
  const d = q.data, pct = (a: number, b: number) => b ? ((a - b) / b * 100).toFixed(1) : "0", fmt = (v: number | null) => v === null ? "—" : `${v >= 0 ? "+" : "−"}${money(Math.abs(v))}`;
  const prev = d?.previous;
  const monthName = new Date(year, month - 1).toLocaleString("en-IN", { month: "long" });
  return <Page title="Monthly Financial Review" description="A deterministic summary of your financial performance this month." action={<div className="flex gap-2"><select className="field w-auto" value={month} onChange={e => setMonth(Number(e.target.value))} aria-label="Month">{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2024, i).toLocaleString("en-IN", { month: "long" })}</option>)}</select><select className="field w-auto" value={year} onChange={e => setYear(Number(e.target.value))} aria-label="Year">{[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}</select></div>}>
    {q.isLoading ? <div className="space-y-5"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-40" /></div>
      : q.error ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      : d && <>
        <section className="card mb-4 overflow-hidden bg-[linear-gradient(135deg,var(--surface),var(--brand-soft))] p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[.12em] text-brand">Your {monthName} review</p>
          <h2 className="mt-3 max-w-4xl text-2xl font-bold leading-snug tracking-tight md:text-3xl">You earned {money(d.income)} and allocated {money(d.savings + d.investments)} toward savings and investments.</h2>
          <p className="mt-3 max-w-3xl text-sm text-muted">Your savings rate was <b className="tnum text-ink">{d.savingsRate.toFixed(1)}%</b>{d.netWorthChange !== null ? <> and net worth changed by <b className={cx("tnum", d.netWorthChange >= 0 ? "text-success" : "text-danger")}>{fmt(d.netWorthChange)}</b></> : null}.</p>
        </section>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Income" value={money(d.income)} tone="success" hint={prev && <span className="tnum">{fmt(d.income - prev.income)} vs last month</span>} />
          <MetricCard label="Expenses" value={money(d.expenses)} hint={prev && <span className="tnum">{fmt(d.expenses - prev.expenses)} vs last month</span>} />
          <MetricCard label="Savings" value={money(d.savings)} tone="success" hint={prev && <span className="tnum">{fmt(d.savings - prev.savings)} vs last month</span>} />
          <MetricCard label="Investments" value={money(d.investments)} hint={prev && <span className="tnum">{fmt(d.investments - prev.investments)} vs last month</span>} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <MetricCard label="Savings rate" value={`${d.savingsRate.toFixed(1)}%`} tone={d.savingsRate >= 30 ? "success" : d.savingsRate >= 20 ? "info" : "warning"} />
          <MetricCard label="Net worth change" value={fmt(d.netWorthChange)} tone={d.netWorthChange !== null && d.netWorthChange >= 0 ? "success" : "danger"} />
          <MetricCard label="Debt reduced" value={money(d.debtReduction)} tone="success" />
        </div>
        {d.budgetPerformance && <Section title="Budget performance" className="mt-5"><p className="text-sm text-muted"><b>{d.budgetPerformance.within}</b> of <b>{d.budgetPerformance.total}</b> budgets within limit.{d.budgetPerformance.exceeded > 0 ? ` ${d.budgetPerformance.exceeded} exceeded.` : ""}</p></Section>}
        {d.goalProgress?.length > 0 && <Section title="Goal progress" className="mt-5">
          <div className="space-y-4">{d.goalProgress.map(g => <div key={g.name}><div className="mb-1.5 flex items-center justify-between text-sm"><span className="font-medium">{g.name}</span><span className="tnum text-muted">{g.progress.toFixed(0)}%</span></div><ProgressBar value={Math.min(100, g.progress)} /></div>)}</div>
        </Section>}
        {d.insights?.length > 0 && <Section title="What changed" className="mt-5"><div className="space-y-2">{d.insights.map((ins, i) => <InsightRow key={i} tone={i === 0 ? "positive" : "info"} icon={<Lightbulb size={16} />} title={ins} body="Based on this month's deterministic financial results." />)}</div></Section>}
        {d.priorities?.length > 0 && <Section title="Priorities" className="mt-5">{d.priorities.map((p, i) => <div key={i} className="rounded-lg border border-edge bg-surface px-3.5 py-2.5 text-sm font-medium"><b className="mr-2 text-brand">{i + 1}.</b>{p}</div>)}</Section>}
      </>}
    {!q.error && <p className="mt-6 text-xs text-muted">Projections are estimates based on your Prospera data and assumptions.</p>}
  </Page>;
}
