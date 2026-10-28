"use client";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Notification } from "@/lib/types";
import { Page } from "@/components/page";
import { Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { Bell, BellRing } from "lucide-react";

export default function Notifications() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => api<Notification[]>("/notifications") });
  const read = useMutation({ mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: "PUT" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });
  const all = useMutation({ mutationFn: () => api("/notifications/read-all", { method: "PUT" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });
  return <Page title="Notifications" description="Bills, budgets, goals, debt, and generated recurring activity." action={<button className="btn btn-secondary" onClick={() => all.mutate()} disabled={!q.data?.length}>Mark all read</button>}>
    {q.isLoading ? <div className="card divide-y divide-edge overflow-hidden">{[0,1,2,3].map(i=><div className="flex gap-4 p-5" key={i}><Skeleton className="size-10 shrink-0 rounded-full"/><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3"/><Skeleton className="h-3 w-3/4"/></div></div>)}</div>
    : q.error ? <ErrorState title="We couldn't load notifications" onRetry={() => q.refetch()} />
    : q.data?.length ? <div className="card divide-y divide-edge overflow-hidden">{q.data.map(n => <div className={`flex gap-4 p-5 ${n.isRead ? "bg-surface" : "bg-brandSoft/40"}`} key={n._id}>
      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-brandSoft text-brand">{n.isRead ? <Bell size={18} /> : <BellRing size={18} />}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{n.title}</h2><div className="flex items-center gap-2">{!n.isRead && <Badge tone="warning">New</Badge>}<span className="text-xs text-muted">{new Date(n.createdAt).toLocaleDateString("en-IN")}</span></div></div>
        <p className="mt-1 text-sm text-muted">{n.message}</p>
        <div className="mt-2 flex items-center gap-4 text-[13px] font-semibold">{n.actionUrl && <Link href={n.actionUrl} className="text-brand">View</Link>}{!n.isRead && <button className="text-text2 hover:text-brand" onClick={() => read.mutate(n._id)}>Mark read</button>}</div>
      </div>
    </div>)}</div> : <EmptyState icon={<Bell size={20} />} title="You're all caught up" body="New activity about bills, budgets, goals, and recurring transactions will appear here." />}
  </Page>;
}
