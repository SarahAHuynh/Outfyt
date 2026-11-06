"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Pencil, Trash2, Bookmark, RefreshCw } from "lucide-react";
import { Button, EmptyCard } from "@/components/ui";
import { WardrobeDialog } from "@/components/wardrobe/dialog";
import { readApiResponse } from "@/components/wardrobe/item-editor";
import type { WardrobeItem } from "@/lib/wardrobe/schema";
import { validateOutfitItems, type SavedOutfit, type PendingAction } from "@/lib/stylist/schema";
import { OutfitCard } from "./outfit-card";
import { PendingActionCard } from "./pending-action";

export function Lookbook({ initialOutfits,initialWardrobe,initialError }: { initialOutfits:SavedOutfit[]; initialWardrobe:WardrobeItem[]; initialError:string }) {
  const [outfits,setOutfits] = useState(initialOutfits);
  const [wardrobe,setWardrobe] = useState(initialWardrobe);
  const [error,setError] = useState(initialError);
  const [notice,setNotice] = useState("");
  const [busy,setBusy] = useState<string | null>(null);
  const [editor,setEditor] = useState<SavedOutfit | null>(null);
  const [pending,setPending] = useState<PendingAction | null>(null);
  const [favoritesOnly,setFavoritesOnly] = useState(false);
  const router = useRouter();
  async function reload() {
    try {
      const data = await readApiResponse(await fetch("/api/outfits",{ cache:"no-store" }));
      setOutfits(data.outfits); setWardrobe(data.wardrobe); setError(""); if (data.warning) setNotice(data.warning); router.refresh();
    } catch(cause) { setError(cause instanceof Error ? cause.message : "Could not load your lookbook."); }
  }
  async function favorite(outfit:SavedOutfit) {
    setBusy(outfit.id); setError("");
    try { await readApiResponse(await fetch(`/api/outfits/${outfit.id}`,{ method:"PATCH",headers:{ "Content-Type":"application/json" },body:JSON.stringify({ ...outfit,is_favorite:!outfit.is_favorite }) })); await reload(); }
    catch(cause) { setError(cause instanceof Error ? cause.message : "Could not update this favorite."); }
    finally { setBusy(null); }
  }
  async function prepareDelete(outfit:SavedOutfit) {
    setBusy(outfit.id); setError("");
    try {
      const data = await readApiResponse(await fetch(`/api/outfits/${outfit.id}`,{ method:"DELETE" }));
      setPending({ ...data,result:null });
    } catch(cause) { setError(cause instanceof Error ? cause.message : "Could not prepare deletion."); }
    finally { setBusy(null); }
  }
  const visible = outfits.filter(outfit => !favoritesOnly || outfit.is_favorite);
  return <>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><Button variant={favoritesOnly ? "accent" : "ghost"} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}><Heart className="mr-2 h-4 w-4" />Favorites</Button><Button variant="ghost" onClick={() => void reload()} aria-label="Refresh lookbook"><RefreshCw className="h-4 w-4" /></Button></div><Link href="/stylist" className="rounded-full bg-[#594273] px-5 py-3 text-sm font-semibold text-white hover:bg-[#47345d]">Create a look</Link></div>
    {error && <p role="alert" className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {notice && <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}
    {!visible.length ? <EmptyCard icon={<Bookmark />} title={favoritesOnly ? "No favorites yet" : "Your next favorite look starts here"} text={favoritesOnly ? "Favorite a saved outfit to find it here." : "Ask your stylist for an outfit made from your real wardrobe, then save it to this lookbook."} action={<Link href="/stylist" className="text-sm font-semibold text-[#594273] underline">Open AI Stylist</Link>} /> : <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">{visible.map(outfit => <OutfitCard key={outfit.id} name={outfit.name} description={outfit.description} itemIds={outfit.item_ids} wardrobe={wardrobe} footer={<div className="flex items-center justify-between gap-2"><button disabled={Boolean(busy)} aria-label={`${outfit.is_favorite ? "Unfavorite" : "Favorite"} ${outfit.name}`} aria-pressed={outfit.is_favorite} onClick={() => void favorite(outfit)} className="rounded-lg p-2 text-[#8c5570] hover:bg-[#f6edf0]"><Heart className={`h-5 w-5 ${outfit.is_favorite ? "fill-current" : ""}`} /></button><button disabled={Boolean(busy)} onClick={() => setEditor(outfit)} className="flex items-center gap-1.5 rounded-lg p-2 text-sm text-[#594273] hover:bg-[#eee9f4]"><Pencil className="h-4 w-4" />Edit<span className="sr-only"> {outfit.name}</span></button><button disabled={Boolean(busy)} aria-label={`Delete ${outfit.name}`} onClick={() => void prepareDelete(outfit)} className="rounded-lg p-2 text-rose-800 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button></div>} />)}</div>}
    {editor && <OutfitEditor outfit={editor} wardrobe={wardrobe} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setNotice("Your saved look has been updated."); void reload(); }} />}
    {pending && <WardrobeDialog title="Review outfit deletion" onClose={() => setPending(null)}><PendingActionCard action={pending} onResolved={message => { setPending(null); setNotice(message); void reload(); }} /></WardrobeDialog>}
  </>;
}

function OutfitEditor({ outfit,wardrobe,onClose,onSaved }: { outfit:SavedOutfit; wardrobe:WardrobeItem[]; onClose:() => void; onSaved:() => void }) {
  const [values,setValues] = useState(outfit);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const field = "mt-1.5 w-full rounded-xl border border-[#d9d0dc] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#a69ac5]";
  async function save(event:FormEvent) {
    event.preventDefault(); setError("");
    try {
      validateOutfitItems(values.item_ids,wardrobe); setBusy(true);
      await readApiResponse(await fetch(`/api/outfits/${outfit.id}`,{ method:"PATCH",headers:{ "Content-Type":"application/json" },body:JSON.stringify(values) })); onSaved();
    } catch(cause) { setError(cause instanceof Error ? cause.message : "Could not save this outfit."); setBusy(false); }
  }
  return <WardrobeDialog title="Edit your saved look" busy={busy} onClose={onClose}><form onSubmit={save}><fieldset disabled={busy} className="space-y-4"><label className="block text-sm">Outfit name<input required maxLength={100} value={values.name} onChange={e => setValues({ ...values,name:e.target.value })} className={field} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm">Occasion<input maxLength={100} value={values.occasion} onChange={e => setValues({ ...values,occasion:e.target.value })} className={field} /></label><label className="block text-sm">Aesthetic<input maxLength={150} value={values.aesthetic} onChange={e => setValues({ ...values,aesthetic:e.target.value })} className={field} /></label></div><label className="block text-sm">Description<textarea rows={3} maxLength={1000} value={values.description} onChange={e => setValues({ ...values,description:e.target.value })} className={field} /></label><fieldset><legend className="text-sm font-semibold">Clothing in this outfit</legend><p className="mt-1 text-xs text-[#756e78]">Choose a dress or top and bottom, plus shoes. Other pieces are optional.</p><div className="mt-3 max-h-60 space-y-2 overflow-y-auto">{wardrobe.map(item => <label key={item.id} className="flex items-center gap-3 rounded-xl border border-[#ebe7e7] bg-white p-3 text-sm"><input type="checkbox" checked={values.item_ids.includes(item.id)} onChange={event => setValues({ ...values,item_ids:event.target.checked ? [...values.item_ids,item.id] : values.item_ids.filter(id => id !== item.id) })} className="accent-[#594273]" /><span>{item.name}<span className="ml-2 text-xs text-[#756e78]">{item.category} · {item.primary_color}</span></span></label>)}</div></fieldset><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" variant="accent">{busy ? "Saving..." : "Save changes"}</Button></div></fieldset>{error && <p role="alert" className="mt-4 text-sm text-rose-800">{error}</p>}</form></WardrobeDialog>;
}
