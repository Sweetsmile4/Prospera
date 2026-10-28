"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, Wallet, Landmark, Pencil, Eye } from "lucide-react";
import { api, money } from "@/lib/api";
import { Page } from "@/components/page";
import { Modal } from "@/components/modal";
import { Alert, Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import type { Account, Tx } from "@/lib/types";

const typeIcon = (t: string) => t === "cash" ? <Wallet size={19} /> : t === "bank" ? <Landmark size={19} /> : <Building2 size={19} />;

export default function Accounts() {
  const qc = useQueryClient(), [mode, setMode] = useState<"create" | "edit" | "view" | null>(null), [selected, setSelected] = useState<Account | null>(null);
  const q = useQuery({ queryKey: ["accounts"], queryFn: () => api<Account[]>("/accounts") });
  const detail = useQuery({ queryKey: ["account", selected?._id], queryFn: () => api<{ account: Account; transactions: Tx[]; totals: Record<string, number>; monthlyCashFlow: { _id: string; income: number; outflow: number }[] }>(`/accounts/${selected!._id}`), enabled: mode === "view" && !!selected });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["accounts"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); if (selected) qc.invalidateQueries({ queryKey: ["account", selected._id] }) };
  const save = useMutation({ mutationFn: ({ id, body }: { id?: string; body: unknown }) => api(id ? `/accounts/${id}` : "/accounts", { method: id ? "PUT" : "POST", body: JSON.stringify(body) }), onSuccess: () => { refresh(); setMode(null); setSelected(null) } });
  const state = useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => api(`/accounts/${id}`, active ? { method: "PUT", body: JSON.stringify({ isActive: true }) } : { method: "DELETE" }), onSuccess: refresh });
  const open = (next: "create" | "edit" | "view", account: Account | null) => { setSelected(account); setMode(next) };
  const submit = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); save.mutate({ id: mode === "edit" ? selected!._id : undefined, body: { name: f.get("name"), type: f.get("type"), institutionName: f.get("institutionName") || undefined, ...(mode === "create" ? { openingBalance: Number(f.get("openingBalance")) } : {}) } }) };
  return <Page title="Accounts" description="Every place your money lives." action={<button className="btn btn-primary" onClick={() => { setSelected(null); setMode("create") }}>+ Add account</button>}>
    {q.isLoading ? <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-44" />)}</div>
      : q.error ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      : q.data?.length ? <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{q.data.map(a => <article className={"card !p-0 " + (!a.isActive ? "opacity-60" : "")} key={a._id}>
        <div className="flex items-start justify-between p-5 pb-4">
          <div className="grid size-10 place-items-center rounded-xl bg-brandSoft text-brand">{typeIcon(a.type)}</div>
          <Badge tone={a.isActive ? "soft" : "neutral"} className="capitalize">{a.isActive ? a.type : "Inactive"}</Badge>
        </div>
        <div className="px-5 pb-5">
          <h2 className="font-semibold">{a.name}</h2>
          <p className="text-sm text-muted">{a.institutionName || a.type}</p>
          <p className="tnum mt-3 text-2xl font-bold tracking-tight">{money(a.currentBalance)}</p>
          <div className="mt-5 flex items-center gap-4 text-[13px] font-semibold">
            <button className="flex items-center gap-1.5 text-brand transition-colors hover:text-brandStrong" onClick={() => open("view", a)}><Eye size={14} />Details</button>
            <button className="flex items-center gap-1.5 text-muted transition-colors hover:text-ink" onClick={() => open("edit", a)}><Pencil size={14} />Edit</button>
            <button className={a.isActive ? "text-danger transition-colors hover:text-brandStrong" : "text-brand"} onClick={() => state.mutate({ id: a._id, active: !a.isActive })}>{a.isActive ? "Deactivate" : "Activate"}</button>
          </div>
        </div>
      </article>)}</div> : <EmptyState title="No accounts yet" body="Add the first place you keep money." action={<button className="btn btn-primary btn-sm" onClick={() => open("create", null)}>+ Add account</button>} />}
    {(mode === "create" || mode === "edit") && <Modal title={mode === "create" ? "Add account" : "Edit account"} onClose={() => setMode(null)}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block"><span className="label">Account name</span><input name="name" className="field" placeholder="e.g. Salary account" defaultValue={selected?.name} required /></label>
        <label className="block"><span className="label">Type</span><select name="type" className="field" defaultValue={selected?.type || "bank"}>{["bank", "cash", "wallet", "savings", "investment"].map(x => <option key={x} className="capitalize">{x}</option>)}</select></label>
        <label className="block"><span className="label">Institution</span><input name="institutionName" className="field" placeholder="Optional" defaultValue={selected?.institutionName} /></label>
        {mode === "create" && <label className="block"><span className="label">Opening balance</span><input name="openingBalance" type="number" step="0.01" defaultValue="0" className="field tnum" required /></label>}
        {save.error && <Alert tone="danger">{save.error.message}</Alert>}
        <button className="btn btn-primary w-full">{mode === "create" ? "Create account" : "Save changes"}</button>
      </form>
    </Modal>}
    {mode === "view" && selected && <Modal title={selected.name} onClose={() => setMode(null)}>
      <div className="mb-5 rounded-xl bg-panel p-4">
        <p className="text-sm text-muted">Current balance</p>
        <p className="tnum text-2xl font-bold tracking-tight">{money(selected.currentBalance)}</p>
      </div>
      <h3 className="mb-3 font-semibold">Recent account activity</h3>
      {detail.isLoading ? <Skeleton className="h-24" /> : detail.data?.transactions.length ? <div className="-mx-2 space-y-2">{detail.data.transactions.map(t => <div className="flex justify-between gap-3 rounded-lg border border-edge bg-surface p-3" key={t._id}><div className="min-w-0"><p className="truncate text-sm font-medium">{t.title}</p><p className="text-xs text-muted">{new Date(t.transactionDate).toLocaleDateString("en-IN")} · {t.type}</p></div><p className={"tnum shrink-0 text-sm font-semibold " + (t.type === "income" ? "text-success" : t.type === "expense" ? "text-danger" : "text-info")}>{money(t.amount)}</p></div>)}</div> : <p className="py-6 text-center text-sm text-muted">No transactions for this account.</p>}
    </Modal>}
  </Page>;
}
