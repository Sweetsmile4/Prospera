"use client";
import { AlertCircle, CheckCircle2, Info, Loader2, X } from "lucide-react";
import { useEffect } from "react";
import { money } from "@/lib/api";

export function cx(...x: (string | false | null | undefined)[]) { return x.filter(Boolean).join(" ") }

export function Spinner({ className }: { className?: string }) { return <Loader2 size={16} aria-hidden className={cx("animate-spin", className)} /> }

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return <div className="mb-8 flex items-start justify-between gap-x-6 gap-y-4 max-sm:flex-col max-sm:items-stretch">
    <div className="min-w-0">
      <h1 className="text-3xl font-bold tracking-tight max-md:text-2xl">{title}</h1>
      {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
  </div>;
}

export function Section({ title, description, action, children, className }: { title?: React.ReactNode; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={cx("card p-5", className)}>
    {(title || action) && <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>}
    {children}
  </section>;
}

export function MetricCard({ label, value, hint, icon, tone = "neutral", className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; tone?: "neutral" | "success" | "danger" | "warning" | "info" | "muted"; className?: string }) {
  const toneCls = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : tone === "info" ? "text-info" : tone === "muted" ? "text-muted" : "";
  return <div className={cx("card p-5", className)}>
    <div className="flex items-center justify-between gap-3">
      <p className="text-[13px] font-medium text-muted">{label}</p>
      {icon && <span className="text-muted" aria-hidden>{icon}</span>}
    </div>
    <p className={cx("tnum mt-2 text-[1.55rem] font-bold tracking-tight leading-tight", toneCls)}>{value}</p>
    {hint && <div className="mt-1.5 text-[13px] text-muted">{hint}</div>}
  </div>;
}

export function Money({ value, signed, tone = "neutral", className }: { value: number; signed?: boolean; tone?: "neutral" | "positive" | "negative" | "muted"; className?: string }) {
  const txt = signed ? `${value >= 0 ? "+" : "-"}${money(Math.abs(value))}` : money(value);
  const color = tone === "positive" ? "text-success" : tone === "negative" ? "text-danger" : tone === "muted" ? "text-muted" : "";
  return <span className={cx("tnum", color, className)}>{txt}</span>;
}

export function Trend({ dir, text, tone }: { dir?: "up" | "down" | "flat"; text?: string; tone?: "positive" | "negative" | "muted" | "neutral" }) {
  const t = tone ?? (dir === "up" ? "positive" : dir === "down" ? "negative" : "muted");
  const color = t === "positive" ? "text-success" : t === "negative" ? "text-danger" : "text-muted";
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "•";
  return <span className={cx("tnum text-[13px] font-semibold", color)}>{arrow} {text}</span>;
}

const badgeTones = { neutral: "badge", soft: "badge badge-soft", success: "badge badge-success", warning: "badge badge-warning", danger: "badge badge-danger", info: "badge badge-info" } as const;
export type BadgeTone = keyof typeof badgeTones;
export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: React.ReactNode; className?: string }) {
  return <span className={cx(badgeTones[tone], className)}>{children}</span>;
}

export function ProgressBar({ value, tone, size = "md", showLabel }: { value: number; tone?: "success" | "warning" | "danger" | "brand"; size?: "sm" | "md" | "lg"; showLabel?: boolean }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = tone ?? (value > 100 ? "danger" : value >= 80 ? "warning" : "success");
  const bar = color === "danger" ? "bg-danger" : color === "warning" ? "bg-warning" : color === "brand" ? "bg-brand" : "bg-success";
  return <div className="flex items-center gap-3">
    <div className={cx("min-w-0 flex-1 overflow-hidden rounded-full bg-panel", size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2")}>
      <div className={cx("h-full rounded-full transition-[width] duration-500", bar)} style={{ width: `${pct}%` }} />
    </div>
    {showLabel && <span className="tnum text-xs font-semibold text-muted">{Math.round(value)}%</span>}
  </div>;
}

export function EmptyState({ icon, title, body, action, className }: { icon?: React.ReactNode; title: string; body?: string; action?: React.ReactNode; className?: string }) {
  return <div className={cx("grid min-h-36 place-items-center rounded-lg bg-brandSoft/50 p-6 text-center", className)}>
    <div className="max-w-sm">
      {icon && <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-panel text-muted" aria-hidden>{icon}</div>}
      <h3 className="font-semibold text-text2">{title}</h3>
      {body && <p className="mt-1 text-sm text-muted">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  </div>;
}

export function ErrorState({ title = "Couldn't load this", message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return <div className="card p-8">
    <div className="flex items-start gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-dangerSoft text-danger" aria-hidden><AlertCircle size={18} /></div>
      <div className="min-w-0">
        <h3 className="font-semibold">{title}</h3>
        {message && <p className="mt-0.5 text-sm text-muted">{message}</p>}
        {onRetry && <button className="btn btn-secondary btn-sm mt-3" onClick={onRetry}>Try again</button>}
      </div>
    </div>
  </div>;
}

export function Skeleton({ className }: { className?: string }) { return <div className={cx("skeleton", className)} aria-hidden /> }
export function SkeletonBlock({ className }: { className?: string }) { return <Skeleton className={cx("h-40 w-full", className)} /> }
export function SkeletonLines({ lines = 3 }: { lines?: number }) {
  return <div className="space-y-2.5">{Array.from({ length: lines }).map((_, i) => <Skeleton key={i} className={cx("h-3.5 w-full", i === lines - 1 ? "w-3/4" : "")} />)}</div>;
}
export function LoadingCard() {
  return <div className="card space-y-4 p-6"><SkeletonLines lines={4} /></div>;
}

const alertTones = {
  info: { cls: "bg-infoSoft", iconCls: "text-info", icon: <Info size={16} /> },
  success: { cls: "bg-successSoft", iconCls: "text-success", icon: <CheckCircle2 size={16} /> },
  warning: { cls: "bg-warningSoft", iconCls: "text-warning", icon: <AlertCircle size={16} /> },
  danger: { cls: "bg-dangerSoft", iconCls: "text-danger", icon: <AlertCircle size={16} /> },
} as const;
export function Alert({ tone = "info", title, children, className }: { tone?: "info" | "success" | "warning" | "danger"; title?: string; children: React.ReactNode; className?: string }) {
  const t = alertTones[tone];
  return <div role="status" className={cx("flex items-start gap-3 rounded-lg px-4 py-3 text-sm", t.cls, className)}>
    <span className={cx("mt-0.5 shrink-0", t.iconCls)} aria-hidden>{t.icon}</span>
    <div className="min-w-0">
      {title && <p className="font-semibold" style={{ color: `var(--${t.iconCls.replace("text-", "")})` }}>{title}</p>}
      <div className="text-text2">{children}</div>
    </div>
  </div>;
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return <div>
    <p className="text-[13px] font-medium text-muted">{label}</p>
    <p className="tnum mt-0.5 text-lg font-bold tracking-tight">{value}</p>
    {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
  </div>;
}

export function Chip({ children, active, onClick, className }: { children: React.ReactNode; active?: boolean; onClick?: () => void; className?: string }) {
  return <button type="button" onClick={onClick} className={cx("rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-sm:flex-1", active ? "border-brand bg-brand-soft text-brand-strong" : "border-edge-strong bg-surface text-text2 hover:border-text2", className)}>{children}</button>;
}

export function Drawer({ open, onClose, side = "right", title, children, footer, flush, noHeader }: { open: boolean; onClose: () => void; side?: "left" | "right"; title?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; flush?: boolean; noHeader?: boolean }) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey) };
  }, [open, onClose]);
  const sideCls = side === "right" ? "right-0 translate-x-full" : "left-0 -translate-x-full";
  return <>
    <div onClick={onClose} className={cx("fixed inset-0 z-50 bg-black/35 transition-opacity duration-300", open ? "opacity-100" : "pointer-events-none opacity-0")} aria-hidden />
    <div role="dialog" aria-modal="true" className={cx("fixed top-0 z-50 flex h-full w-full max-w-sm flex-col bg-surface shadow-lg transition-transform duration-300", sideCls, open && "translate-x-0 max-sm:max-w-full")}>
      {!noHeader && <div className="flex items-center justify-between border-b border-edge px-6 py-4">
        <div className="text-lg font-semibold">{title}</div>
        {title && <button className="btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>}
      </div>}
      <div className={cx("min-h-0 flex-1 overflow-y-auto border-y border-edge", flush ? "" : "p-6")}>{children}</div>
      {footer && <div className="border-t border-edge p-4">{footer}</div>}
    </div>
  </>;
}

export function ConfirmDialog({ open, title, body, confirmLabel = "Delete", busy, onConfirm, onClose }: { open: boolean; title: string; body: React.ReactNode; confirmLabel?: string; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" onMouseDown={onClose}>
    <div onMouseDown={e => e.stopPropagation()} className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-lg">
      <div className="grid size-10 place-items-center rounded-full bg-dangerSoft text-danger" aria-hidden><AlertCircle size={18} /></div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <div className="mt-1 text-sm text-muted">{body}</div>
      <div className="mt-6 flex items-center justify-end gap-3">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" disabled={busy} onClick={onConfirm}><Spinner className={busy ? "inline" : "hidden"} />{confirmLabel}</button>
      </div>
    </div>
  </div>;
}

export function Field({ label, htmlFor, hint, error, children, className }: { label: string; htmlFor?: string; hint?: React.ReactNode; error?: string; children: React.ReactNode; className?: string }) {
  return <div className={cx("min-w-0", className)}>
    <label className="label" htmlFor={htmlFor}>{label}</label>
    {children}
    {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    {error && <p className="mt-1.5 text-xs font-medium text-danger">{error}</p>}
  </div>;
}

export function InsightRow({ tone = "neutral", icon, title, body, action }: { tone?: "positive" | "warning" | "danger" | "info" | "neutral"; icon?: React.ReactNode; title: string; body: React.ReactNode; action?: React.ReactNode }) {
  const chip = { positive: "bg-successSoft text-success", warning: "bg-warningSoft text-warning", danger: "bg-dangerSoft text-danger", info: "bg-infoSoft text-info", neutral: "bg-panel text-muted" }[tone];
  return <div className="flex items-start gap-3 rounded-lg border border-edge bg-surface p-3.5 transition-colors hover:border-edge-strong">
    {icon && <div className={cx("grid size-9 shrink-0 place-items-center rounded-full", chip)} aria-hidden>{icon}</div>}
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-[13px] text-muted">{body}</p>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>;
}
