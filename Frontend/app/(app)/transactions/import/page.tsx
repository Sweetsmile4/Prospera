"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ExcelJS from "exceljs";
import { api, money } from "@/lib/api";
import type { Account, Category } from "@/lib/types";
import { Page } from "@/components/page";
import { Alert, Badge, EmptyState, Section, Skeleton } from "@/components/ui";
import { ArrowRight, CheckCircle2, FileUp } from "lucide-react";

type Raw = Record<string, unknown>;
type Row = { date: string; description: string; amount: number; type: "income" | "expense"; referenceNumber?: string; categoryId?: string; skip?: boolean; importAnyway?: boolean; possibleDuplicate?: boolean };
function csvRows(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean), parse = (line: string) => { const out: string[] = []; let cell = "", quoted = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === '"' && quoted && line[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') quoted = !quoted; else if (c === ',' && !quoted) { out.push(cell); cell = "" } else cell += c } out.push(cell); return out };
  const headers = parse(lines[0] || ""); return lines.slice(1).map(line => Object.fromEntries(parse(line).map((v, i) => [headers[i] || `Column ${i + 1}`, v])));
}

export default function ImportPage() {
  const qc = useQueryClient(), [fileName, setFileName] = useState(""), [raw, setRaw] = useState<Raw[]>([]), [headers, setHeaders] = useState<string[]>([]), [rows, setRows] = useState<Row[]>([]), [accountId, setAccountId] = useState(""), [mapping, setMapping] = useState({ date: "", description: "", debit: "", credit: "", amount: "", type: "", reference: "" }), [step, setStep] = useState(1), [error, setError] = useState("");
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => api<Account[]>("/accounts") }), categories = useQuery({ queryKey: ["categories"], queryFn: () => api<Category[]>("/categories") });
  const preview = useMutation({ mutationFn: (b: unknown) => api<Row[]>("/imports/preview", { method: "POST", body: JSON.stringify(b) }), onSuccess: d => { setRows(d); setStep(3) } }), commit = useMutation({ mutationFn: (b: unknown) => api<{ imported: number; skipped: number }>("/imports/commit", { method: "POST", body: JSON.stringify(b) }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["transactions"] }); qc.invalidateQueries({ queryKey: ["accounts"] }); setStep(4) } });
  async function load(file: File) {
    try { setError("");
      if (file.size > 5 * 1024 * 1024) throw Error("File must be 5 MB or smaller");
      if (!/\.(csv|xlsx)$/i.test(file.name)) throw Error("Choose a CSV or XLSX file");
      let data: Raw[] = [];
      if (file.name.toLowerCase().endsWith(".csv")) data = csvRows(await file.text());
      else { const book = new ExcelJS.Workbook(); await book.xlsx.load(await file.arrayBuffer()); const sheet = book.worksheets[0], head = (sheet?.getRow(1).values as unknown[]).slice(1).map(String); sheet?.eachRow((row, n) => { if (n > 1) data.push(Object.fromEntries((row.values as unknown[]).slice(1).map((v, i) => [head[i] || `Column ${i + 1}`, typeof v === "object" && v && "text" in v ? (v as any).text : v ?? ""]))) }); }
      const cols = Object.keys(data[0] || {}), find = (...n: string[]) => cols.find(c => n.some(x => c.toLowerCase().includes(x))) || "";
      setFileName(file.name); setRaw(data.slice(0, 5000)); setHeaders(cols); setMapping({ date: find("date"), description: find("description", "narration", "merchant"), debit: find("debit", "withdrawal"), credit: find("credit", "deposit"), amount: find("amount"), type: find("type"), reference: find("reference", "ref") }); setStep(2);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not parse file") }
  }
  function build() {
    const clean = (v: unknown) => String(v ?? "").replace(/^[=+@]/, "'").trim();
    try {
      const parsed = raw.map<Row>(r => { const debit = Number(String(r[mapping.debit] || "").replace(/[,₹,\s]/g, "")) || 0, credit = Number(String(r[mapping.credit] || "").replace(/[,₹,\s]/g, "")) || 0, amount = Math.abs(Number(String(r[mapping.amount] || "").replace(/[,₹,\s]/g, "")) || debit || credit), declared = clean(r[mapping.type]).toLowerCase(); return { date: new Date(clean(r[mapping.date])).toISOString(), description: clean(r[mapping.description]).slice(0, 300), amount, type: credit > 0 || declared.includes("credit") || declared.includes("income") ? "income" : "expense", referenceNumber: mapping.reference ? clean(r[mapping.reference]).slice(0, 100) : undefined } }).filter(r => r.description && r.amount > 0);
      preview.mutate({ fileName, accountId, rows: parsed });
    } catch { setError("Some dates could not be parsed. Check the date column.") }
  }
  const canBuild = !!mapping.date && !!mapping.description && !!accountId && !!(mapping.amount || mapping.debit || mapping.credit);
  return <Page title="Import statement" description="Preview and safely import CSV or Excel transactions.">
    {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
    {step === 1 && <div className="mx-auto max-w-2xl"><EmptyState icon={<FileUp size={20} />} title="Choose a statement to import" body="CSV or XLSX up to 5 MB. Formulas are never executed — only the raw values are read." action={<input className="field mt-2 cursor-pointer" type="file" accept=".csv,.xlsx" onChange={e => e.target.files?.[0] && load(e.target.files[0])} />} /></div>}
    {step === 2 && <Section title="Map statement columns" description={`"${fileName}" was read. Match columns so each row becomes a transaction.`}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(mapping) as (keyof typeof mapping)[]).map(k => <label key={k}><span className="label capitalize">{k}</span><select className="field" value={mapping[k]} onChange={e => setMapping({ ...mapping, [k]: e.target.value })}><option value="">Not mapped</option>{headers.map(h => <option key={h}>{h}</option>)}</select></label>)}
        <label><span className="label">Account</span><select className="field" value={accountId} onChange={e => setAccountId(e.target.value)}><option value="">Select account</option>{accounts.data?.filter(a => a.isActive).map(a => <option value={a._id} key={a._id}>{a.name}</option>)}</select></label>
      </div>
      <button className="btn btn-primary mt-5" disabled={!canBuild} onClick={build}>Preview <ArrowRight size={15} /></button>
    </Section>}
    {step === 3 && <Section title="Preview imported rows" description={`${rows.length} rows are ready. Uncheck rows to skip them, or assign categories before importing.`} action={<Badge tone="info">{rows.filter(r => !r.skip).length} selected</Badge>}>
      <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[820px]">
        <thead><tr><th>Import</th><th>Date</th><th>Description</th><th>Type</th><th className="numeric">Amount</th><th>Category</th><th>Duplicate</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>
          <td><input type="checkbox" checked={!r.skip} onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, skip: !e.target.checked } : x))} aria-label="Include row" /></td>
          <td className="whitespace-nowrap text-sm text-muted">{new Date(r.date).toLocaleDateString("en-IN")}</td>
          <td className="font-medium">{r.description}</td>
          <td><Badge tone={r.type === "income" ? "success" : "danger"} className="capitalize">{r.type}</Badge></td>
          <td className="tnum text-right font-semibold">{money(r.amount)}</td>
          <td><select className="field min-w-40" value={r.categoryId || ""} onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, categoryId: e.target.value || undefined } : x))}><option value="">Uncategorized</option>{categories.data?.filter(c => c.type === r.type).map(c => <option value={c._id} key={c._id}>{c.name}</option>)}</select></td>
          <td>{r.possibleDuplicate ? <label className="flex items-center gap-2 text-xs text-warning"><input type="checkbox" checked={!!r.importAnyway} onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, importAnyway: e.target.checked } : x))} />Import anyway</label> : "—"}</td>
        </tr>)}</tbody>
      </table></div>
      {commit.isPending && <Skeleton className="mt-4 h-10" />}
      {commit.error && <Alert tone="danger" className="mt-4">{commit.error.message}</Alert>}
      <button className="btn btn-primary mt-5" disabled={commit.isPending} onClick={() => commit.mutate({ fileName, accountId, rows })}>{commit.isPending ? "Importing…" : "Import selected"}</button>
    </Section>}
    {step === 4 && <div className="mx-auto max-w-2xl"><EmptyState icon={<CheckCircle2 size={20} />} title="Import complete" body={`Imported ${commit.data?.imported}; skipped ${commit.data?.skipped}. Review your recent transactions to confirm before categorizing.`} action={<button className="btn btn-secondary btn-sm" onClick={() => { setStep(1); setRows([]); setRaw([]); setFileName("") }}>Import another file</button>} /></div>}
  </Page>;
}