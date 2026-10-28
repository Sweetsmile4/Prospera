"use client";
import { PageHeader, ProgressBar } from "@/components/ui";

export function Page({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1600px] px-8 py-10 max-md:px-4 max-md:py-6">
    <PageHeader title={title} description={description} actions={action} />
    {children}
  </div>;
}
export function Empty({ text }: { text: string }) { return <div className="card grid min-h-40 place-items-center p-8 text-center text-sm text-muted">{text}</div> }
export function Progress({ value }: { value: number }) { return <ProgressBar value={value} /> }