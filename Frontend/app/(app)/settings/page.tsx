"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Category, User } from "@/lib/types";
import { Page } from "@/components/page";
import { Alert, ConfirmDialog, EmptyState, Field, Spinner } from "@/components/ui";
import { Plus, Tags, Trash2 } from "lucide-react";

export default function Settings() {
  const qc = useQueryClient(), [message, setMessage] = useState(""), [removing, setRemoving] = useState<Category | null>(null);
  const user = useQuery({ queryKey: ["me"], queryFn: () => api<User>("/auth/me") });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api<Category[]>("/categories") });
  const profile = useMutation({ mutationFn: (body: unknown) => api<User>("/auth/me", { method: "PUT", body: JSON.stringify(body) }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["me"] }); setMessage("Profile saved.") } });
  const create = useMutation({ mutationFn: (body: unknown) => api("/categories", { method: "POST", body: JSON.stringify(body) }), onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }) });
  const remove = useMutation({ mutationFn: (id: string) => api(`/categories/${id}`, { method: "DELETE" }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); setRemoving(null) } });
  const custom = categories.data?.filter(c => !c.isDefault && c.userId) || [];
  return <Page title="Settings" description="Manage your profile, currency, and custom categories." action={<Link className="btn btn-secondary" href="/settings/financial">Financial preferences</Link>}>
    {profile.error && <Alert tone="danger" className="mb-5">{profile.error.message}</Alert>}
    <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
      <section className="card p-6">
        <h2 className="mb-5 text-lg font-semibold">Profile</h2>
        {user.data ? <form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); profile.mutate({ name: f.get("name"), currency: f.get("currency") }) }}>
          <Field label="Name"><input name="name" className="field" defaultValue={user.data.name} required minLength={2} /></Field>
          <Field label="Email"><input className="field bg-panel text-muted" value={user.data.email} disabled /></Field>
          <Field label="Currency"><select name="currency" className="field" defaultValue={user.data.currency}><option value="INR">INR — Indian Rupee (₹)</option></select></Field>
          {message ? <Alert tone="success">{message}</Alert> : null}
          <button className="btn btn-primary" disabled={profile.isPending}>{profile.isPending ? <><Spinner className="mr-2" />Saving…</> : "Save profile"}</button>
        </form> : <p className="text-sm text-muted">Loading profile…</p>}
      </section>
      <section className="card p-6">
        <div className="mb-1 flex items-center gap-2"><Tags size={16} className="text-brand" /><h2 className="text-lg font-semibold">Custom categories</h2></div>
        <p className="mb-5 text-sm text-muted">Default categories remain available to every account.</p>
        <form className="mb-6 flex gap-3 max-sm:flex-col" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); create.mutate({ name: f.get("name"), type: f.get("type") }); e.currentTarget.reset() }}>
          <input className="field min-w-0 flex-1" name="name" placeholder="Category name" required />
          <select className="field max-w-40 max-sm:max-w-none" name="type" aria-label="Category type"><option value="expense">Expense</option><option value="income">Income</option><option value="investment">Investment</option></select>
          <button className="btn btn-primary whitespace-nowrap" disabled={create.isPending}><Plus size={16} className="mr-1.5" />Add category</button>
        </form>
        {custom.length ? <div className="space-y-2">{custom.map(c => <div key={c._id} className="flex items-center justify-between rounded-xl border border-edge px-4 py-3"><div><p className="font-medium text-text2">{c.name}</p><p className="text-xs capitalize text-muted">{c.type}</p></div><button aria-label={`Delete category ${c.name}`} className="text-muted transition-colors hover:text-danger" onClick={() => setRemoving(c)}><Trash2 size={17} /></button></div>)}</div> : <EmptyState title="No custom categories yet" body="Create one above to track what matters to you." />}
      </section>
    </div>
    <ConfirmDialog open={!!removing} title="Delete this category?" body={<>“{removing?.name}” will be removed. Transactions keep their category label.</>} confirmLabel="Delete" busy={remove.isPending} onClose={() => setRemoving(null)} onConfirm={() => removing && remove.mutate(removing._id)} />
  </Page>;
}