"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, money } from "@/lib/api";
import type { Account, Budget, Category, Goal } from "@/lib/types";
import { Page, Empty } from "@/components/page";
import { Modal } from "@/components/modal";
import { Alert, Badge, ConfirmDialog, EmptyState, ErrorState, Field, ProgressBar, Skeleton } from "@/components/ui";
import { Pencil, Plus, Trash2, Target } from "lucide-react";

export function BudgetsPage() {
  const qc = useQueryClient(), [selected, setSelected] = useState<Budget | null>(null), [show, setShow] = useState(false), [del, setDel] = useState<Budget | null>(null), now = new Date();
  const q = useQuery({ queryKey: ["budgets"], queryFn: () => api<Budget[]>("/budgets") }), cats = useQuery({ queryKey: ["categories"], queryFn: () => api<Category[]>("/categories") });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["budgets"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }) };
  const save = useMutation({ mutationFn: ({ id, body }: { id?: string; body: unknown }) => api(id ? `/budgets/${id}` : "/budgets", { method: id ? "PUT" : "POST", body: JSON.stringify(body) }), onSuccess: () => { refresh(); setShow(false); setSelected(null) } }), remove = useMutation({ mutationFn: (id: string) => api(`/budgets/${id}`, { method: "DELETE" }), onSuccess: refresh });
  return <Page title="Budgets" description="Set boundaries for the spending that matters." action={<button className="btn btn-primary" onClick={() => { setSelected(null); setShow(true) }}>+ New budget</button>}>
    {q.isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-44" />)}</div>
      : q.error ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      : q.data?.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{q.data.map(b => { const p = b.percentage ?? b.spent / b.limit * 100; return <article className="card !p-0" key={b._id}>
        <div className="flex items-start justify-between p-5 pb-3">
          <h2 className="font-semibold">{b.categoryId?.name || "Overall"}</h2>
          <Badge tone={p > 100 ? "danger" : p >= 80 ? "warning" : "soft"}>{b.month}/{b.year}</Badge>
        </div>
        <div className="px-5 pb-5">
          <p className="tnum text-2xl font-bold tracking-tight">{money(b.spent)} <span className="text-sm font-normal text-muted">of {money(b.limit)}</span></p>
          <div className="mt-3"><ProgressBar value={p} /></div>
          <p className="mt-2 text-xs text-muted">{p > 100 ? <span className="text-danger">{money(b.spent - b.limit)} over budget</span> : `${money(b.limit - b.spent)} remaining`}</p>
          <div className="mt-4 flex gap-4 text-[13px] font-semibold">
            <button className="flex items-center gap-1.5 text-muted transition-colors hover:text-ink" onClick={() => { setSelected(b); setShow(true) }}><Pencil size={13} />Edit</button>
            <button className="flex items-center gap-1.5 text-danger transition-colors hover:text-brandStrong" onClick={() => setDel(b)}><Trash2 size={13} />Delete</button>
          </div>
        </div>
      </article> })}</div> : <EmptyState icon={<Target size={20} />} title="No monthly budgets yet" body="Create a budget to keep spending on track — per category or overall." action={<button className="btn btn-primary btn-sm" onClick={() => { setSelected(null); setShow(true) }}>+ New budget</button>} />}
    {show && <Modal title={selected ? "Edit budget" : "New monthly budget"} onClose={() => setShow(false)}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); save.mutate({ id: selected?._id, body: { categoryId: f.get("categoryId"), month: Number(f.get("month")), year: Number(f.get("year")), limit: Number(f.get("limit")) } }) }}>
        <Field label="Expense category"><select name="categoryId" className="field" defaultValue={selected?.categoryId?._id} required><option value="">Select</option>{cats.data?.filter(c => c.type === "expense").map(c => <option value={c._id} key={c._id}>{c.name}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Month"><input className="field" name="month" type="number" min="1" max="12" defaultValue={selected?.month || now.getMonth() + 1} /></Field>
          <Field label="Year"><input className="field" name="year" type="number" defaultValue={selected?.year || now.getFullYear()} /></Field>
        </div>
        <Field label="Limit (₹)"><input className="field tnum" name="limit" type="number" min="1" defaultValue={selected?.limit} required /></Field>
        {save.error && <Alert tone="danger">{save.error.message}</Alert>}
        <button className="btn btn-primary w-full">{selected ? "Save changes" : "Create budget"}</button>
      </form>
    </Modal>}
    <ConfirmDialog open={!!del} title="Delete this budget?" body={<>“{del?.categoryId?.name || "Overall"} · {del?.month}/{del?.year}” will be removed permanently.</>} confirmLabel="Delete" busy={remove.isPending} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del._id)} />
  </Page>;
}

export function GoalsPage() {
  const qc = useQueryClient(), [selected, setSelected] = useState<Goal | null>(null), [modal, setModal] = useState<"goal" | "contribute" | null>(null);
  const q = useQuery({ queryKey: ["goals"], queryFn: () => api<Goal[]>("/goals") }), accounts = useQuery({ queryKey: ["accounts"], queryFn: () => api<Account[]>("/accounts") });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["goals"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); qc.invalidateQueries({ queryKey: ["accounts"] }); qc.invalidateQueries({ queryKey: ["transactions"] }) };
  const save = useMutation({ mutationFn: ({ id, body }: { id?: string; body: unknown }) => api(id ? `/goals/${id}` : "/goals", { method: id ? "PUT" : "POST", body: JSON.stringify(body) }), onSuccess: () => { refresh(); setModal(null); setSelected(null) } }), remove = useMutation({ mutationFn: (id: string) => api(`/goals/${id}`, { method: "DELETE" }), onSuccess: refresh }), contribute = useMutation({ mutationFn: (body: unknown) => api("/transactions", { method: "POST", body: JSON.stringify(body) }), onSuccess: () => { refresh(); setModal(null) } });
  const statusTone: Record<string, "soft" | "warning" | "success"> = { active: "soft", paused: "warning", completed: "success" };
  return <Page title="Savings goals" description="Give your savings a name and a finish line." action={<button className="btn btn-primary" onClick={() => { setSelected(null); setModal("goal") }}>+ New goal</button>}>
    {q.isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-52" />)}</div>
      : q.error ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      : q.data?.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{q.data.map(g => { const p = g.currentAmount / g.targetAmount * 100; return <article className="card !p-0" key={g._id}>
        <div className="flex items-start justify-between p-5 pb-3">
          <h2 className="font-semibold">{g.name}</h2>
          <Badge tone={statusTone[g.status] || "soft"} className="capitalize">{g.status}</Badge>
        </div>
        <div className="px-5 pb-5">
          <p className="tnum text-2xl font-bold tracking-tight">{money(g.currentAmount)}</p>
          <p className="mb-3 text-sm text-muted">of {money(g.targetAmount)}</p>
          <ProgressBar value={p} />
          <p className="mt-2 text-xs text-muted">{money(Math.max(0, g.targetAmount - g.currentAmount))} remaining</p>
          <div className="mt-4 flex flex-wrap gap-3 text-[13px] font-semibold">
            <button className="flex items-center gap-1 text-brand transition-colors hover:text-brandStrong" onClick={() => { setSelected(g); setModal("contribute") }}><Plus size={13} />Contribute</button>
            <button className="flex items-center gap-1 text-muted transition-colors hover:text-ink" onClick={() => { setSelected(g); setModal("goal") }}><Pencil size={13} />Edit</button>
            <button className="text-muted" onClick={() => save.mutate({ id: g._id, body: { status: g.status === "paused" ? "active" : "paused" } })}>{g.status === "paused" ? "Resume" : "Pause"}</button>
            <button className="text-danger" onClick={() => confirm("Archive this goal?") && remove.mutate(g._id)}>Archive</button>
          </div>
        </div>
      </article> })}</div> : <Empty text="No savings goals yet. Give a future milestone a number." />}
    {modal === "goal" && <Modal title={selected ? "Edit goal" : "Create savings goal"} onClose={() => setModal(null)}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); save.mutate({ id: selected?._id, body: { name: f.get("name"), targetAmount: Number(f.get("targetAmount")), targetDate: f.get("targetDate") || undefined, status: f.get("status") || undefined } }) }}>
        <Field label="Goal name"><input name="name" className="field" defaultValue={selected?.name} required /></Field>
        <Field label="Target amount (₹)"><input name="targetAmount" className="field tnum" type="number" min="1" defaultValue={selected?.targetAmount} required /></Field>
        <Field label="Target date"><input name="targetDate" className="field" type="date" defaultValue={selected?.targetDate?.slice(0, 10)} /></Field>
        {selected && <Field label="Status"><select name="status" className="field" defaultValue={selected.status}><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></select></Field>}
        {save.error && <Alert tone="danger">{save.error.message}</Alert>}
        <button className="btn btn-primary w-full">{selected ? "Save changes" : "Create goal"}</button>
      </form>
    </Modal>}
    {modal === "contribute" && selected && <Modal title={`Contribute to ${selected.name}`} onClose={() => setModal(null)}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); contribute.mutate({ type: "saving", title: `${selected.name} contribution`, amount: Number(f.get("amount")), accountId: f.get("accountId"), destinationAccountId: f.get("destinationAccountId") || undefined, goalId: selected._id, transactionDate: f.get("transactionDate") }) }}>
        <Field label="Amount (₹)"><input className="field tnum" name="amount" type="number" min="0.01" step="0.01" required /></Field>
        <Field label="Source account"><select className="field" name="accountId" required><option value="">Select</option>{accounts.data?.filter(a => a.isActive).map(a => <option value={a._id} key={a._id}>{a.name}</option>)}</select></Field>
        <Field label="Savings account"><select className="field" name="destinationAccountId"><option value="">External/untracked destination</option>{accounts.data?.filter(a => a.isActive).map(a => <option value={a._id} key={a._id}>{a.name}</option>)}</select></Field>
        <Field label="Date"><input className="field" name="transactionDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></Field>
        {contribute.error && <Alert tone="danger">{contribute.error.message}</Alert>}
        <button className="btn btn-primary w-full">Add contribution</button>
      </form>
    </Modal>}
  </Page>;
}
