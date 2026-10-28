"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, money } from "@/lib/api";
import { Page } from "@/components/page";
import { Alert, Badge, Section, Skeleton, Stat } from "@/components/ui";
import { AlertTriangle, CalendarCheck, ScanSearch, Trophy } from "lucide-react";

type Anomaly = { type: "category_spike" | "large_transaction"; category?: string; title: string; amount: number; average: number; deviation: string; date: string };
type SubAnalytics = { monthlyCost: number; annualCost: number; activeCount: number; subscriptions: { name: string; amount: number; frequency: string; nextDue: string }[] };
type DetectResult = { description: string; amount: number; frequency: string; occurrences: number; lastDate: string };
type Milestone = { type: string; title: string; description: string; achievedAt: string };
type MilestoneData = { total: number; latest: Milestone | null; milestones: Milestone[] };

export default function InsightsPage() {
  const qc = useQueryClient();
  const anomalies = useQuery({ queryKey: ["anomalies"], queryFn: () => api<Anomaly[]>("/insights/anomalies") });
  const analytics = useQuery({ queryKey: ["subscription-analytics"], queryFn: () => api<SubAnalytics>("/subscriptions/analytics") });
  const detected = useQuery({ queryKey: ["subscription-detect"], queryFn: () => api<DetectResult[]>("/subscriptions/detect") });
  const milestones = useQuery({ queryKey: ["milestones"], queryFn: () => api<MilestoneData>("/milestones") });
  const detect = useMutation({ mutationFn: () => api<{ newMilestones: Milestone[]; count: number }>("/milestones/detect", { method: "POST" }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["milestones"] }) } });
  return <Page title="Insights" description="Spending anomalies, subscription analytics, and pattern detection.">
    <div className="grid gap-5 xl:grid-cols-2">
      <Section title={<span className="flex items-center gap-2"><AlertTriangle size={16} className="text-warning" />Spending anomalies</span>}>
        {anomalies.isLoading ? <Skeleton className="h-40" />
          : anomalies.data?.length ? anomalies.data.map((a, i) => <div key={i} className="flex items-start justify-between gap-4 border-b border-edge py-3 last:border-b-0"><div><p className="text-sm font-medium">{a.category || a.title || "Category"}</p><p className="mt-0.5 text-xs text-muted">{a.type === "large_transaction" ? "Single transaction this month" : "Spending this month"}: <b className="tnum">{money(a.amount)}</b> · average {money(a.average)}</p></div><Badge tone="danger" className="shrink-0">▲ {a.deviation} above avg</Badge></div>)
          : <p className="text-sm text-muted">No anomalies detected. At least 2 months of data is needed.</p>}
      </Section>
      <Section title={<span className="flex items-center gap-2"><CalendarCheck size={16} className="text-brand" />Subscription analytics</span>}>
        {analytics.isLoading ? <Skeleton className="h-40" />
          : analytics.data && <> <div className="mb-5 grid grid-cols-3 gap-4"><Stat label="Monthly" value={money(analytics.data.monthlyCost)} /><Stat label="Annual" value={money(analytics.data.annualCost)} /><Stat label="Count" value={analytics.data.activeCount} /></div>
            {analytics.data.subscriptions?.length > 0 ? <div className="space-y-2">{analytics.data.subscriptions.map((s, i) => <div key={i} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate font-medium">{s.name}</span><span className="tnum shrink-0 text-muted">{money(s.amount)} · {s.frequency}</span></div>)}</div> : <p className="text-sm text-muted">No recurring bills tracked yet.</p>}
          </>}
      </Section>
    </div>
    <Section title={<span className="flex items-center gap-2"><ScanSearch size={16} className="text-info" />Possible subscriptions detected</span>} action={detected.data?.length ? <Badge tone="info">{detected.data.length} found</Badge> : undefined} className="mt-5">
      {detected.isLoading ? <Skeleton className="h-40" />
        : detected.data?.length ? detected.data.map((d, i) => <div key={i} className="flex flex-wrap items-center justify-between gap-3 border-b border-edge py-3 last:border-b-0"><div><p className="text-sm font-medium capitalize">{d.description}</p><p className="text-xs text-muted">{d.occurrences} occurrences · last {new Date(d.lastDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p></div><p className="tnum text-sm font-semibold">{money(d.amount)} <span className="text-xs text-muted">/ {d.frequency}</span></p></div>)
        : <p className="text-sm text-muted">No recurring patterns detected in your transaction history.</p>}
    </Section>
    <Section title={<span className="flex items-center gap-2"><Trophy size={16} className="text-warning" />Financial milestones</span>} action={<button className="btn btn-primary btn-sm" onClick={() => detect.mutate()} disabled={detect.isPending}>{detect.isPending ? "Checking…" : "Check for new milestones"}</button>} className="mt-5">
      {detect.data?.count ? <Alert tone="success" className="mb-4"><b>{detect.data.count}</b> new milestone{detect.data.count > 1 ? "s" : ""} achieved! {detect.data.newMilestones.map(m => m.title).join(" · ")}</Alert> : null}
      {milestones.isLoading ? <Skeleton className="h-32" />
        : milestones.data?.milestones.length ? <div className="space-y-2">{milestones.data.milestones.map(m => <div key={m.type} className="flex flex-wrap items-center justify-between gap-3 border-b border-edge py-2.5 last:border-b-0"><div><p className="text-sm font-medium">{m.title}</p><p className="text-xs text-muted">{m.description}</p></div><span className="shrink-0 text-xs text-muted">{new Date(m.achievedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></div>)}</div>
        : <p className="text-sm text-muted">No milestones yet. Data-driven celebrations appear here as your finances grow.</p>}
    </Section>
  </Page>;
}