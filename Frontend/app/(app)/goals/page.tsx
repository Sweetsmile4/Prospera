"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, money } from "@/lib/api";
import type { Account, Goal } from "@/lib/types";
import { Page } from "@/components/page";
import { Modal } from "@/components/modal";
import { Alert, Badge, EmptyState, ErrorState, Field, ProgressBar, Skeleton } from "@/components/ui";
import { Target } from "lucide-react";

type GoalV2 = Goal & { priority: "low" | "medium" | "high"; monthlyTarget: number; estimatedMonths?: number | null; remaining?: number };
type Sim = { monthsToReach: number | null; monthlyContribution: number; requiredMonthly?: number | null; estimatedDate?: string; monthsAvailable?: number } | null;

export default function Goals() {
  const qc = useQueryClient(), [modal, setModal] = useState<"goal" | "contribute" | "withdraw" | "simulate" | null>(null), [selected, setSelected] = useState<GoalV2 | null>(null), [sim, setSim] = useState<Sim>(null);
  const q = useQuery({ queryKey: ["goals"], queryFn: () => api<GoalV2[]>("/goals") }), accounts = useQuery({ queryKey: ["accounts"], queryFn: () => api<Account[]>("/accounts") });
  const refresh = () => { for (const key of ["goals", "dashboard", "accounts", "transactions"]) qc.invalidateQueries({ queryKey: [key] }) };
  const save = useMutation({ mutationFn: ({ id, body }: { id?: string; body: unknown }) => api(id ? `/goals/${id}` : "/goals", { method: id ? "PUT" : "POST", body: JSON.stringify(body) }), onSuccess: () => { refresh(); setModal(null) } }), move = useMutation({ mutationFn: ({ withdraw, body }: { withdraw: boolean; body: unknown }) => api(withdraw ? `/goals/${selected!._id}/withdrawals` : "/transactions", { method: "POST", body: JSON.stringify(body) }), onSuccess: () => { refresh(); setModal(null) } }), archive = useMutation({ mutationFn: (id: string) => api(`/goals/${id}`, { method: "DELETE" }), onSuccess: refresh }), simulate = useMutation({ mutationFn: ({ required, b }: { required: boolean; b: unknown }) => api<NonNullable<Sim>>((required ? "/planning/goal/required" : "/planning/goal/simulate"), { method: "POST", body: JSON.stringify(b) }), onSuccess: d => { setSim(d) } });
  const actionLabel = { contribute: "Contribute to", withdraw: "Withdraw from" } as const;
  return <Page title="Savings goals" description="Plan contributions, track timelines, and withdraw with a complete history." action={<button className="btn btn-primary" onClick={() => { setSelected(null); setModal("goal") }}>+ New goal</button>}>
    {q.isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-60" />)}</div>
      : q.error ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      : q.data?.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{q.data.map(g => <article className="card !p-0" key={g._id}>
        <div className="flex flex-wrap items-start justify-between gap-2 p-5 pb-3">
          <h2 className="font-semibold">{g.name}</h2>
          <div className="flex gap-1.5"><Badge tone="soft">{g.priority} priority</Badge><Badge tone={g.status === "active" ? "soft" : g.status === "paused" ? "warning" : "success"} className="capitalize">{g.status}</Badge></div>
        </div>
        <div className="px-5 pb-5">
          <p className="tnum text-2xl font-bold tracking-tight">{money(g.currentAmount)}</p>
          <p className="mb-3 text-sm text-muted">of {money(g.targetAmount)}</p>
          <ProgressBar value={g.currentAmount / g.targetAmount * 100} />
          <div className="mt-3 space-y-0.5 text-xs text-muted">
            <p><b className="tnum">{money(g.monthlyTarget || 0)}</b> monthly target</p>
            <p>{g.estimatedMonths != null ? `Estimated in ${g.estimatedMonths} month${g.estimatedMonths === 1 ? "" : "s"}` : "Set a monthly target for an estimate"}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] font-semibold text-muted">
            <button className="text-brand" onClick={() => { setSelected(g); setModal("contribute") }}>Contribute</button>
            <button className="text-info" onClick={() => { setSelected(g); setModal("withdraw") }}>Withdraw</button>
            <button className="text-muted" onClick={() => { setSelected(g); setModal("simulate"); setSim(null) }}>Simulate</button>
            <button onClick={() => { setSelected(g); setModal("goal") }}>Edit</button>
            <button onClick={() => save.mutate({ id: g._id, body: { status: g.status === "paused" ? "active" : "paused" } })}>{g.status === "paused" ? "Resume" : "Pause"}</button>
            <button className="text-danger" onClick={() => confirm("Archive this goal?") && archive.mutate(g._id)}>Archive</button>
          </div>
        </div>
      </article>)}</div> : <EmptyState icon={<Target size={20} />} title="No savings goals yet" body="Give a future milestone a name, a number, and a monthly plan." action={<button className="btn btn-primary btn-sm" onClick={() => { setSelected(null); setModal("goal") }}>+ New goal</button>} />}
    {modal === "goal" && <Modal title={selected ? "Edit goal" : "New goal"} onClose={() => setModal(null)}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); save.mutate({ id: selected?._id, body: { name: f.get("name"), targetAmount: Number(f.get("targetAmount")), targetDate: f.get("targetDate") || undefined, priority: f.get("priority"), monthlyTarget: Number(f.get("monthlyTarget") || 0), status: selected?.status } }) }}>
        <Field label="Goal name"><input className="field" name="name" defaultValue={selected?.name} required /></Field>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field label="Target amount (₹)"><input className="field tnum" name="targetAmount" type="number" min="1" defaultValue={selected?.targetAmount} required /></Field>
          <Field label="Monthly target"><input className="field tnum" name="monthlyTarget" type="number" min="0" defaultValue={selected?.monthlyTarget} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field label="Priority"><select className="field" name="priority" defaultValue={selected?.priority || "medium"}><option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option></select></Field>
          <Field label="Target date"><input className="field" name="targetDate" type="date" defaultValue={selected?.targetDate?.slice(0, 10)} /></Field>
        </div>
        {save.error && <Alert tone="danger">{save.error.message}</Alert>}
        <button className="btn btn-primary w-full">Save goal</button>
      </form>
    </Modal>}
    {(modal === "contribute" || modal === "withdraw") && selected && <Modal title={`${actionLabel[modal]} ${selected.name}`} onClose={() => setModal(null)}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget), common = { amount: Number(f.get("amount")), accountId: f.get("accountId"), date: f.get("date") }; move.mutate(modal === "withdraw" ? { withdraw: true, body: common } : { withdraw: false, body: { type: "saving", title: `${selected.name} contribution`, amount: common.amount, accountId: common.accountId, goalId: selected._id, transactionDate: common.date } }) }}>
        <Field label="Amount (₹)"><input className="field tnum" name="amount" type="number" min=".01" required /></Field>
        <Field label={modal === "withdraw" ? "To account" : "From account"}><select className="field" name="accountId" required><option value="">Select account</option>{accounts.data?.filter(a => a.isActive).map(a => <option value={a._id} key={a._id}>{a.name}</option>)}</select></Field>
        <Field label="Date"><input className="field" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></Field>
        {move.error && <Alert tone="danger">{move.error.message}</Alert>}
        <button className="btn btn-primary w-full">Record {modal}</button>
      </form>
    </Modal>}
    {modal === "simulate" && selected && <Modal title={`Simulate: ${selected.name}`} onClose={() => setModal(null)}>
      <div className="space-y-4">
        <p className="text-sm text-muted">Simulation only — it does not change your actual goal.</p>
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); simulate.mutate({ required: false, b: { goalId: selected._id, monthlyContribution: Number(f.get("contribution")) } }) }}>
          <label className="label">If I save this monthly — when will I reach the goal?</label>
          <div className="flex gap-2"><input name="contribution" type="number" min="0" step="0.01" placeholder="Monthly contribution" required className="field flex-1" /><button className="btn btn-primary" disabled={simulate.isPending}>Simulate</button></div>
        </form>
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); simulate.mutate({ required: true, b: { goalId: selected._id, targetDate: f.get("targetDate") } }) }}>
          <label className="label">To reach the goal by this date — what should I save monthly?</label>
          <div className="flex gap-2"><input name="targetDate" type="date" required className="field flex-1" /><button className="btn btn-primary" disabled={simulate.isPending}>Calculate</button></div>
        </form>
        {simulate.error && <Alert tone="danger">{simulate.error.message}</Alert>}
        {sim && <div className="rounded-xl border border-edge bg-panel p-4 text-sm">
          {sim.monthlyContribution > 0 && <p>Monthly contribution: <b className="tnum">{money(sim.monthlyContribution)}</b></p>}
          {sim.requiredMonthly != null && <p>Required monthly: <b className="tnum">{money(sim.requiredMonthly)}</b></p>}
          {sim.monthsToReach != null && <p>Time to reach: <b>{sim.monthsToReach} month{sim.monthsToReach === 1 ? "" : "s"}</b></p>}
          {sim.estimatedDate && <p>Estimated completion: <b>{new Date(sim.estimatedDate).toLocaleDateString("en-IN")}</b></p>}
        </div>}
      </div>
    </Modal>}
  </Page>;
}