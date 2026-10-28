"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, money } from "@/lib/api";
import type { Account, Liability } from "@/lib/types";
import { Page } from "@/components/page";
import { Modal } from "@/components/modal";
import { Alert, Badge, EmptyState, ErrorState, Field, MetricCard, ProgressBar, Skeleton } from "@/components/ui";
import { Landmark } from "lucide-react";

export default function Liabilities() {
  const qc = useQueryClient(), [modal, setModal] = useState<"new" | "pay" | null>(null), [selected, setSelected] = useState<Liability | null>(null);
  const q = useQuery({ queryKey: ["liabilities"], queryFn: () => api<Liability[]>("/liabilities") }), accounts = useQuery({ queryKey: ["accounts"], queryFn: () => api<Account[]>("/accounts") });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["liabilities"] }); qc.invalidateQueries({ queryKey: ["accounts"] }); qc.invalidateQueries({ queryKey: ["net-worth"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }) };
  const create = useMutation({ mutationFn: (b: unknown) => api("/liabilities", { method: "POST", body: JSON.stringify(b) }), onSuccess: () => { refresh(); setModal(null) } }), pay = useMutation({ mutationFn: (b: unknown) => api(`/liabilities/${selected!._id}/payments`, { method: "POST", body: JSON.stringify(b) }), onSuccess: () => { refresh(); setModal(null) } });
  const total = q.data?.reduce((s, x) => s + x.outstandingAmount, 0) || 0;
  return <Page title="Liabilities" description="Loans, EMIs, credit cards, and borrowed money." action={<button className="btn btn-primary" onClick={() => setModal("new")}>+ Add liability</button>}>
    {q.isLoading ? <><MetricCard label="Total outstanding debt" value="—" /><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-56" />)}</div></>
      : q.error ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      : <>
        <div className="mb-5 grid gap-4 md:grid-cols-3">
          <MetricCard label="Total outstanding debt" value={money(total)} tone="danger" hint={<span className="text-xs text-muted">Across {q.data?.length || 0} liability{q.data?.length === 1 ? "" : "ies"}</span>} />
          <MetricCard label="Active liabilities" value={q.data?.filter(x => x.status === "active").length || 0} />
          <MetricCard label="Payments scheduled by day" value={q.data?.filter(x => x.paymentDay).length || 0} />
        </div>
        {q.data?.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{q.data.map(x => { const paid = x.originalAmount ? 100 - x.outstandingAmount / x.originalAmount * 100 : 0; return <article className="card !p-0" key={x._id}>
          <div className="flex items-start justify-between p-5 pb-3">
            <h2 className="font-semibold">{x.name}</h2>
            <Badge tone={x.status === "active" ? "warning" : "success"} className="capitalize">{x.status}</Badge>
          </div>
          <div className="px-5 pb-5">
            <p className="text-sm capitalize text-muted">{x.type}{x.lender ? ` · ${x.lender}` : ""}</p>
            <p className="tnum mt-3 text-2xl font-bold tracking-tight">{money(x.outstandingAmount)}</p>
            <p className="text-xs text-muted">of {money(x.originalAmount)} outstanding</p>
            <div className="mt-3"><ProgressBar value={paid} showLabel /></div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted"><span className="tnum">{x.interestRate || 0}% interest</span><span>{x.emiAmount ? `${money(x.emiAmount)} EMI` : "No EMI"}</span></div>
            {x.type === "credit card" && <p className="mt-2 text-xs text-muted">Available: <b className="tnum">{money(Math.max(0, (x.creditLimit || 0) - x.outstandingAmount))}</b></p>}
            {x.status === "active" && <button className="btn btn-secondary mt-4 w-full" onClick={() => { setSelected(x); setModal("pay") }}>Record payment</button>}
          </div>
        </article>})}</div> : <EmptyState icon={<Landmark size={20} />} title="No liabilities recorded" body="Add a loan or credit card to make your net worth complete." action={<button className="btn btn-primary btn-sm" onClick={() => setModal("new")}>+ Add liability</button>} />}
      </>}
    {modal === "new" && <Modal title="Add liability" onClose={() => setModal(null)}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget), original = Number(f.get("originalAmount")); create.mutate({ name: f.get("name"), type: f.get("type"), lender: f.get("lender") || undefined, originalAmount: original, outstandingAmount: Number(f.get("outstandingAmount") || original), interestRate: Number(f.get("interestRate") || 0), emiAmount: Number(f.get("emiAmount") || 0), paymentDay: f.get("paymentDay") ? Number(f.get("paymentDay")) : undefined, creditLimit: f.get("creditLimit") ? Number(f.get("creditLimit")) : undefined }) }}>
        <Field label="Liability name"><input className="field" name="name" placeholder="e.g. Home loan" required /></Field>
        <Field label="Type"><select className="field" name="type">{["personal loan", "education loan", "vehicle loan", "home loan", "credit card", "borrowed money", "EMI", "other"].map(x => <option key={x} className="capitalize">{x}</option>)}</select></Field>
        <Field label="Lender"><input className="field" name="lender" placeholder="Optional" /></Field>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field label="Original amount"><input className="field tnum" name="originalAmount" type="number" min="0" required /></Field>
          <Field label="Outstanding now"><input className="field tnum" name="outstandingAmount" type="number" min="0" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field label="Interest %"><input className="field tnum" name="interestRate" type="number" min="0" step=".01" /></Field>
          <Field label="EMI amount"><input className="field tnum" name="emiAmount" type="number" min="0" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field label="Payment day (1–31)"><input className="field tnum" name="paymentDay" type="number" min="1" max="31" /></Field>
          <Field label="Credit limit"><input className="field tnum" name="creditLimit" type="number" min="0" /></Field>
        </div>
        {create.error && <Alert tone="danger">{create.error.message}</Alert>}
        <button className="btn btn-primary w-full">Add liability</button>
      </form>
    </Modal>}
    {modal === "pay" && selected && <Modal title={`Pay ${selected.name}`} onClose={() => setModal(null)}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); pay.mutate({ amount: Number(f.get("amount")), principalAmount: f.get("principalAmount") ? Number(f.get("principalAmount")) : undefined, interestAmount: Number(f.get("interestAmount") || 0), accountId: f.get("accountId"), date: f.get("date") }) }}>
        <Field label="Total payment"><input className="field tnum" name="amount" type="number" min=".01" required /></Field>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field label="Principal"><input className="field tnum" name="principalAmount" type="number" min="0" placeholder="Optional" /></Field>
          <Field label="Interest"><input className="field tnum" name="interestAmount" type="number" min="0" /></Field>
        </div>
        <Field label="Payment account"><select className="field" name="accountId" required><option value="">Select</option>{accounts.data?.filter(a => a.isActive).map(a => <option value={a._id} key={a._id}>{a.name}</option>)}</select></Field>
        <Field label="Date"><input className="field" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></Field>
        <p className="text-xs text-muted">Debt payments reduce cash and outstanding debt without being counted as lifestyle expenses.</p>
        {pay.error && <Alert tone="danger">{pay.error.message}</Alert>}
        <button className="btn btn-primary w-full">Record payment</button>
      </form>
    </Modal>}
  </Page>;
}