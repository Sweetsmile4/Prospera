"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, money } from "@/lib/api";
import type { Account, Holding } from "@/lib/types";
import { Page } from "@/components/page";
import { Modal } from "@/components/modal";
import { AllocationChart } from "@/components/charts";
import { Alert, Badge, EmptyState, ErrorState, Field, MetricCard, Section, Skeleton } from "@/components/ui";
import { LineChart as LineChartIcon } from "lucide-react";

export default function Investments() {
  const qc = useQueryClient(), [modal, setModal] = useState<"new" | "activity" | "value" | null>(null), [selected, setSelected] = useState<Holding | null>(null);
  const q = useQuery({ queryKey: ["investments"], queryFn: () => api<{ items: Holding[]; invested: number; currentValue: number }>("/investments") }), portfolio = useQuery({ queryKey: ["portfolio-analysis"], queryFn: () => api<{ totalInvested: number; totalCurrentValue: number; byType: { type: string; invested: number; currentValue: number; allocation: number; gain: number }[]; concentrationWarnings: string[] }>("/planning/portfolio") }), accounts = useQuery({ queryKey: ["accounts"], queryFn: () => api<Account[]>("/accounts") });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["investments"] }); qc.invalidateQueries({ queryKey: ["portfolio-analysis"] }); qc.invalidateQueries({ queryKey: ["accounts"] }); qc.invalidateQueries({ queryKey: ["net-worth"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }) };
  const create = useMutation({ mutationFn: (b: unknown) => api("/investments", { method: "POST", body: JSON.stringify(b) }), onSuccess: () => { refresh(); setModal(null) } }), update = useMutation({ mutationFn: (b: unknown) => api(`/investments/${selected!._id}`, { method: "PUT", body: JSON.stringify(b) }), onSuccess: () => { refresh(); setModal(null) } }), activity = useMutation({ mutationFn: (b: unknown) => api(`/investments/${selected!._id}/activities`, { method: "POST", body: JSON.stringify(b) }), onSuccess: () => { refresh(); setModal(null) } });
  const d = q.data, gain = (d?.currentValue || 0) - (d?.invested || 0), ret = d?.invested ? gain / d.invested * 100 : 0;
  return <Page title="Investments" description="Track holdings, allocation, and performance without live market integrations." action={<button className="btn btn-primary" onClick={() => setModal("new")}>+ Add holding</button>}>
    {q.isLoading ? <div className="space-y-5"><div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-24" />)}</div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-52" />)}</div></div>
      : q.error ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      : <>
        <div className="mb-5 grid gap-4 md:grid-cols-3">
          <MetricCard label="Invested" value={money(d?.invested || 0)} />
          <MetricCard label="Current value" value={money(d?.currentValue || 0)} />
          <MetricCard label="Gain / return" value={`${money(gain)} · ${ret.toFixed(1)}%`} tone={gain >= 0 ? "success" : "danger"} />
        </div>
        {portfolio.data && portfolio.data.byType.length > 0 && <Section title="Portfolio allocation" className="mb-5" action={<p className="text-xs text-muted">Informational only, not a buy/sell recommendation.</p>}>
          <div className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
            <div><AllocationChart data={portfolio.data.byType.map(t => ({ name: t.type.charAt(0).toUpperCase() + t.type.slice(1), value: t.currentValue }))} /></div>
            <div>
              <h3 className="mb-3 font-semibold">Allocation breakdown</h3>
              <div className="space-y-2">{portfolio.data.byType.map(t => <div key={t.type} className="flex items-center justify-between gap-4 text-sm"><span className="w-28 capitalize">{t.type}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(t.allocation, 100)}%` }} /></div><span className="tnum w-12 text-right font-semibold">{t.allocation}%</span><span className="tnum w-28 text-right text-xs text-muted">{money(t.currentValue)}</span></div>)}</div>
            </div>
          </div>
          {portfolio.data.concentrationWarnings.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{portfolio.data.concentrationWarnings.map((w, i) => <span key={i} className="badge badge-warning">{w}</span>)}</div>}
        </Section>}
        {d?.items.length ? <><div className="card hidden overflow-x-auto md:block"><table className="w-full min-w-[780px]"><thead><tr><th>Holding</th><th>Type</th><th className="numeric">Invested</th><th className="numeric">Current value</th><th className="numeric">Gain / loss</th><th className="numeric">Units</th><th className="text-right">Actions</th></tr></thead><tbody>{d.items.map(h => { const g=h.currentValue-h.investedAmount,r=h.investedAmount?g/h.investedAmount*100:0; return <tr key={h._id}><td><b>{h.name}</b><small className="block text-xs text-muted">Avg {money(h.averageBuyPrice)}</small></td><td><Badge tone="soft" className="capitalize">{h.type}</Badge></td><td className="numeric">{money(h.investedAmount)}</td><td className="numeric font-semibold">{money(h.currentValue)}</td><td className={"numeric font-semibold "+(g>=0?"text-success":"text-danger")}>{money(g)} <small>({r.toFixed(1)}%)</small></td><td className="numeric text-muted">{h.units}</td><td><div className="flex justify-end gap-2"><button className="btn btn-secondary btn-sm" onClick={()=>{setSelected(h);setModal("activity")}}>Activity</button><button className="btn btn-secondary btn-sm" onClick={()=>{setSelected(h);setModal("value")}}>Update</button></div></td></tr>})}</tbody></table></div><div className="grid gap-4 md:hidden">{d.items.map(h => { const g = h.currentValue - h.investedAmount, r = h.investedAmount ? g / h.investedAmount * 100 : 0; return <article className="card !p-0" key={h._id}>
          <div className="flex items-start justify-between p-5 pb-3">
            <h2 className="font-semibold">{h.name}</h2>
            <Badge tone="soft" className="capitalize">{h.type}</Badge>
          </div>
          <div className="px-5 pb-5">
            <p className="tnum text-2xl font-bold tracking-tight">{money(h.currentValue)}</p>
            <p className="text-sm text-muted">Invested {money(h.investedAmount)}</p>
            <p className={"tnum mt-2 text-sm font-semibold " + (g >= 0 ? "text-success" : "text-danger")}>{money(g)} ({r.toFixed(1)}%)</p>
            <p className="mt-1 text-xs text-muted">{h.units} units · Avg {money(h.averageBuyPrice)}</p>
            <div className="mt-4 flex gap-2">
              <button className="btn btn-secondary btn-sm" onClick={() => { setSelected(h); setModal("activity") }}>Activity</button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setSelected(h); setModal("value") }}>Update value</button>
            </div>
          </div>
        </article>})}</div></> : <EmptyState icon={<LineChartIcon size={20} />} title="No investment holdings yet" body="Add your mutual funds, stocks, FDs, and more to track them here." action={<button className="btn btn-primary btn-sm" onClick={() => setModal("new")}>+ Add holding</button>} />}
      </>}
    {modal === "new" && <Modal title="Add investment holding" onClose={() => setModal(null)}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); create.mutate({ name: f.get("name"), type: f.get("type"), units: Number(f.get("units") || 0), averageBuyPrice: Number(f.get("averageBuyPrice") || 0), investedAmount: Number(f.get("investedAmount") || 0), currentValue: Number(f.get("currentValue") || 0), accountId: f.get("accountId") || undefined, notes: f.get("notes") || undefined }) }}>
        <Field label="Holding name"><input className="field" name="name" placeholder="e.g. Nifty 50 index fund" required /></Field>
        <Field label="Type"><select className="field" name="type">{["mutual fund", "stock", "ETF", "FD", "RD", "PPF", "gold", "crypto", "other"].map(x => <option key={x} className="capitalize">{x}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field label="Units"><input className="field tnum" name="units" type="number" min="0" step="any" placeholder="0" /></Field>
          <Field label="Average price"><input className="field tnum" name="averageBuyPrice" type="number" min="0" step="any" placeholder="0" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field label="Invested"><input className="field tnum" name="investedAmount" type="number" min="0" placeholder="0" /></Field>
          <Field label="Current value"><input className="field tnum" name="currentValue" type="number" min="0" placeholder="0" /></Field>
        </div>
        <Field label="Linked investment account"><select className="field" name="accountId"><option value="">No linked account</option>{accounts.data?.filter(a => a.type === "investment").map(a => <option value={a._id} key={a._id}>{a.name}</option>)}</select></Field>
        <Field label="Notes"><textarea className="field" name="notes" rows={2} placeholder="Optional" /></Field>
        {create.error && <Alert tone="danger">{create.error.message}</Alert>}
        <button className="btn btn-primary w-full">Add holding</button>
      </form>
    </Modal>}
    {modal === "value" && selected && <Modal title="Update market value" onClose={() => setModal(null)}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); update.mutate({ currentValue: Number(f.get("currentValue")) }) }}>
        <Field label="Current value"><input className="field tnum" name="currentValue" type="number" min="0" defaultValue={selected.currentValue} required /></Field>
        {update.error && <Alert tone="danger">{update.error.message}</Alert>}
        <button className="btn btn-primary w-full">Update value</button>
      </form>
    </Modal>}
    {modal === "activity" && selected && <Modal title={`${selected.name} activity`} onClose={() => setModal(null)}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); activity.mutate({ activity: f.get("activity"), amount: Number(f.get("amount")), units: Number(f.get("units") || 0), accountId: f.get("accountId"), date: f.get("date") }) }}>
        <Field label="Activity"><select className="field" name="activity">{["buy", "sell", "contribution", "withdrawal"].map(x => <option key={x} className="capitalize">{x}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field label="Amount"><input className="field tnum" name="amount" type="number" min=".01" required /></Field>
          <Field label="Units"><input className="field tnum" name="units" type="number" min="0" step="any" /></Field>
        </div>
        <Field label="Cash/bank account"><select className="field" name="accountId" required><option value="">Select</option>{accounts.data?.filter(a => a.isActive && a.type !== "investment").map(a => <option value={a._id} key={a._id}>{a.name}</option>)}</select></Field>
        <Field label="Date"><input className="field" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></Field>
        {activity.error && <Alert tone="danger">{activity.error.message}</Alert>}
        <button className="btn btn-primary w-full">Record activity</button>
      </form>
    </Modal>}
  </Page>;
}
