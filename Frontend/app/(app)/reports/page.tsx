"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, money } from "@/lib/api";
import { Page } from "@/components/page";
import { Bars, AllocationChart } from "@/components/charts";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui";

type R = { income: number; expenses: number; savings: number; investments: number; savingsRate: number; averageMonthlySpending: number; averageMonthlyIncome: number; recurringExpenseTotal: number; biggestCategory: string | null; categories: { name: string; value: number }[]; incomeSources: { name: string; value: number }[]; merchants: { name: string; value: number }[]; comparison: { income: number | null; expenses: number | null; savingsRatePoints: number }; trend: { _id: { month: string; type: string }; value: number }[] };
const iso = (d: Date) => d.toISOString().slice(0, 10);
function range(key: string) { const now = new Date(), to = iso(now); if (key === "month") return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to }; if (key === "last") return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) }; if (key === "year") return { from: iso(new Date(now.getFullYear(), 0, 1)), to }; if (key === "lastyear") return { from: iso(new Date(now.getFullYear() - 1, 0, 1)), to: iso(new Date(now.getFullYear() - 1, 11, 31)) }; const months = Number(key); return { from: iso(new Date(now.getFullYear(), now.getMonth() - months + 1, 1)), to }; }

export default function Reports() {
  const [preset, setPreset] = useState("6"), [custom, setCustom] = useState(range("6"));
  const dates = preset === "custom" ? custom : range(preset);
  const q = useQuery({ queryKey: ["reports", dates], queryFn: () => api<R>(`/reports?from=${dates.from}&to=${dates.to}`) }), d = q.data;
  const months = useMemo(() => d ? [...new Set(d.trend.map(x => x._id.month))].map(name => ({ name, income: d.trend.find(x => x._id.month === name && x._id.type === "income")?.value || 0, expense: d.trend.find(x => x._id.month === name && x._id.type === "expense")?.value || 0 })) : [], [d]);
  return <Page title="Reports" description="Understand patterns in your income, spending, saving, and investing.">
    <div className="card mb-5 flex flex-wrap items-center gap-3 p-4">
      <select className="field w-auto" value={preset} onChange={e => setPreset(e.target.value)} aria-label="Report period"><option value="month">This month</option><option value="last">Last month</option><option value="3">Last 3 months</option><option value="6">Last 6 months</option><option value="year">This year</option><option value="custom">Custom range</option></select>
      {preset === "custom" && <><input className="field w-auto" type="date" value={custom.from} onChange={e => setCustom({ ...custom, from: e.target.value })} aria-label="From" /><span className="text-muted">to</span><input className="field w-auto" type="date" value={custom.to} onChange={e => setCustom({ ...custom, to: e.target.value })} aria-label="To" /></>}
    </div>
    {q.isLoading ? <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">{[0, 1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-24" />)}</div>
      : q.error ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      : d ? <>
        <div className="card flex divide-x divide-edge overflow-x-auto px-5">
          {[["Income",money(d.income)],["Expenses",money(d.expenses)],["Savings",money(d.savings)],["Investments",money(d.investments)],["Savings rate",`${d.savingsRate.toFixed(1)}%`],["Biggest category",d.biggestCategory||"—"],["Avg. monthly spend",money(d.averageMonthlySpending)]].map(([label,value])=><div className="min-w-[155px] flex-1 px-4 py-4 first:pl-0 last:pr-0" key={label}><p className="text-xs text-muted">{label}</p><p className="tnum mt-1 text-base font-bold tracking-tight">{value}</p></div>)}
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <section className="card p-6"><h2 className="font-semibold">Income vs expenses</h2><p className="mb-5 mt-0.5 text-sm text-muted">Monthly trend</p>{months.length ? <Bars data={months} /> : <EmptyState title="No trend data in this range" body="Pick a wider range to see month-by-month movement." />}</section>
          <section className="card p-6"><h2 className="font-semibold">Expense categories</h2><p className="mt-0.5 mb-3 text-sm text-muted">Spending distribution</p>{d.categories.length ? <AllocationChart data={d.categories} /> : <EmptyState title="No expenses in this range" body="Add transactions to see how spending is distributed." />}</section>
        </div>
      </> : null}
  </Page>;
}
