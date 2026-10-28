"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, money } from "@/lib/api";
import type { Category, Tx } from "@/lib/types";
import { Check, Trash2, Eye, Tag } from "lucide-react";
import { Badge, Chip, Section, SkeletonLines } from "@/components/ui";

type Summary = { total: number; byFlag: Record<string, number> };
type Result = { items: Tx[]; total: number };
const FLAG_LABELS: Record<string, string> = { uncategorized: "Uncategorized", possible_duplicate: "Duplicate", possible_subscription: "Subscription", unusual: "Unusual", large_transaction: "Large amount" };
const FLAG_BADGE: Record<string, "warning" | "danger" | "info" | "success" | "neutral"> = { uncategorized: "warning", possible_duplicate: "info", possible_subscription: "success", unusual: "warning", large_transaction: "danger" };

export function NeedsAttention({ onEdit }: { onEdit?: (t: Tx) => void }) {
  const qc = useQueryClient();
  const [flag, setFlag] = useState("");
  const summary = useQuery({ queryKey: ["attention-summary"], queryFn: () => api<Summary>("/transactions/attention/summary") });
  const cq = useQuery({ queryKey: ["categories"], queryFn: () => api<Category[]>("/categories") });
  const items = useQuery({ queryKey: ["attention", flag], queryFn: () => api<Result>(flag ? `/transactions/attention?flag=${flag}&limit=20` : "/transactions/attention?limit=20"), enabled: !!summary.data });
  const refresh = () => { ["attention", "attention-summary", "transactions", "transaction-summary", "accounts", "dashboard", "net-worth"].forEach(k => qc.invalidateQueries({ queryKey: [k] })) };
  const resolve = useMutation({ mutationFn: (t: Tx) => api(`/transactions/${t._id}/attention/resolve`, { method: "POST", body: JSON.stringify({ flags: t.attentionFlags || [] }) }), onSuccess: refresh });
  const categorize = useMutation({ mutationFn: ({ t, categoryId }: { t: Tx; categoryId: string }) => api(`/transactions/${t._id}/attention/categorize`, { method: "POST", body: JSON.stringify({ categoryId }) }), onSuccess: refresh });
  const del = useMutation({ mutationFn: (id: string) => api(`/transactions/${id}`, { method: "DELETE" }), onSuccess: refresh });
  const total = summary.data?.total || 0;
  const handleCategorize = (t: Tx, categoryId: string) => { if (categoryId) categorize.mutate({ t, categoryId }) };
  return <Section title={<span className="flex items-center gap-2"><Tag size={17} className="text-brand" />Needs attention</span>} className="mb-5" action={total > 0 ? <Badge tone="warning">{total} flagged</Badge> : undefined}>
    {summary.isLoading ? <SkeletonLines lines={2} />
      : summary.error ? <p className="text-sm text-danger">We couldn&apos;t load transactions that need attention. Try again shortly.</p>
      : <>
        <div className="mb-4 flex flex-wrap gap-2">
          {([["", `All (${total})`], ...Object.entries(summary.data?.byFlag || {}).filter(([, n]) => n > 0).map(([k, n]) => [k, `${FLAG_LABELS[k] || k} (${n})`] as [string, string])] as [string, string][]).map(([k, label]) => <Chip key={k} active={flag === k} onClick={() => setFlag(k)}>{label}</Chip>)}
        </div>
        {items.isFetching && total > 0 && <SkeletonLines lines={2} />}
        {!items.isFetching && items.data?.items.length === 0 && <div className="py-4 text-center"><p className="text-sm text-muted">No transactions need attention — you are all caught up.</p></div>}
        {items.data?.items.map(t => <div key={t._id} className="flex flex-col gap-3 border-b border-edge py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-medium">{t.title}</p>
            <p className="text-xs text-muted">{new Date(t.transactionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {t.accountId.name}{t.categoryId ? ` · ${t.categoryId.name}` : ""}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{(t.attentionFlags || []).map(f => <Badge key={f} tone={FLAG_BADGE[f] || "neutral"}>{FLAG_LABELS[f] || f}</Badge>)}</div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 sm:justify-end">
            <p className={"tnum font-semibold " + (t.type === "income" ? "text-success" : t.type === "expense" ? "text-danger" : "text-info")}>{t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}{money(t.amount)}</p>
            {(t.attentionFlags || []).includes("uncategorized") && (t.type === "income" || t.type === "expense") && <select className="field w-40" defaultValue="" onChange={e => handleCategorize(t, e.target.value)} aria-label="Categorize"><option value="">Categorize…</option>{(cq.data || []).filter(c => c.type === (t.type === "income" ? "income" : "expense")).map(c => <option value={c._id} key={c._id}>{c.name}</option>)}</select>}
            {(t.attentionFlags || []).length > 0 && <button aria-label="Resolve flag" className="btn btn-secondary btn-sm" onClick={() => resolve.mutate(t)}><Check size={14} />Resolve</button>}
            <div className="flex gap-1 text-muted">
              {onEdit && <button className="btn-icon" aria-label="Edit" onClick={() => onEdit(t)}><Eye size={16} /></button>}
              <button className="btn-icon hover:!bg-dangerSoft hover:!text-danger" aria-label="Delete" onClick={() => confirm("Delete and reverse this transaction?") && del.mutate(t._id)}><Trash2 size={16} /></button>
            </div>
          </div>
        </div>)}
      </>}
  </Section>;
}
