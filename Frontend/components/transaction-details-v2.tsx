import { money } from "@/lib/api";
import type { Tx } from "@/lib/types";

export function TransactionDetailsV2({ t }: { t: Tx }) {
  const accent = t.type === "income" ? "text-success" : t.type === "expense" ? "text-danger" : "text-info";
  const sign = t.type === "income" ? "+" : t.type === "expense" ? "−" : "";
  const rows: [string, string][] = [
    ["Type", t.type],
    ["Category", t.categoryId?.name || "—"],
    ["Account", t.accountId.name],
    ["Destination", t.destinationAccountId?.name || "—"],
    ["Date", new Date(t.transactionDate).toLocaleDateString("en-IN")],
    ["Tags", t.tags?.map(x => `#${x}`).join(" ") || "—"],
    ["Reference", t.referenceNumber || "—"],
    ["Source", t.source],
    ["Created", new Date(t.createdAt).toLocaleString("en-IN")],
    ["Modified", new Date(t.updatedAt).toLocaleString("en-IN")],
    ["Generated from", t.recurringTransactionId?.title || "—"],
    ["Imported from", t.importBatchId?.fileName || "—"],
  ];
  return <div>
    <div className="mb-6 flex items-end justify-between gap-4 border-b border-edge pb-5">
      <div>
        <p className="text-sm text-muted">Amount</p>
        <p className={"tnum mt-1 text-3xl font-bold tracking-tight " + accent}>{sign}{money(t.amount)}</p>
      </div>
      {t.attentionFlags?.length ? <div className="flex flex-wrap justify-end gap-1.5">{t.attentionFlags.map(f => <span key={f} className="badge badge-warning capitalize">{f.replace(/_/g, " ")}</span>)}</div> : null}
    </div>
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm max-sm:grid-cols-1">
      {rows.map(([l, v]) => <div key={l}><dt className="label">{l}</dt><dd className="font-medium">{v}</dd></div>)}
      <div className="col-span-2 max-sm:col-span-1"><dt className="label">Notes</dt><dd className="font-medium">{t.description || "—"}</dd></div>
    </dl>
  </div>;
}