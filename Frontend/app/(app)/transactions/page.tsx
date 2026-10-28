"use client";
import { TransactionFormV2 } from "@/components/transaction-form-v2";
import { TransactionDetailsV2 } from "@/components/transaction-details-v2";
import { ExportTransactions } from "@/components/export-transactions";
import { NeedsAttention } from "@/components/needs-attention";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api, money } from "@/lib/api";
import type { Account, Category, Goal, Tx } from "@/lib/types";
import { Page } from "@/components/page";
import { Modal } from "@/components/modal";
import { Badge, Chip, EmptyState, ErrorState, Skeleton, cx } from "@/components/ui";
import { Trash2, Pencil, Eye, Search, SlidersHorizontal, ArrowDownLeft, ArrowUpRight, PiggyBank, TrendingUp } from "lucide-react";

const types = ["all", "income", "expense", "saving", "investment", "transfer"] as const;
type Result = { items: Tx[]; total: number; page: number; pages: number };

const amountClass = (t: Tx) => `tnum font-semibold ${t.type === "income" ? "text-success" : t.type === "expense" ? "text-danger" : "text-info"}`;
const amountText = (t: Tx) => `${t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}${money(t.amount)}`;
const typeBadge: Record<Tx["type"], "success" | "danger" | "info" | "soft" | "neutral"> = { income: "success", expense: "danger", saving: "info", investment: "info", transfer: "neutral" };

export default function Transactions() {
  const sp = useSearchParams(), qc = useQueryClient();
  const [workspaceView, setWorkspaceView] = useState<"all" | "attention">("all");
  const [modal, setModal] = useState<"create" | "edit" | "view" | null>(null), [selected, setSelected] = useState<Tx | null>(null), [type, setTypeState] = useState("all"), [formType, setFormType] = useState("expense"), [page, setPage] = useState(1), [filters, setFiltersState] = useState({ search: "", accountId: "", categoryId: "", from: "", to: "", minAmount: "", maxAmount: "", source: "", tag: "", sort: "newest" }), [filtersOpen, setFiltersOpen] = useState(false);
  const [newRequest, setNewRequest] = useState<string | null>(null);
  if (sp.get("new") !== newRequest) { setNewRequest(sp.get("new")); if (sp.get("new")) setModal("create"); }
  const setType = (value: string) => { setTypeState(value); setPage(1) };
  const setFilters = (value: typeof filters) => { setFiltersState(value); setPage(1) };
  const query = useMemo(() => new URLSearchParams({ type, page: String(page), limit: "20", ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }).toString(), [type, page, filters]);
  const q = useQuery({ queryKey: ["transactions", query], queryFn: () => api<Result>(`/transactions?${query}`) }), summary = useQuery({ queryKey: ["transaction-summary"], queryFn: () => api<Record<string, number>>("/transactions/summary/totals") }), aq = useQuery({ queryKey: ["accounts"], queryFn: () => api<Account[]>("/accounts") }), cq = useQuery({ queryKey: ["categories"], queryFn: () => api<Category[]>("/categories") }), gq = useQuery({ queryKey: ["goals"], queryFn: () => api<Goal[]>("/goals") });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["transactions"] }); qc.invalidateQueries({ queryKey: ["transaction-summary"] }); qc.invalidateQueries({ queryKey: ["accounts"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); qc.invalidateQueries({ queryKey: ["budgets"] }); qc.invalidateQueries({ queryKey: ["goals"] }); qc.invalidateQueries({ queryKey: ["net-worth"] }) };
  const save = useMutation({ mutationFn: ({ id, body }: { id?: string; body: unknown }) => api(id ? `/transactions/${id}` : "/transactions", { method: id ? "PUT" : "POST", body: JSON.stringify(body) }), onSuccess: () => { refresh(); setModal(null); setSelected(null) } }), del = useMutation({ mutationFn: (id: string) => api(`/transactions/${id}`, { method: "DELETE" }), onSuccess: refresh });
  const open = (mode: "edit" | "view", t: Tx) => { setSelected(t); setFormType(t.type); setModal(mode) };
  const submit = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget), body: any = { type: f.get("type"), title: f.get("title"), amount: Number(f.get("amount")), accountId: f.get("accountId"), transactionDate: f.get("transactionDate"), description: f.get("description"), source: selected?.source || "manual", tags: String(f.get("tags") || "").split(",").map(x => x.trim().replace(/^#/, "").toLowerCase()).filter(Boolean), referenceNumber: f.get("referenceNumber") || undefined }; for (const k of ["destinationAccountId", "categoryId", "goalId"]) if (f.get(k)) body[k] = f.get(k); save.mutate({ id: modal === "edit" ? selected!._id : undefined, body }) };
  const cats = cq.data?.filter(c => c.type === (formType === "income" ? "income" : formType === "investment" ? "investment" : "expense"));
  const summaryItems = [
    ["Income", "income", "bg-successSoft text-success", <ArrowDownLeft size={17} key="income" />],
    ["Expenses", "expense", "bg-dangerSoft text-danger", <ArrowUpRight size={17} key="expense" />],
    ["Savings", "saving", "bg-warningSoft text-warning", <PiggyBank size={17} key="saving" />],
    ["Investments", "investment", "bg-infoSoft text-info", <TrendingUp size={17} key="investment" />],
  ] as const;
  const iconInput = "relative";
  return <Page title="Transactions" description="One accurate timeline of every financial movement." action={<div className="flex flex-wrap gap-2"><ExportTransactions /><Link className="btn btn-secondary" href="/transactions/import">Import statement</Link><button className="btn btn-primary" onClick={() => { setSelected(null); setFormType("expense"); setModal("create") }}>+ Add transaction</button></div>}>
    <div className="card mb-5 flex divide-x divide-edge overflow-x-auto px-5">
      {summaryItems.map(([label, key, tone, icon]) => <div key={key} className="flex min-w-[180px] flex-1 items-center gap-3 px-5 py-4 first:pl-0 last:pr-0">
        <span className={cx("grid size-9 shrink-0 place-items-center rounded-full", tone)}>{icon}</span>
        <div><p className="text-xs text-muted">{label}</p><p className="tnum text-lg font-bold tracking-tight">{money(Number(summary.data?.[key] || 0))}</p></div>
      </div>)}
    </div>
    <div className="mb-5 flex w-fit rounded-lg border border-edge bg-panel p-1" role="tablist" aria-label="Transaction views">
      <button role="tab" aria-selected={workspaceView === "all"} className={cx("rounded-md px-4 py-2 text-sm font-semibold transition-colors", workspaceView === "all" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink")} onClick={() => setWorkspaceView("all")}>All</button>
      <button role="tab" aria-selected={workspaceView === "attention"} className={cx("rounded-md px-4 py-2 text-sm font-semibold transition-colors", workspaceView === "attention" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink")} onClick={() => setWorkspaceView("attention")}>Needs Attention</button>
    </div>
    {workspaceView === "attention" ? <NeedsAttention onEdit={(t) => open("edit", t)} /> : <>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-2 overflow-x-auto pb-1">{types.map(t => <Chip key={t} active={type === t} onClick={() => setType(t)} className="capitalize">{t}</Chip>)}</div>
      <button className="btn btn-secondary btn-sm" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={15} />Filters</button>
    </div>
    {filtersOpen && <div className="card mb-5 grid gap-3 p-5 md:grid-cols-3 xl:grid-cols-6">
      <label className={iconInput}><Search className="pointer-events-none absolute left-3 top-3 text-muted" size={16} /><input className="field pl-9" placeholder="Title, notes, tag, reference" value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} /></label>
      <select className="field" value={filters.accountId} onChange={e => setFilters({ ...filters, accountId: e.target.value })}><option value="">All accounts</option>{aq.data?.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}</select>
      <select className="field" value={filters.categoryId} onChange={e => setFilters({ ...filters, categoryId: e.target.value })}><option value="">All categories</option>{cq.data?.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
      <select className="field" value={filters.source} onChange={e => setFilters({ ...filters, source: e.target.value })}><option value="">All sources</option><option value="manual">Manual</option><option value="recurring">Recurring</option><option value="import">Import</option></select>
      <input className="field" placeholder="Tag" value={filters.tag} onChange={e => setFilters({ ...filters, tag: e.target.value.replace(/^#/, "") })} />
      <select className="field" value={filters.sort} onChange={e => setFilters({ ...filters, sort: e.target.value })}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="highest">Highest amount</option><option value="lowest">Lowest amount</option></select>
      <input aria-label="From date" className="field" type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} />
      <input aria-label="To date" className="field" type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} />
      <input aria-label="Minimum amount" className="field" type="number" placeholder="Min amount" value={filters.minAmount} onChange={e => setFilters({ ...filters, minAmount: e.target.value })} />
      <input aria-label="Maximum amount" className="field" type="number" placeholder="Max amount" value={filters.maxAmount} onChange={e => setFilters({ ...filters, maxAmount: e.target.value })} />
      <button className="text-sm font-semibold text-muted transition-colors hover:text-ink" onClick={() => setFilters({ search: "", accountId: "", categoryId: "", from: "", to: "", minAmount: "", maxAmount: "", source: "", tag: "", sort: "newest" })}>Clear filters</button>
    </div>}
    {q.isLoading ? <div className="card space-y-0">
      {[0, 1, 2, 3, 4].map(i => <div className="flex items-center gap-4 border-b border-edge px-5 py-4 last:border-b-0" key={i}><Skeleton className="h-3.5 w-24" /><Skeleton className="h-3.5 w-48" /><Skeleton className="h-3.5 w-20" /></div>)}
    </div>
      : q.error ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      : q.data?.items.length ? <>
        <div className="card hidden overflow-x-auto !p-0 md:block">
          <table className="w-full min-w-[820px]">
            <thead><tr><th>Date</th><th>Title</th><th>Category</th><th>Account</th><th>Type</th><th className="numeric">Amount</th><th className="text-right">Actions</th></tr></thead>
            <tbody>{q.data.items.map(t => <tr key={t._id}>
              <td className="whitespace-nowrap text-sm text-muted">{new Date(t.transactionDate).toLocaleDateString("en-IN")}</td>
              <td className="font-medium">{t.title}{t.type === "transfer" && <div className="text-xs text-muted">{t.accountId.name} → {t.destinationAccountId?.name}</div>}</td>
              <td className="text-muted">{t.categoryId?.name || "—"}</td>
              <td className="text-sm text-muted">{t.accountId.name}</td>
              <td><Badge tone={typeBadge[t.type]} className="capitalize">{t.type}</Badge></td>
              <td className={amountClass(t)}>{amountText(t)}</td>
              <td><div className="flex justify-end gap-1 text-muted">
                <button className="btn-icon" aria-label="View" onClick={() => open("view", t)}><Eye size={16} /></button>
                <button className="btn-icon" aria-label="Edit" onClick={() => open("edit", t)}><Pencil size={15} /></button>
                <button className="btn-icon hover:!bg-dangerSoft hover:!text-danger" aria-label="Delete" onClick={() => confirm("Delete and reverse this transaction?") && del.mutate(t._id)}><Trash2 size={16} /></button>
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="space-y-3 md:hidden">{q.data.items.map(t => <article className="card !p-0" key={t._id}>
          <div className="flex items-start justify-between gap-3 p-4 pb-2">
            <div className="min-w-0"><p className="font-semibold">{t.title}</p><p className="mt-0.5 text-xs text-muted">{new Date(t.transactionDate).toLocaleDateString("en-IN")} · {t.accountId.name}</p></div>
            <p className={amountClass(t)}>{amountText(t)}</p>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-edge px-4 py-2.5">
            <Badge tone={typeBadge[t.type]} className="capitalize">{t.type}</Badge>
            <div className="flex gap-1 text-muted">
              <button className="btn-icon" aria-label="View" onClick={() => open("view", t)}><Eye size={16} /></button>
              <button className="btn-icon" aria-label="Edit" onClick={() => open("edit", t)}><Pencil size={15} /></button>
              <button className="btn-icon hover:!bg-dangerSoft hover:!text-danger" aria-label="Delete" onClick={() => confirm("Delete and reverse this transaction?") && del.mutate(t._id)}><Trash2 size={16} /></button>
            </div>
          </div>
        </article>)}</div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">{q.data.total} transactions · Page {q.data.page} of {Math.max(1, q.data.pages)}</p>
          <div className="flex gap-2"><button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="btn btn-secondary btn-sm" disabled={page >= q.data.pages} onClick={() => setPage(page + 1)}>Next</button></div>
        </div>
      </> : <EmptyState icon={<Search size={18} />} title="No transactions match this view" body="Try clearing the filters, or add a transaction to get started." action={<button className="btn btn-primary btn-sm" onClick={() => { setSelected(null); setFormType("expense"); setModal("create") }}>+ Add transaction</button>} />}
    </>}
    {(modal === "create" || modal === "edit") && <Modal title={modal === "edit" ? "Edit transaction" : "Add transaction"} onClose={() => setModal(null)}><TransactionFormV2 key={selected?._id || "new"} selected={selected} formType={formType} setFormType={setFormType} accounts={aq.data || []} categories={cats || []} goals={gq.data || []} submit={submit} error={save.error?.message} /></Modal>}
    {modal === "view" && selected && <Modal title="Transaction details" onClose={() => setModal(null)}><TransactionDetailsV2 t={selected} /></Modal>}
  </Page>;
}
