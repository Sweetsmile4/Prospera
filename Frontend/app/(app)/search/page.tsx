"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, money } from "@/lib/api";
import type { Account, Goal, Recurring, Tx } from "@/lib/types";
import { Page } from "@/components/page";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui";
import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";

export default function SearchV3() {
  const [q, setQ] = useState(""), [debounced, setDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 300); return () => clearTimeout(t) }, [q]);
  const tx = useQuery({ queryKey: ["search", debounced], enabled: debounced.length >= 2, queryFn: () => api<{ items: Tx[]; total: number }>(`/transactions?search=${encodeURIComponent(debounced)}&limit=10`) });
  const goals = useQuery({ queryKey: ["goals"], queryFn: () => api<Goal[]>("/goals") });
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => api<Account[]>("/accounts") });
  const recurring = useQuery({ queryKey: ["recurring"], queryFn: () => api<Recurring[]>("/recurring") });
  const terms = debounced.toLowerCase();
  const g = (goals.data || []).filter(x => x.name.toLowerCase().includes(terms));
  const a = (accounts.data || []).filter(x => x.name.toLowerCase().includes(terms) || String(x.institutionName || "").toLowerCase().includes(terms));
  const r = (recurring.data || []).filter(x => x.title.toLowerCase().includes(terms) || String(x.notes || "").toLowerCase().includes(terms));
  return <Page title="Search" description="Find a transaction, goal, account, or recurring bill across Prospera.">
    <div className="relative mb-6"><SearchIcon size={18} className="absolute left-4 top-3.5 text-muted" aria-hidden /><input autoFocus aria-label="Search Prospera" className="field !pl-11" value={q} onChange={e => setQ(e.target.value)} placeholder="Search transactions, goals, accounts, bills..." /></div>
    {debounced.length < 2 ? <EmptyState icon={<SearchIcon size={20} />} title="Type at least 2 characters to search." body="Search across transactions, goals, accounts, and recurring bills." />
      : tx.error ? <ErrorState title="We couldn't search Prospera" onRetry={() => tx.refetch()} />
      : !tx.isLoading ? <>
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Transactions <span className="text-sm font-normal text-muted">({tx.data?.total ?? 0} matches)</span></h2><Link className="text-sm font-semibold text-brand" href={`/transactions?search=${encodeURIComponent(debounced)}`}>View all →</Link></div>
            {tx.data?.items.length ? <ul className="card divide-y divide-edge overflow-hidden">{tx.data.items.map(t => <li className="flex items-center justify-between gap-3 px-4 py-3 text-sm" key={t._id}><div className="min-w-0"><p className="truncate font-medium text-text2">{t.title}</p><p className="truncate text-xs text-muted">{t.accountId?.name}{t.categoryId ? ` · ${t.categoryId.name}` : ""} · {t.type}</p></div><span className={`tnum shrink-0 font-semibold ${t.type === "expense" ? "text-danger" : t.type === "income" ? "text-success" : ""}`}>{t.type === "expense" ? "−" : t.type === "income" ? "+" : ""}{money(t.amount)}</span></li>)}</ul> : <p className="card px-4 py-3 text-sm text-muted">No transactions match “{debounced}”.</p>}
          </section>
          {g.length ? <section><h2 className="mb-3 font-semibold">Goals ({g.length})</h2><ul className="card divide-y divide-edge overflow-hidden">{g.map(x => <li key={x._id}><Link href="/goals" className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-panel"><span className="font-medium text-text2">{x.name}</span><span className="tnum shrink-0 text-muted">{money(x.currentAmount)} / {money(x.targetAmount)}</span></Link></li>)}</ul></section> : null}
          {a.length ? <section><h2 className="mb-3 font-semibold">Accounts ({a.length})</h2><ul className="card divide-y divide-edge overflow-hidden">{a.map(x => <li key={x._id}><Link href="/accounts" className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-panel"><span className="min-w-0 font-medium text-text2"><span className="truncate">{x.name}</span><span className="ml-2 text-xs capitalize text-muted">{x.type}{x.institutionName ? ` · ${x.institutionName}` : ""}</span></span><span className="tnum shrink-0 font-semibold">{money(x.currentBalance)}</span></Link></li>)}</ul></section> : null}
          {r.length ? <section><h2 className="mb-3 font-semibold">Recurring & bills ({r.length})</h2><ul className="card divide-y divide-edge overflow-hidden">{r.map(x => <li key={x._id}><Link href="/recurring" className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-panel"><span className="font-medium text-text2">{x.title}</span><span className="tnum shrink-0 text-muted">{money(x.amount)} · next {new Date(x.nextRunDate).toLocaleDateString("en-IN")}</span></Link></li>)}</ul></section> : null}
          {!tx.data?.items.length && !g.length && !a.length && !r.length && <EmptyState icon={<SearchIcon size={20} />} title={`No results for “${debounced}”`} body="Try a different keyword or check the spelling." />}
        </div>
      </> : <Skeleton className="h-48" />}
  </Page>;
}
