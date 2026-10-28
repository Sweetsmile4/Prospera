"use client";
import { X } from "lucide-react";
import { useEffect } from "react";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = "" };
  }, [onClose]);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" onMouseDown={onClose}>
    <div onMouseDown={e => e.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-surface p-6 shadow-lg">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        <button className="btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      {children}
    </div>
  </div>;
}