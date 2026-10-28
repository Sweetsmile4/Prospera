"use client";
import { useQuery } from "@tanstack/react-query";
import { api, money } from "@/lib/api";
import { Page } from "@/components/page";
import { TrendChart } from "@/components/charts";
import { ErrorState, MetricCard, Section, Skeleton } from "@/components/ui";
import type { Account } from "@/lib/types";

type N = { assets: number; liabilities: number; netWorth: number; accounts: Account[] };
type H = { snapshotDate: string; netWorth: number }[];

export default function NetWorth() {
  const q = useQuery({ queryKey: ["net-worth"], queryFn: () => api<N>("/net-worth") }), h = useQuery({ queryKey: ["net-worth-history"], queryFn: () => api<H>("/net-worth/history") });
  if (q.isLoading) return <Page title="Net worth" description="The clearest measure of your financial progress."><div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-24" />)}</div></Page>;
  if (q.error) return <Page title="Net worth"><ErrorState message={q.error.message} onRetry={() => q.refetch()} /></Page>;
  const d = q.data!;
  const history = h.data?.length ? h.data.map(x => ({ name: new Date(x.snapshotDate).toLocaleDateString("en-IN", { month: "short" }), value: x.netWorth })) : [{ name: "Today", value: d.netWorth }];
  return <Page title="Net worth" description="The clearest measure of your financial progress.">
    <div className="grid gap-4 md:grid-cols-3">
      <MetricCard label="Total assets" value={money(d.assets)} tone="success" />
      <MetricCard label="Liabilities" value={money(d.liabilities)} tone={d.liabilities > 0 ? "danger" : "neutral"} />
      <MetricCard label="Net worth" value={money(d.netWorth)} className="border-brand" />
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <Section title="History">{h.isLoading ? <Skeleton className="h-72" /> : <TrendChart data={history} />}</Section>
      <Section title="Asset breakdown">
        <ul className="divide-y divide-edge">{d.accounts.map(a => <li className="flex items-center justify-between gap-3 py-3" key={a._id}>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{a.name}</p>
            <p className="text-xs text-muted">{a.type}</p>
          </div>
          <p className="tnum shrink-0 text-sm font-semibold">{money(a.currentBalance)}</p>
        </li>)}</ul>
      </Section>
    </div>
  </Page>;
}