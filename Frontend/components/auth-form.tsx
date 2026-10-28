"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Alert, Field, Spinner } from "@/components/ui";

export function AuthForm({ register = false }: { register?: boolean }) {
  const r = useRouter(), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError("");
    const f = new FormData(e.currentTarget);
    try { const x = await api<{ token: string }>(`/auth/${register ? "register" : "login"}`, { method: "POST", body: JSON.stringify(Object.fromEntries(f)) }); localStorage.setItem("finora_token", x.token); r.push("/dashboard") }
    catch { setError(register ? "We couldn't create your account. Check the details and try again." : "We couldn't sign you in. Check your email and password.") }
    finally { setBusy(false) }
  }
  return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-surface px-4 py-10">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,var(--brand-soft),transparent_70%)]" aria-hidden />
    <section className="relative w-full max-w-md">
      <Link href="/" className="mb-7 flex items-center justify-center gap-2 text-2xl font-bold tracking-tight"><span className="grid size-8 place-items-center rounded-xl bg-brand text-sm text-white">P</span>Prospera<span className="text-brand">.</span></Link>
      <form onSubmit={submit} className="card bg-white p-7 shadow-md sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight">{register ? "Create your account" : "Welcome back"}</h1>
        <p className="mb-8 mt-2 text-muted">{register ? "Start building a clearer financial future." : "Sign in to your financial overview."}</p>
        {register && <div className="mb-4"><Field label="Name" htmlFor="auth-name"><input id="auth-name" className="field" name="name" required minLength={2} /></Field></div>}
        <div className="mb-4"><Field label="Email" htmlFor="auth-email"><input id="auth-email" className="field" type="email" name="email" required autoComplete="email" /></Field></div>
        <div className="mb-3"><Field label="Password" htmlFor="auth-password"><input id="auth-password" className="field" type="password" name="password" minLength={8} required autoComplete={register ? "new-password" : "current-password"} /></Field></div>
        {error && <Alert tone="danger" className="mb-3">{error}</Alert>}
        <button disabled={busy} className="btn btn-primary mt-4 w-full">{busy ? <><Spinner className="mr-2" />Please wait…</> : register ? "Create account" : "Sign in"}</button>
        <p className="mt-6 text-center text-sm text-muted">{register ? "Already have an account? " : "New to Prospera? "}<Link className="font-semibold text-brand hover:underline" href={register ? "/login" : "/register"}>{register ? "Sign in" : "Create account"}</Link></p>
      </form>
      <p className="mt-5 text-center text-xs text-muted">Private by design · Built for real financial clarity</p>
    </section>
  </main>;
}
