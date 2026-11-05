"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function WardrobeDialog({ title, children, onClose, busy = false, destructive = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean; destructive?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); };
  }, []);
  return <dialog ref={ref} aria-label={title} role={destructive ? "alertdialog" : "dialog"} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-3xl border border-[#ebe7e7] bg-[#fdfcfb] p-0 text-[#28262b] shadow-2xl backdrop:bg-[#28262b]/40 backdrop:backdrop-blur-sm">
    <div className="flex items-center justify-between gap-4 border-b border-[#ebe7e7] px-6 py-5"><h2 className="serif text-2xl">{title}</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Close dialog" className="rounded-full p-2 hover:bg-[#eee9f4] disabled:opacity-40"><X className="h-5 w-5" /></button></div>
    <div className="p-6">{children}</div>
  </dialog>;
}
