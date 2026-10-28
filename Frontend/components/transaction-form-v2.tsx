"use client";
import { Alert, Field } from "@/components/ui";
import type { Account, Category, Goal, Tx } from "@/lib/types";

const types = ["income", "expense", "saving", "investment", "transfer"];

export function TransactionFormV2({ selected, formType, setFormType, accounts, categories, goals, submit, error }: { selected: Tx | null; formType: string; setFormType: (v: string) => void; accounts: Account[]; categories: Category[]; goals: Goal[]; submit: (e: React.FormEvent<HTMLFormElement>) => void; error?: string }) {
  const cats = categories.filter(c => c.type === (formType === "income" ? "income" : formType === "investment" ? "investment" : "expense"));
  return <form onSubmit={submit} className="space-y-4">
    <Field label="Type">
      <select className="field" name="type" value={formType} onChange={e => setFormType(e.target.value)}>{types.map(x => <option key={x} className="capitalize">{x}</option>)}</select>
    </Field>
    <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
      <Field label="Title"><input className="field" name="title" placeholder="What was this for?" defaultValue={selected?.title} required /></Field>
      <Field label="Amount (₹)"><input className="field tnum" name="amount" type="number" min=".01" step=".01" placeholder="0" defaultValue={selected?.amount} required /></Field>
    </div>
    <Field label={formType === "income" ? "Destination account" : "Source account"}>
      <select className="field" name="accountId" defaultValue={selected?.accountId._id} required><option value="">Select account</option>{accounts.filter(a => a.isActive || a._id === selected?.accountId._id).map(a => <option value={a._id} key={a._id}>{a.name}</option>)}</select>
    </Field>
    {["transfer", "saving", "investment"].includes(formType) && <Field label={`Destination account ${formType !== "transfer" ? "(optional)" : ""}`}>
      <select className="field" name="destinationAccountId" defaultValue={selected?.destinationAccountId?._id || ""} required={formType === "transfer"}><option value="">{formType === "transfer" ? "Select account" : "No owned-account destination"}</option>{accounts.filter(a => a.isActive).map(a => <option value={a._id} key={a._id}>{a.name}</option>)}</select>
    </Field>}
    {["income", "expense", "investment"].includes(formType) && <Field label="Category">
      <select className="field" name="categoryId" defaultValue={selected?.categoryId?._id || ""}><option value="">Uncategorized</option>{cats.map(c => <option value={c._id} key={c._id}>{c.name}</option>)}</select>
    </Field>}
    {formType === "saving" && <Field label="Goal">
      <select className="field" name="goalId" defaultValue={selected?.goalId?._id || ""}><option value="">No goal</option>{goals.map(g => <option value={g._id} key={g._id}>{g.name}</option>)}</select>
    </Field>}
    <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
      <Field label="Date"><input className="field" name="transactionDate" type="date" defaultValue={selected ? selected.transactionDate.slice(0, 10) : new Date().toISOString().slice(0, 10)} required /></Field>
      <Field label="Reference number"><input className="field" name="referenceNumber" placeholder="Optional" defaultValue={selected?.referenceNumber} /></Field>
    </div>
    <Field label="Tags" hint="Comma separated: office, tax, trip"><input className="field" name="tags" placeholder="office, tax, trip" defaultValue={selected?.tags?.join(", ")} /></Field>
    <Field label="Notes"><textarea className="field" name="description" rows={2} placeholder="Optional" defaultValue={selected?.description} /></Field>
    {error && <Alert tone="danger">{error}</Alert>}
    <button className="btn btn-primary w-full">{selected ? "Save changes" : "Save transaction"}</button>
  </form>;
}