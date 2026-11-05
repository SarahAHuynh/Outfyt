"use client";
/* eslint-disable @next/next/no-img-element -- Local previews and private, expiring signed URLs. */
import { useEffect, useState, type FormEvent } from "react";
import { Sparkles, Upload, ImageIcon, LoaderCircle, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { CATEGORIES, SEASONS, clothingSchema, imageMetadataError, type Clothing, type WardrobeItem } from "@/lib/wardrobe/schema";
import { WardrobeDialog } from "./dialog";

const fieldStyle = "mt-1.5 w-full rounded-xl border border-[#d9d0dc] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#a69ac5] disabled:opacity-60";
const blank: Clothing = { name: "", category: "Tops", subcategory: "", primary_color: "", secondary_colors: [], style_tags: [], season_tags: [], description: "" };

export async function readApiResponse(response: Response) {
  let data;
  try { data = await response.json(); }
  catch { throw new Error("The server could not process this request. Try a smaller image or try again shortly."); }
  if (!response.ok) throw new Error(data.error || "The request failed. Please try again.");
  return data;
}

export function ItemEditor({ item, aiEnabled, onClose, onSaved }: { item?: WardrobeItem; aiEnabled: boolean; onClose: () => void; onSaved: (message: string) => void }) {
  const [id] = useState(() => item?.id || crypto.randomUUID());
  const [attributes, setAttributes] = useState<Clothing>(item || blank);
  const [secondary, setSecondary] = useState(item?.secondary_colors.join(", ") || "");
  const [tags, setTags] = useState(item?.style_tags.join(", ") || "");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(item?.image_url || null);
  const [busy, setBusy] = useState<"analyzing" | "saving" | null>(null);
  const [error, setError] = useState("");
  const [suggested, setSuggested] = useState(false);

  useEffect(() => {
    if (!preview?.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function chooseImage(file?: File) {
    if (!file) return;
    const issue = imageMetadataError(file);
    if (issue) { setError(issue); return; }
    setError(""); setSuggested(false); setImage(file); setPreview(URL.createObjectURL(file));
  }

  async function analyze() {
    if (!image || busy || !aiEnabled) return;
    setBusy("analyzing"); setError(""); setSuggested(false);
    try {
      const form = new FormData(); form.set("image", image);
      const data = await readApiResponse(await fetch("/api/wardrobe/analyze", { method: "POST", body: form }));
      const values = clothingSchema.parse(data.attributes);
      setAttributes(values); setSecondary(values.secondary_colors.join(", ")); setTags(values.style_tags.join(", ")); setSuggested(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Analysis failed. Enter the details manually."); }
    finally { setBusy(null); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const split = (value: string) => [...new Set(value.split(",").map(tag => tag.trim()).filter(Boolean))];
    const parsed = clothingSchema.safeParse({ ...attributes, secondary_colors: split(secondary), style_tags: split(tags) });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setBusy("saving");
    try {
      if (item) {
        await readApiResponse(await fetch(`/api/wardrobe/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...parsed.data, updated_at: item.updated_at }) }));
      } else {
        const form = new FormData(); form.set("id", id); form.set("attributes", JSON.stringify(parsed.data)); if (image) form.set("image", image);
        await readApiResponse(await fetch("/api/wardrobe", { method: "POST", body: form }));
      }
      onSaved(item ? "Your piece has been updated." : "Your new piece is saved to your closet.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the piece."); setBusy(null); }
  }

  const set = <K extends keyof Clothing>(key: K, value: Clothing[K]) => setAttributes(previous => ({ ...previous, [key]: value }));
  return <WardrobeDialog title={item ? "Edit your piece" : "Add to your closet"} onClose={onClose} busy={Boolean(busy)}>
    {suggested && <div role="status" className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 border-l-4 border-l-emerald-600 bg-emerald-50 p-4 text-sm text-emerald-900">
      <CircleCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
      <p><span className="block font-semibold">AI suggestions are ready.</span><span className="mt-1 block text-emerald-800">Review and correct the details below, then save your piece.</span></p>
    </div>}
    <form onSubmit={save}>
      <fieldset disabled={Boolean(busy)}>
        <div className="grid gap-6 sm:grid-cols-[180px_1fr]">
          <div>
            <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-2xl border border-[#ebe7e7] bg-[#f2eef5]">{preview ? <img src={preview} alt="Clothing preview" className="h-full w-full object-contain" /> : <ImageIcon aria-hidden="true" className="h-10 w-10 text-[#a69ac5]" />}</div>
            {!item && <><label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[#d9d0dc] bg-white px-3 py-2 text-sm"><Upload className="h-4 w-4" />{image ? "Change photo" : "Choose photo"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => { chooseImage(event.target.files?.[0]); event.target.value = ""; }} /></label><p className="mt-2 text-xs leading-5 text-[#756e78]">Optional photo. JPEG, PNG or WebP, up to 10 MB.</p></>}
          </div>
          <div className="space-y-4">
            {!item && <div className="rounded-2xl border border-[#e0d7e9] bg-[#f4f0f7] p-4">
              <p className="text-sm leading-6 text-[#71638e]">Let AI suggest the details, or fill them in yourself. Nothing is saved until you choose Save piece.</p>
              <Button
                type="button"
                variant="accent"
                disabled={!image || !aiEnabled || Boolean(busy)}
                aria-busy={busy === "analyzing"}
                onClick={analyze}
                className={`mt-3 min-h-11 min-w-[180px] border border-transparent shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#71638e] disabled:cursor-not-allowed ${busy === "analyzing" ? "disabled:opacity-100" : "disabled:opacity-50"}`}
              >
                {busy === "analyzing" ? <LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 motion-safe:animate-spin" /> : <Sparkles aria-hidden="true" className="mr-2 h-4 w-4" />}
                {busy === "analyzing" ? "Analyzing photo..." : "Analyze photo"}
              </Button>
              {busy === "analyzing" && <p role="status" className="mt-3 text-sm leading-6 text-[#71638e]">Identifying your piece and writing its description...</p>}
              {!aiEnabled && <p className="mt-2 text-xs text-[#756e78]">AI recognition is not configured yet. Manual entry works now.</p>}
            </div>}
            <label className="block text-sm">Item name<input required maxLength={100} value={attributes.name} onChange={e => set("name", e.target.value)} className={fieldStyle} placeholder="Cream knit cardigan" /></label>
            <label className="block text-sm">Category<select value={attributes.category} onChange={e => set("category", e.target.value as Clothing["category"])} className={fieldStyle}>{CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
            <label className="block text-sm">Subcategory<input maxLength={80} value={attributes.subcategory} onChange={e => set("subcategory", e.target.value)} className={fieldStyle} placeholder="Cardigan" /></label>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="block text-sm">Primary color<input required maxLength={40} value={attributes.primary_color} onChange={e => set("primary_color", e.target.value)} className={fieldStyle} placeholder="Cream" /></label><label className="block text-sm">Other colors <span className="text-xs text-[#756e78]">(comma separated)</span><input maxLength={330} value={secondary} onChange={e => setSecondary(e.target.value)} className={fieldStyle} placeholder="Beige, brown" /></label></div>
        <label className="mt-4 block text-sm">Style tags <span className="text-xs text-[#756e78]">(comma separated)</span><input maxLength={420} value={tags} onChange={e => setTags(e.target.value)} className={fieldStyle} placeholder="Minimalist, casual chic" /></label>
        <fieldset className="mt-4"><legend className="text-sm">Seasons</legend><div className="mt-2 flex flex-wrap gap-2">{SEASONS.map(season => <label key={season} className="flex cursor-pointer items-center gap-2 rounded-full border border-[#e0d7e9] bg-white px-3 py-2 text-xs"><input type="checkbox" checked={attributes.season_tags.includes(season)} onChange={event => set("season_tags", event.target.checked ? [...attributes.season_tags, season] : attributes.season_tags.filter(value => value !== season))} className="accent-[#71638e]" />{season}</label>)}</div></fieldset>
        <label className="mt-4 block text-sm">Description<textarea maxLength={1000} rows={3} value={attributes.description} onChange={e => set("description", e.target.value)} className={fieldStyle} placeholder="Any details that make this piece yours..." /></label>
        <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit">{item ? "Save changes" : "Save piece"}</Button></div>
      </fieldset>
      {busy === "saving" && <p role="status" className="mt-4 flex items-center gap-2 text-sm text-[#71638e]"><LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />Saving your piece...</p>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    </form>
  </WardrobeDialog>;
}
