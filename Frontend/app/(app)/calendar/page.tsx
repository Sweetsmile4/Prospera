"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, money } from "@/lib/api";
import { Page } from "@/components/page";
import { Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";

type CalEvent = { date: string; title: string; type: "income" | "bill" | "subscription" | "debt" | "emi" | "investment" | "saving" | "goal" | "sinking"; amount: number; actionUrl?: string };
const kindTone: Record<string, BadgeTone> = { income: "success", bill: "warning", subscription: "warning", debt: "danger", emi: "danger", investment: "info", saving: "soft", goal: "info", sinking: "info" };
const kindDot: Record<string, string> = { income: "bg-success", bill: "bg-warning", subscription: "bg-warning", debt: "bg-danger", emi: "bg-danger", investment: "bg-info", saving: "bg-brand", goal: "bg-info", sinking: "bg-info" };
const kindChip: Record<string, string> = { income: "bg-successSoft", bill: "bg-warningSoft", subscription: "bg-warningSoft", debt: "bg-dangerSoft", emi: "bg-dangerSoft", investment: "bg-infoSoft", saving: "bg-brandSoft", goal: "bg-infoSoft", sinking: "bg-infoSoft" };
const kindLabel: Record<string, string> = { income: "Income", bill: "Bill", subscription: "Subscription", debt: "Debt", emi: "EMI", investment: "Investment", saving: "Saving", goal: "Goal", sinking: "Sinking fund" };

export default function CalendarPage() {
  const [months, setMonths] = useState(1);
  const q = useQuery({ queryKey: ["calendar", months], queryFn: () => api<CalEvent[]>(`/calendar/financial?months=${months}`) });
  const grouped = q.data ? Object.entries(q.data.reduce<Record<string, CalEvent[]>>((acc, e) => { const d = new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); (acc[d] = acc[d] || []).push(e); return acc }, {})) : [];
  return <Page title="Financial Calendar" description="Upcoming bills, EMIs, goals, and recurring events." action={<select className="field w-auto" value={months} onChange={e => setMonths(Number(e.target.value))}>{[1, 2, 3, 6].map(n => <option key={n} value={n}>{n} month{n > 1 ? "s" : ""}</option>)}</select>}>
    {q.isLoading && <div className="space-y-6">{[0, 1, 2].map(i => <div key={i} className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>)}</div>}
    {q.error && <ErrorState message={q.error.message} onRetry={() => q.refetch()} />}
    {grouped.length ? grouped.map(([date, events]) => <div key={date} className="mb-7">
      <h2 className="mb-3 text-sm font-semibold text-muted">{date}</h2>
      <div className="space-y-2">{events.map((e, i) => <div key={i} className={"flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge px-4 py-3 " + (kindChip[e.type] || "bg-surface")}>
        <div className="flex min-w-0 items-center gap-3">
          <span className={"inline-block size-2 shrink-0 rounded-full " + (kindDot[e.type] || "bg-muted")} />
          <p className="min-w-0 text-sm font-medium">{e.actionUrl ? <Link className="hover:text-brand" href={e.actionUrl}>{e.title}</Link> : e.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Badge tone={kindTone[e.type] || "neutral"}>{kindLabel[e.type] || e.type}</Badge>
          <span className="tnum text-sm font-semibold">{money(e.amount)}</span>
        </div>
      </div>)}</div>
    </div>) : !q.isLoading && !q.error && <EmptyState title="No upcoming financial events" body="Events are projected from your recurring transactions, bills, goals, and sinking funds. Add some to populate this calendar." />}
    {!q.error && <p className="mt-6 text-xs text-muted">Events are projected from your recurring transactions, bills, and financial commitments.</p>}
  </Page>;
}
