"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, money } from "@/lib/api";
import type { Account, Category, Recurring } from "@/lib/types";
import { Page } from "@/components/page";
import { Modal } from "@/components/modal";
import { Alert, Badge, EmptyState, ErrorState, Field, Section, Skeleton } from "@/components/ui";
import { Repeat2, CalendarClock } from "lucide-react";

export default function RecurringPage() {
  const qc = useQueryClient(), [show, setShow] = useState(false);
  const q = useQuery({ queryKey: ["recurring"], queryFn: () => api<Recurring[]>("/recurring") }), accounts = useQuery({ queryKey: ["accounts"], queryFn: () => api<Account[]>("/accounts") }), categories = useQuery({ queryKey: ["categories"], queryFn: () => api<Category[]>("/categories") });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["recurring"] }); qc.invalidateQueries({ queryKey: ["transactions"] }); qc.invalidateQueries({ queryKey: ["accounts"] }) };
  const create = useMutation({ mutationFn: (b: unknown) => api("/recurring", { method: "POST", body: JSON.stringify(b) }), onSuccess: () => { refresh(); setShow(false) } }), disable = useMutation({ mutationFn: (id: string) => api(`/recurring/${id}`, { method: "DELETE" }), onSuccess: refresh }), process = useMutation({ mutationFn: () => api<{ generated: number }>("/recurring/process", { method: "POST" }), onSuccess: refresh });
  return <Page title="Bills & recurring" description="Schedule predictable income, transfers, bills, subscriptions, and SIPs." action={<div className="flex gap-2"><button className="btn btn-secondary" disabled={process.isPending} onClick={() => process.mutate()}><Repeat2 size={16} />Process due</button><button className="btn btn-primary" onClick={() => setShow(true)}>+ New schedule</button></div>}>
    {process.data && <Alert tone="success" className="mb-5">Generated {process.data.generated} due transaction(s).</Alert>}
    {process.error && <Alert tone="danger" className="mb-5">{process.error.message}</Alert>}
    {q.isLoading ? <div className="card space-y-0">{[0, 1, 2].map(i => <div className="flex gap-4 border-b border-edge p-5 last:border-0" key={i}><Skeleton className="size-10" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-24" /></div>)}</div>
      : q.error ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      : q.data?.length ? <div className="card divide-y divide-edge overflow-hidden">{q.data.map(x => <article className={"grid items-center gap-x-4 px-5 py-4 sm:grid-cols-[auto_1fr_auto] " + (!x.isActive ? "opacity-60" : "")} key={x._id}>
        <div className="flex items-start justify-between sm:block">
          <div className="grid size-10 place-items-center rounded-xl bg-brandSoft text-brand"><CalendarClock size={20} /></div>
          <span className="sm:hidden"><Badge tone={x.isBill ? "warning" : x.type === "income" ? "success" : "neutral"}>{x.isBill ? "Bill" : x.type}</Badge></span>
        </div>
        <div className="min-w-0 max-sm:mt-3">
          <div className="flex items-center gap-2"><h2 className="truncate font-semibold">{x.title}</h2><span className="hidden sm:inline-flex"><Badge tone={x.isBill ? "warning" : x.type === "income" ? "success" : "neutral"}>{x.isBill ? "Bill" : x.type}</Badge></span></div>
          <p className="tnum mt-1 font-bold sm:hidden">{money(x.amount)}</p>
          <p className="mt-2 text-sm capitalize text-muted">{x.frequency} · Next {new Date(x.nextRunDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
          <p className="text-xs text-muted">{x.accountId.name} · {x.autoCreate ? "Auto-create enabled" : "Reminder only"}</p>
          {x.isActive && <button className="mt-2 text-[13px] font-semibold text-danger transition-colors hover:text-brandStrong sm:hidden" onClick={() => disable.mutate(x._id)}>Deactivate</button>}
        </div>
        <div className="hidden shrink-0 text-right sm:block"><p className="tnum font-bold">{money(x.amount)}</p><p className="text-xs text-muted">{x.autoCreate ? "Auto-create" : "Reminder"}</p>{x.isActive && <button className="mt-1 text-xs font-semibold text-danger" onClick={() => disable.mutate(x._id)}>Deactivate</button>}</div>
      </article>)}</div> : <EmptyState icon={<Repeat2 size={20} />} title="No recurring items yet" body="Schedule your salary, rent, EMIs, subscriptions, and SIPs so they run themselves." action={<button className="btn btn-primary btn-sm" onClick={() => setShow(true)}>+ New schedule</button>} />}
    {show && <Modal title="New recurring item" onClose={() => setShow(false)}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget), start = String(f.get("startDate")); create.mutate({ title: f.get("title"), type: f.get("type"), amount: Number(f.get("amount")), accountId: f.get("accountId"), categoryId: f.get("categoryId") || undefined, destinationAccountId: f.get("destinationAccountId") || undefined, frequency: f.get("frequency"), startDate: start, nextRunDate: start, endDate: f.get("endDate") || undefined, notes: f.get("notes") || undefined, isBill: f.get("isBill") === "on", autoCreate: f.get("autoCreate") === "on" }) }}>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field label="Title"><input className="field" name="title" required /></Field>
          <Field label="Amount (₹)"><input className="field tnum" name="amount" type="number" min=".01" required /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field label="Type"><select className="field" name="type">{["income", "expense", "saving", "investment", "transfer"].map(x => <option key={x} className="capitalize">{x}</option>)}</select></Field>
          <Field label="Frequency"><select className="field" name="frequency">{["daily", "weekly", "monthly", "yearly"].map(x => <option key={x} className="capitalize">{x}</option>)}</select></Field>
        </div>
        <Field label="Payment/source account"><select className="field" name="accountId" required><option value="">Select</option>{accounts.data?.filter(a => a.isActive).map(a => <option value={a._id} key={a._id}>{a.name}</option>)}</select></Field>
        <Field label="Destination account"><select className="field" name="destinationAccountId"><option value="">None</option>{accounts.data?.filter(a => a.isActive).map(a => <option value={a._id} key={a._id}>{a.name}</option>)}</select></Field>
        <Field label="Category"><select className="field" name="categoryId"><option value="">None</option>{categories.data?.map(c => <option value={c._id} key={c._id}>{c.name}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field label="First run"><input className="field" name="startDate" type="date" required /></Field>
          <Field label="End date"><input className="field" name="endDate" type="date" /></Field>
        </div>
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="isBill" className="size-4 accent-[var(--brand)]" />Bill or subscription</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="autoCreate" defaultChecked className="size-4 accent-[var(--brand)]" />Automatically create transactions</label>
        </div>
        <Field label="Notes"><textarea className="field" name="notes" rows={2} /></Field>
        {create.error && <Alert tone="danger">{create.error.message}</Alert>}
        <button className="btn btn-primary w-full">Create schedule</button>
      </form>
    </Modal>}
  </Page>;
}
