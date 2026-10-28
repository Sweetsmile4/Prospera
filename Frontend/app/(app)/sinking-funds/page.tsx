"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, money } from "@/lib/api";
import type { Account, Category } from "@/lib/types";
import { Page } from "@/components/page";
import { Modal } from "@/components/modal";
import { Alert, Badge, EmptyState, ErrorState, Field, MetricCard, ProgressBar, Skeleton } from "@/components/ui";
import { Archive, History, PiggyBank, Plus } from "lucide-react";

type FundView = { _id: string; name: string; targetAmount: number; currentAmount: number; targetDate: string; monthlyContribution: number; requiredMonthlyContribution: number; remainingAmount: number; monthsRemaining: number; status: string; progress: number };

export default function SinkingFunds() {
  const qc = useQueryClient(), [modal, setModal] = useState<"new" | "contribute" | "history" | null>(null), [selected, setSelected] = useState<FundView | null>(null);
  const q = useQuery({ queryKey: ["sinking-funds"], queryFn: () => api<FundView[]>("/sinking-funds") });
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => api<Account[]>("/accounts") });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api<Category[]>("/categories") });
  const history = useQuery({ queryKey: ["sinking-fund-history", selected?._id], queryFn: () => api<{ _id: string; title: string; amount: number; transactionDate: string }[]>(`/sinking-funds/${selected!._id}/history`), enabled: modal === "history" && !!selected });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["sinking-funds"] }); qc.invalidateQueries({ queryKey: ["accounts"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }) };
  const create = useMutation({ mutationFn: (b: unknown) => api("/sinking-funds", { method: "POST", body: JSON.stringify(b) }), onSuccess: () => { refresh(); setModal(null) } });
  const contribute = useMutation({ mutationFn: (b: unknown) => api(`/sinking-funds/${selected!._id}/contribute`, { method: "POST", body: JSON.stringify(b) }), onSuccess: () => { refresh(); setModal(null) } });
  const update = useMutation({ mutationFn: ({ id, body }: { id: string; body: unknown }) => api(`/sinking-funds/${id}`, { method: "PUT", body: JSON.stringify(body) }), onSuccess: () => { refresh(); setModal(null) } });
  const archive = useMutation({ mutationFn: (id: string) => api(`/sinking-funds/${id}`, { method: "DELETE" }), onSuccess: refresh });
  const d = q.data;
  const totals = useMemo(() => ({ target: d?.reduce((s, f) => s + f.targetAmount, 0) || 0, saved: d?.reduce((s, f) => s + f.currentAmount, 0) || 0, active: d?.filter(f => f.status === "active").length || 0 }), [d]);
  return <Page title="Sinking Funds" description="Save gradually for known future expenses." action={<button className="btn btn-primary" onClick={() => { setSelected(null); setModal("new") }}>+ New fund</button>}>
    {q.isLoading ? <><div className="mb-5 grid gap-4 md:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-52" /></>
      : q.error ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      : d && d.length ? <>
        <div className="mb-5 grid gap-4 md:grid-cols-3">
          <MetricCard label="Total target" value={money(totals.target)} />
          <MetricCard label="Total saved" value={money(totals.saved)} tone="success" />
          <MetricCard label="Active funds" value={totals.active} />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{d.map(f => <article className="card !p-0" key={f._id}>
          <div className="flex items-start justify-between p-5 pb-3">
            <h2 className="font-semibold">{f.name}</h2>
            <Badge tone={f.status === "active" ? "soft" : f.status === "completed" ? "success" : "warning"} className="capitalize">{f.status}</Badge>
          </div>
          <div className="px-5 pb-5">
            <p className="tnum text-2xl font-bold tracking-tight">{money(f.currentAmount)}</p>
            <p className="mb-3 text-sm text-muted">of {money(f.targetAmount)}</p>
            <ProgressBar value={f.progress || f.currentAmount / f.targetAmount * 100} />
            <div className="mt-3 space-y-0.5 text-xs text-muted">
              <p>Target: {f.targetDate ? new Date(f.targetDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "No date set"}</p>
              <p>Required monthly: <b className="tnum">{money(f.requiredMonthlyContribution || 0)}</b></p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn btn-primary btn-sm" onClick={() => { setSelected(f); setModal("contribute") }}><Plus size={14} />Contribute</button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setSelected(f); setModal("history") }}><History size={14} />History</button>
              <button className="btn btn-ghost btn-sm text-danger" onClick={() => archive.mutate(f._id)}><Archive size={14} />Archive</button>
            </div>
          </div>
        </article>)}</div>
      </> : <EmptyState icon={<PiggyBank size={20} />} title="No sinking funds yet" body="Create one to start saving for a known future expense — insurance, travel, repairs." action={<button className="btn btn-primary btn-sm" onClick={() => { setSelected(null); setModal("new") }}>+ New fund</button>} />}
    {modal === "new" && <Modal title="New sinking fund" onClose={() => setModal(null)}>
      <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); create.mutate({ name: fd.get("name"), targetAmount: Number(fd.get("targetAmount")), targetDate: fd.get("targetDate"), monthlyContribution: Number(fd.get("monthlyContribution")) || 0, linkedAccountId: fd.get("linkedAccountId") || undefined, categoryId: fd.get("categoryId") || undefined }) }} className="space-y-4">
        <Field label="Name"><input name="name" required className="field w-full" placeholder="e.g. Car insurance" /></Field>
        <Field label="Target amount (₹)"><input name="targetAmount" type="number" step="0.01" min="1" required className="field tnum" /></Field>
        <Field label="Target date"><input name="targetDate" type="date" required className="field" /></Field>
        <Field label="Monthly contribution"><input name="monthlyContribution" type="number" step="0.01" min="0" className="field tnum" /></Field>
        <Field label="Linked account"><select name="linkedAccountId" className="field"><option value="">None</option>{accounts.data?.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}</select></Field>
        <Field label="Category"><select name="categoryId" className="field"><option value="">None</option>{categories.data?.filter(c => c.type === "expense").map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select></Field>
        {create.error && <Alert tone="danger">{create.error.message}</Alert>}
        <button disabled={create.isPending} className="btn btn-primary w-full">{create.isPending ? "Saving…" : "Create fund"}</button>
      </form>
    </Modal>}
    {modal === "contribute" && selected && <Modal title={`Contribute to ${selected.name}`} onClose={() => setModal(null)}>
      <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); contribute.mutate({ amount: Number(fd.get("amount")), accountId: fd.get("accountId"), date: fd.get("date") }) }} className="space-y-4">
        <Field label="Amount (₹)"><input name="amount" type="number" step="0.01" min="0.01" required className="field tnum" /></Field>
        <Field label="From account"><select name="accountId" required className="field"><option value="">Select</option>{accounts.data?.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}</select></Field>
        <Field label="Date"><input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className="field" /></Field>
        {contribute.error && <Alert tone="danger">{contribute.error.message}</Alert>}
        <button disabled={contribute.isPending} className="btn btn-primary w-full">{contribute.isPending ? "Saving…" : "Contribute"}</button>
      </form>
    </Modal>}
    {modal === "history" && selected && <Modal title={`${selected.name} — history`} onClose={() => setModal(null)}>
      {history.isLoading ? <Skeleton className="h-32" /> : history.data?.length ? history.data.map(t => <div key={t._id} className="flex items-center justify-between gap-4 border-b border-edge py-2.5 text-sm last:border-b-0"><span className="font-medium">{t.title}</span><span className="tnum text-muted">{money(t.amount)} · {new Date(t.transactionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></div>) : <EmptyState title="No contributions yet" body="Contribute once to start building this fund." />}
    </Modal>}
  </Page>;
}