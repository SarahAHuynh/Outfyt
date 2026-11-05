"use client";
/* eslint-disable @next/next/no-img-element -- Photos use private, expiring signed URLs. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Shirt, Plus, Search, Pencil, Trash2, ImageIcon, RefreshCw, X } from "lucide-react";
import { Button, EmptyCard } from "@/components/ui";
import { CATEGORIES, type WardrobeItem } from "@/lib/wardrobe/schema";
import { ItemEditor, readApiResponse } from "./item-editor";
import { WardrobeDialog } from "./dialog";

export function Closet({ aiEnabled, initialItems, initialError, initialWarning }: { aiEnabled: boolean; initialItems: WardrobeItem[]; initialError: string; initialWarning?: string }) {
  const router = useRouter();
  const [items, setItems] = useState<WardrobeItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState(initialWarning || "");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [color, setColor] = useState("");
  const [editor, setEditor] = useState<WardrobeItem | "new" | null>(null);
  const [deletion, setDeletion] = useState<{ item: WardrobeItem; token: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [preparingId, setPreparingId] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const data = await readApiResponse(await fetch("/api/wardrobe", { cache: "no-store", signal }));
      if (signal?.aborted) return;
      setItems(data.items); if (data.warning) setNotice(data.warning);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Could not load your closet.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  // Refresh expiring private URLs when returning to the closet after an hour.
  useEffect(() => { const interval = window.setInterval(() => { if (document.visibilityState === "visible" && !editor && !deletion) void load(); }, 50 * 60 * 1000); return () => window.clearInterval(interval); }, [load, editor, deletion]);

  const colors = useMemo(() => [...new Set(items.map(item => item.primary_color.toLowerCase()))].sort(), [items]);
  const visible = useMemo(() => items.filter(item => (!category || item.category === category) && (!color || item.primary_color.toLowerCase() === color) && (!query || [item.name, item.description, ...item.style_tags].join(" ").toLowerCase().includes(query.toLowerCase()))), [items, category, color, query]);

  async function requestDelete(item: WardrobeItem) {
    setPreparingId(item.id); setError("");
    try {
      const data = await readApiResponse(await fetch(`/api/wardrobe/${item.id}/deletion`, { method: "POST" }));
      setDeleteError(""); setDeletion({ item, token: data.token });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not prepare deletion."); }
    finally { setPreparingId(null); }
  }
  async function confirmDelete() {
    if (!deletion) return;
    setDeleteBusy(true); setDeleteError("");
    try {
      const data = await readApiResponse(await fetch(`/api/wardrobe/${deletion.item.id}/deletion`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: deletion.token }) }));
      setDeletion(null); setNotice(data.warning || "Your piece was deleted."); await load(); router.refresh();
    } catch (cause) { setDeleteError(cause instanceof Error ? cause.message : "Could not delete this piece."); }
    finally { setDeleteBusy(false); }
  }

  return <>
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap gap-2">
        <label className="flex min-w-0 items-center gap-2 rounded-full border border-[#ebe7e7] bg-white px-4 py-2.5"><Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[#a69ac5]" /><span className="sr-only">Search your closet</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your closet" className="w-40 min-w-0 bg-transparent text-sm outline-none" /></label>
        <label><span className="sr-only">Filter by category</span><select value={category} onChange={e => setCategory(e.target.value)} className="h-full rounded-full border border-[#ebe7e7] bg-white px-4 py-2.5 text-sm"><option value="">All categories</option>{CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></label>
        <label><span className="sr-only">Filter by primary color</span><select value={color} onChange={e => setColor(e.target.value)} className="h-full max-w-44 rounded-full border border-[#ebe7e7] bg-white px-4 py-2.5 text-sm"><option value="">All colors</option>{colors.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      </div>
      <div className="flex gap-2"><Button variant="ghost" onClick={() => void load()} disabled={loading} aria-label="Refresh closet"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button><Button onClick={() => setEditor("new")}><Plus className="mr-2 h-4 w-4" />Add a piece</Button></div>
    </div>
    {notice && <div role="status" className="mt-5 flex items-start justify-between gap-4 rounded-2xl border border-[#d9d0dc] bg-[#eee9f4] px-4 py-3 text-sm text-[#71638e]">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification"><X className="h-4 w-4" /></button></div>}
    {error && <div role="alert" className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">{error}<button onClick={() => void load()} className="ml-3 underline">Try again</button></div>}
    {loading ? <div role="status" aria-label="Loading your closet" className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="animate-pulse rounded-2xl bg-white p-3"><div className="aspect-[4/5] rounded-xl bg-[#eee9f4]" /><div className="mt-4 h-4 w-3/4 rounded bg-[#eee9f4]" /></div>)}</div> : items.length === 0 && !error ? <div className="mt-8"><EmptyCard icon={<Shirt />} title="Your closet is a blank canvas" text="Start with a piece you love. Upload a photo for AI suggestions, or add its details yourself." action={<Button onClick={() => setEditor("new")}><Plus className="mr-2 h-4 w-4" />Add your first piece</Button>} /></div> : <>
      <p className="mb-4 mt-6 text-sm text-[#756e78]">{visible.length} {visible.length === 1 ? "piece" : "pieces"}{visible.length !== items.length ? ` of ${items.length}` : ""}</p>
      {!visible.length && !error && <EmptyCard icon={<Search />} title="No pieces match just yet" text="Try another category, color, or search." action={<Button variant="soft" onClick={() => { setQuery(""); setCategory(""); setColor(""); }}>Clear filters</Button>} />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">{visible.map(item => <article key={item.id} className="overflow-hidden rounded-2xl border border-[#ebe7e7] bg-white">
        <div className="flex aspect-[4/5] items-center justify-center bg-[#f2eef5] p-3"><ItemPhoto key={item.image_url} item={item} /></div>
        <div className="p-3 sm:p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#71638e]">{item.category}</p><h2 className="serif mt-1 break-words text-lg leading-snug">{item.name}</h2><p className="mt-1 text-xs text-[#756e78]">{item.primary_color}</p><div className="mt-3 flex justify-between gap-2 border-t border-[#f1edf3] pt-3"><button onClick={() => setEditor(item)} className="flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs text-[#71638e] hover:bg-[#eee9f4]"><Pencil className="h-3.5 w-3.5" />Edit<span className="sr-only"> {item.name}</span></button><button disabled={Boolean(preparingId)} onClick={() => void requestDelete(item)} className="rounded-lg p-1.5 text-[#8b7783] hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50" aria-label={`Delete ${item.name}`}><Trash2 className="h-4 w-4" /></button></div></div>
      </article>)}</div>
    </>}
    {editor && <ItemEditor item={editor === "new" ? undefined : editor} aiEnabled={aiEnabled} onClose={() => setEditor(null)} onSaved={message => { setEditor(null); setNotice(message); void load(); router.refresh(); }} />}
    {deletion && <WardrobeDialog title="Delete this piece?" destructive busy={deleteBusy} onClose={() => setDeletion(null)}><p className="text-sm leading-6 text-[#756e78]">Delete <strong className="text-[#28262b]">{deletion.item.name}</strong> and its photo? This cannot be undone. Pieces used in saved outfits must be removed from those outfits first.</p><div className="mt-6 flex justify-end gap-3"><Button variant="ghost" disabled={deleteBusy} onClick={() => setDeletion(null)}>Keep piece</Button><Button disabled={deleteBusy} onClick={() => void confirmDelete()} className="bg-rose-800 hover:bg-rose-900">{deleteBusy ? "Deleting..." : "Delete piece"}</Button></div>{deleteError && <p role="alert" className="mt-4 text-sm text-rose-800">{deleteError}</p>}</WardrobeDialog>}
  </>;
}

function ItemPhoto({ item }: { item: WardrobeItem }) {
  const [failed, setFailed] = useState(false);
  if (item.image_url && !failed) return <img src={item.image_url} alt={item.name} loading="lazy" className="h-full w-full object-contain" onError={() => setFailed(true)} />;
  return <div className="text-center text-[#a69ac5]"><ImageIcon aria-hidden="true" className="mx-auto h-8 w-8" /><p className="mt-2 text-xs">{item.image_path ? "Photo unavailable" : "No photo"}</p></div>;
}
