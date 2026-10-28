"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Account, Category, Goal } from "@/lib/types";
import { Page } from "@/components/page";
import { Alert, Field, Section, Skeleton, Spinner } from "@/components/ui";

type Preferences = { essentialCategories: string[]; essentialCategoriesConfigured: boolean; emergencyFundGoalId?: string; emergencyFundAccountId?: string; emergencyFundTargetMonths: number; preferredDebtStrategy: string; monthlySavingsTarget: number; monthlyInvestmentTarget: number; safeToSpendReserve: number; notificationPreferences: Record<string, boolean>; fireSettings: Record<string, number>; updatedAt?: string };

export default function FinancialSettings() {
  const qc = useQueryClient(), [message, setMessage] = useState("");
  const pref = useQuery({ queryKey: ["financial-preferences"], queryFn: () => api<Preferences>("/financial-preferences") });
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => api<Account[]>("/accounts") });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api<(Category & { isEssential?: boolean })[]>("/categories") });
  const goals = useQuery({ queryKey: ["goals"], queryFn: () => api<Goal[]>("/goals") });
  const save = useMutation({ mutationFn: (body: unknown) => api("/financial-preferences", { method: "PUT", body: JSON.stringify(body) }), onSuccess: () => { qc.invalidateQueries(); setMessage("Financial preferences saved.") } });
  const error = pref.error || accounts.error || categories.error || goals.error || save.error;
  const loading = [pref, accounts, categories, goals].some(q => q.isLoading);
  const monthlyPlans: [string, string][] = [["monthlySavingsTarget", "Savings target"], ["monthlyInvestmentTarget", "Investment target"], ["safeToSpendReserve", "Additional cash reserve"]];
  const retirement: [string, string, number, number][] = [["currentAge", "Current age", 18, 100], ["retirementAge", "Retirement age", 30, 100], ["expectedAnnualReturn", "Expected annual return (%)", 0, 30], ["inflationRate", "Inflation (%)", 0, 20], ["safeWithdrawalRate", "Withdrawal rate (%)", 1, 10]];
  return <Page title="Financial preferences" description="Choose the data and assumptions used by your plans. These settings do not move money." action={<Link href="/settings" className="btn btn-secondary">Profile settings</Link>}>
    {error && <Alert tone="danger" className="mb-5" title="Something went wrong">{error.message}</Alert>}
    {loading ? <Skeleton className="h-64" /> : pref.data && <form key={pref.data.updatedAt || "new"} className="space-y-5" onSubmit={e => {
      e.preventDefault(); setMessage(""); const f = new FormData(e.currentTarget), designation = String(f.get("emergency") || ""), [kind, id] = designation.split(":");
      const numbers = Object.fromEntries(["emergencyFundTargetMonths", "monthlySavingsTarget", "monthlyInvestmentTarget", "safeToSpendReserve"].map(k => [k, Number(f.get(k))]));
      const fireSettings = Object.fromEntries(["currentAge", "retirementAge", "expectedAnnualReturn", "inflationRate", "safeWithdrawalRate"].filter(k => f.get(k) !== "").map(k => [k, Number(f.get(k))]));
      save.mutate({ ...numbers, essentialCategories: f.getAll("essential"), emergencyFundGoalId: kind === "goal" ? id : null, emergencyFundAccountId: kind === "account" ? id : null, preferredDebtStrategy: f.get("strategy"), fireSettings, notificationPreferences: Object.fromEntries(Object.keys(pref.data!.notificationPreferences).map(k => [k, f.get(k) === "on"])) });
    }}>
    <div className="grid gap-5 xl:grid-cols-2">
      <Section title="Essential spending" description="Select categories that represent necessities for you. An empty selection is respected.">
        <div className="grid gap-3 sm:grid-cols-2">{categories.data?.filter(c => c.type === "expense").map(c => <label key={c._id} className="flex items-center gap-2.5 text-sm"><input name="essential" value={c._id} type="checkbox" defaultChecked={pref.data!.essentialCategoriesConfigured || pref.data!.essentialCategories.length > 0 ? pref.data!.essentialCategories.includes(c._id) : !!c.isEssential} />{c.name}</label>)}</div>
        {!categories.data?.some(c => c.type === "expense") && <p className="text-sm text-muted">Create expense categories first in Settings.</p>}
      </Section>
      <Section title="Emergency savings" description="Coverage uses completed-month essential expenses. Projections need recorded history and a contribution plan.">
        <div className="space-y-4">
          <Field label="Designated account or goal"><select className="field" name="emergency" defaultValue={pref.data.emergencyFundGoalId ? "goal:" + pref.data.emergencyFundGoalId : pref.data.emergencyFundAccountId ? "account:" + pref.data.emergencyFundAccountId : ""}><option value="">Not designated</option>{accounts.data?.filter(a => a.isActive && a.type !== "investment").map(a => <option key={a._id} value={"account:" + a._id}>Account: {a.name}</option>)}{goals.data?.map(g => <option key={g._id} value={"goal:" + g._id}>Goal: {g.name}</option>)}</select></Field>
          <Field label="Target coverage (months)"><input className="field" type="number" name="emergencyFundTargetMonths" min="1" max="24" defaultValue={pref.data.emergencyFundTargetMonths} required /></Field>
        </div>
      </Section>
      <Section title="Monthly plans and reserve">
        <div className="space-y-4">{monthlyPlans.map(([key, label]) => <Field key={key} label={label}><input className="field" name={key} type="number" min="0" step=".01" defaultValue={Number(pref.data![key as keyof Preferences]) || 0} required /></Field>)}
          <Field label="Debt strategy"><select className="field" name="strategy" defaultValue={pref.data.preferredDebtStrategy}><option value="snowball">Snowball — smallest balance first</option><option value="avalanche">Avalanche — highest interest first</option><option value="custom">Custom order</option></select></Field>
        </div>
      </Section>
      <Section title="Retirement assumptions" description="These are editable assumptions, not guaranteed returns.">
        <div className="space-y-4">{retirement.map(([key, label, min, max]) => <Field key={key} label={label}><input className="field" type="number" name={key} step={key.includes("Age") ? "1" : ".1"} min={min} max={max} defaultValue={pref.data!.fireSettings[key] ?? ""} /></Field>)}</div>
      </Section>
    </div>
    <Section title="Notification preferences"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(pref.data.notificationPreferences).map(([key, value]) => <label key={key} className="flex gap-2.5 text-sm"><input type="checkbox" name={key} defaultChecked={value} />{key.replace(/([A-Z])/g, " $1").replace(/^./, x => x.toUpperCase())}</label>)}</div></Section>
    {message ? <Alert tone="success">{message}</Alert> : null}
    <button className="btn btn-primary" disabled={save.isPending}>{save.isPending ? <><Spinner className="mr-2" />Saving…</> : "Save financial preferences"}</button>
    </form>}
  </Page>;
}