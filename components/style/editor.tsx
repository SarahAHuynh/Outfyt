"use client";
/* eslint-disable @next/next/no-img-element -- Private signed images and local upload preview. */
import { useEffect,useRef,useState,type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft,ArrowRight,Check,CheckCheck,ImagePlus,LoaderCircle,Palette,RefreshCw,Sparkles,Trash2,Upload } from "lucide-react";
import { Button } from "@/components/ui";
import { PendingActionCard } from "@/components/stylist/pending-action";
import { readApiResponse } from "@/components/wardrobe/item-editor";
import { EMPTY_PROFILE,mergeStyleSuggestion,profileSchema,type StyleProfile,type StyleView } from "@/lib/style/schema";
import { styleProposalSchema,type PendingAction } from "@/lib/stylist/schema";
import { imageMetadataError } from "@/lib/wardrobe/schema";

const fields=["aesthetic_tags","preferred_colors","favorite_clothing_types","disliked_styles"] as const;
const labels={ aesthetic_tags:"Favorite aesthetics",preferred_colors:"Preferred colors",favorite_clothing_types:"Favorite clothing types",disliked_styles:"Styles you dislike",comfort_preferences:"Comfort preferences",style_summary:"Style summary",notes:"Styling notes" };
const aesthetics=["Casual chic","Minimalist","Streetwear","Coquette","Preppy","Vintage","Y2K","Downtown","Romantic","Sporty","Tomboy"];
const steps=["Your aesthetic","Everyday details","Inspiration","Review & save"];
const descriptions=["Pick the styles that feel like you. Mixing a few is encouraged.","Help your stylist find pieces you’ll feel good wearing.","A few photos can help you explore your taste. This step is optional.","Check your choices, then approve the exact changes you want to save."];
const inputClass="mt-2 block w-full rounded-xl border border-[#e0d7e9] bg-[#fcfafc] px-3 py-2.5 text-sm font-normal text-[#3e3548] outline-none focus:border-[#71638e] focus:ring-2 focus:ring-[#eee9f4]";
const split=(value:string)=>value.split(",").map(v=>v.trim()).filter(Boolean);
const textLists=(profile:StyleProfile)=>Object.fromEntries(fields.map(field=>[field,profile[field].join(", ")])) as Record<typeof fields[number],string>;
const json=(body:unknown)=>({ headers:{ "Content-Type":"application/json" },body:JSON.stringify(body) });

export function StyleEditor({ initialView,initialError }: { initialView:StyleView | null;initialError:string }) {
  const initialPending=initialView?.pending[0] || null;
  const resumed=profileSchema.safeParse({ ...EMPTY_PROFILE,...initialView?.profile,...initialPending?.payload.proposal as object });
  const startProfile=initialPending && resumed.success ? resumed.data : initialView?.profile || EMPTY_PROFILE;
  const initialStep=initialPending ? 3 : initialView?.updated_at ? 4 : 0;
  const [view,setView]=useState(initialView);
  const [step,setStep]=useState(initialStep);
  const [furthest,setFurthest]=useState(Math.min(initialStep,3));
  const [draft,setDraft]=useState(startProfile);
  const [lists,setLists]=useState(textLists(startProfile));
  const [baseVersion,setBaseVersion]=useState(initialView?.updated_at || null);
  const [activeReview,setActiveReview]=useState<PendingAction | null>(initialPending);
  const [approvalBusy,setApprovalBusy]=useState(false);
  const [busy,setBusy]=useState("");const [error,setError]=useState(initialError);const [notice,setNotice]=useState("");
  const [file,setFile]=useState<File | null>(null);const [preview,setPreview]=useState("");const [name,setName]=useState("");
  const [selected,setSelected]=useState<string[]>([]);
  const [inspirationMode,setInspirationMode]=useState<"intro"|"gallery"|"results">(initialView?.images.length ? "gallery" : "intro");
  const [suggestion,setSuggestion]=useState<ReturnType<typeof styleProposalSchema.parse> | null>(null);
  const [board,setBoard]=useState(initialView?.board_url || "");
  const [deletion,setDeletion]=useState<{ token:string;expires_at:string;name:string;cleanup?:boolean } | null>(null);
  const uploadId=useRef("");const fileInput=useRef<HTMLInputElement>(null);const heading=useRef<HTMLHeadingElement>(null);
  const locked=Boolean(busy) || approvalBusy;
  const navigationLocked=locked || Boolean(deletion);
  useEffect(()=>()=>{ if (preview) URL.revokeObjectURL(preview); },[preview]);

  function currentProfile() {
    const parsed=profileSchema.safeParse({ ...draft,...Object.fromEntries(fields.map(field=>[field,split(lists[field])])) });
    if (!parsed.success) {
      const issue=parsed.error.issues[0];const field=issue.path[0] as keyof typeof labels;
      throw new Error(`${labels[field] || "Style details"}: ${issue.message}`);
    }
    return parsed.data;
  }
  function replaceDraft(profile:StyleProfile) { setDraft(profile);setLists(textLists(profile)); }
  function editList(field:typeof fields[number],value:string) { setLists(previous=>({ ...previous,[field]:value }));setActiveReview(null); }
  function editText(field:"comfort_preferences"|"style_summary"|"notes",value:string) { setDraft(previous=>({ ...previous,[field]:value }));setActiveReview(null); }
  function goTo(next:number) {
    setStep(next);setFurthest(previous=>Math.max(previous,Math.min(next,3)));setError("");setNotice("");
    requestAnimationFrame(()=>{ heading.current?.focus({ preventScroll:true });heading.current?.scrollIntoView({ behavior:"smooth",block:"start" }); });
  }
  function continueTo(next:number) {
    try { currentProfile();goTo(next); } catch(cause) { setError(cause instanceof Error ? cause.message : "Check your choices before continuing."); }
  }
  async function reload(resetDraft=false) {
    const fresh:StyleView=await readApiResponse(await fetch("/api/style-dna",{ cache:"no-store" }));setView(fresh);
    setSelected(previous=>previous.filter(id=>fresh.images.some(image=>image.id===id)));
    if (resetDraft) { replaceDraft(fresh.profile);setBaseVersion(fresh.updated_at);setBoard(fresh.board_url || "");setSuggestion(null); }
    return fresh;
  }
  async function perform(label:string,action:()=>Promise<void>) {
    if (busy) return;setBusy(label);setError("");setNotice("");
    try { await action(); } catch(cause) { setError(cause instanceof Error ? cause.message : "Could not finish. Refresh and try again."); }
    finally { setBusy(""); }
  }
  async function prepareProfile() {
    await perform("Preparing your final review...",async()=>{
      const action=await readApiResponse(await fetch("/api/style-dna",{ method:"POST",...json({ profile:currentProfile(),expected_version:baseVersion }) }));
      setActiveReview({ ...action,result:null });
      setNotice("Your changes are ready. Approve below to save your Style DNA.");
      await reload();
    });
  }
  async function upload(event:FormEvent) {
    event.preventDefault();if (!file) return;
    await perform("Uploading your inspiration...",async()=>{
      const issue=imageMetadataError(file);if (issue) throw new Error(issue);
      if (!uploadId.current) uploadId.current=crypto.randomUUID();
      const form=new FormData();form.set("id",uploadId.current);form.set("name",name);form.set("image",file);
      const saved=await readApiResponse(await fetch("/api/style-dna/inspiration",{ method:"POST",body:form }));
      await reload();setSelected(previous=>previous.includes(saved.id) || previous.length>=5 ? previous : [...previous,saved.id]);
      setFile(null);setPreview("");setName("");uploadId.current="";if (fileInput.current) fileInput.current.value="";
      setNotice("Photo added and selected. Add another or analyze your selection.");
    });
  }
  async function analyze() {
    await perform("Finding the style in your inspiration...",async()=>{
      const result=await readApiResponse(await fetch("/api/style-dna/analyze",{ method:"POST",...json({ image_ids:selected }) }));
      setSuggestion(styleProposalSchema.parse(result.proposal));setInspirationMode("results");
      setNotice(result.cached ? "Your saved analysis is ready. No new AI request was needed." : "Your suggestions are ready. Choose whether to add them to your draft.");
      requestAnimationFrame(()=>heading.current?.scrollIntoView({ behavior:"smooth",block:"start" }));
    });
  }
  async function resolveDelete(approve:boolean) {
    if (!deletion) return;
    await perform("Updating your inspiration...",async()=>{
      const result=await readApiResponse(await fetch("/api/style-dna/inspiration/delete",{ method:"PATCH",...json({ token:deletion.token,approve }) }));
      setDeletion(result.warning ? { ...deletion,cleanup:true } : null);
      if (result.deleted) { setSuggestion(null);const fresh=await reload();if (!fresh.images.length) setInspirationMode("intro"); }
      setNotice(result.warning || (result.deleted ? "Inspiration removed. Your saved Style DNA was kept." : "The image was kept."));
    });
  }
  function listInput(field:typeof fields[number],placeholder:string) {
    return <label className="block text-sm font-semibold text-[#594273]">{labels[field]}<input className={inputClass} maxLength={600} value={lists[field]} onChange={event=>editList(field,event.target.value)} placeholder={placeholder} /></label>;
  }
  const draftSummary={ ...draft,...Object.fromEntries(fields.map(field=>[field,split(lists[field])])) } as StyleProfile;

  return <div className="mx-auto max-w-2xl space-y-5 [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-50">
    {step<4 && <nav aria-label="Style DNA steps"><ol className="grid grid-cols-4 gap-2">{steps.map((title,index)=><li key={title}><button type="button" disabled={navigationLocked || index>furthest || !view} aria-current={index===step ? "step" : undefined} onClick={()=>goTo(index)} className={`flex w-full flex-col items-center gap-2 rounded-xl px-1 py-3 text-center text-[11px] sm:text-xs ${index===step ? "bg-[#eee9f4] font-semibold text-[#594273]" : "text-[#756e78]"} disabled:cursor-default`}><span className={`flex h-7 w-7 items-center justify-center rounded-full ${index===step ? "bg-[#594273] text-white" : index<step ? "bg-[#e8e0f0] text-[#594273]" : "border border-[#ded7e5]"}`}>{index<step ? <Check className="h-3.5 w-3.5" /> : index+1}</span>{title}</button></li>)}</ol></nav>}
    <section aria-busy={locked} className="overflow-hidden rounded-3xl border border-[#e4dce9] bg-white shadow-sm">
      <div className="border-b border-[#eee8f2] px-6 py-6 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8a759d]">{step===4 ? "Made for you" : `Step ${step+1} of 4${step===2 ? " · optional" : ""}`}</p>
        <h2 ref={heading} tabIndex={-1} className="serif mt-2 scroll-mt-6 text-3xl text-[#3e3548] outline-none">{step===4 ? "Your Style DNA is ready" : steps[step]}</h2>
        <p className="mt-2 text-sm leading-6 text-[#756e78]">{step===4 ? "Your stylist will use these preferences when putting looks together." : descriptions[step]}</p>
      </div>
      <div className="space-y-5 p-6 sm:p-8">
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}
        {busy && <p role="status" className="flex items-center gap-2 text-sm text-[#594273]"><LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />{busy}</p>}
        {!view && <Button variant="accent" disabled={locked} onClick={()=>void perform("Loading your preferences...",async()=>{ const fresh=await reload(true);setActiveReview(fresh.pending[0] || null);goTo(fresh.pending.length ? 3 : fresh.updated_at ? 4 : 0); })}>Try again</Button>}
        {view && step===0 && <fieldset disabled={locked} className="space-y-6 disabled:opacity-60">
          <div className="flex items-center gap-3 rounded-2xl bg-[#faf7fc] p-4 text-sm leading-6 text-[#756e78]"><Palette className="h-6 w-6 shrink-0 text-[#594273]" />Start with a few favorites. You can change them whenever your taste evolves.</div>
          <div className="flex flex-wrap gap-2">{aesthetics.map(tag=>{
            const active=split(lists.aesthetic_tags).some(value=>value.toLowerCase()===tag.toLowerCase());
            return <button key={tag} type="button" aria-pressed={active} onClick={()=>editList("aesthetic_tags",(active ? split(lists.aesthetic_tags).filter(value=>value.toLowerCase()!==tag.toLowerCase()) : [...split(lists.aesthetic_tags),tag]).join(", "))} className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm transition ${active ? "border-[#594273] bg-[#594273] text-white" : "border-[#e4dce9] bg-white text-[#756e78] hover:border-[#a69ac5] hover:bg-[#f5eff9]"}`}>{active && <Check className="h-3.5 w-3.5" />}{tag}</button>;
          })}</div>
          {listInput("aesthetic_tags","Or add your own, separated by commas")}
          <p className="text-xs text-[#756e78]">Choose up to 12, or leave this open while you explore.</p>
          <Button variant="accent" className="w-full sm:w-auto" onClick={()=>continueTo(1)}>Continue to everyday details<ArrowRight className="ml-2 h-4 w-4" /></Button>
        </fieldset>}
        {view && step===1 && <fieldset disabled={locked} className="space-y-5 disabled:opacity-60">
          {listInput("preferred_colors","Navy, cream, olive")}
          {listInput("favorite_clothing_types","Relaxed jeans, cardigans, loafers")}
          {listInput("disliked_styles","Anything you would rather avoid")}
          <p className="text-xs text-[#756e78]">Separate choices with commas. Up to 12 per list, 40 characters each.</p>
          <label className="block text-sm font-semibold text-[#594273]">What keeps you comfortable?<textarea rows={3} maxLength={1000} className={inputClass} value={draft.comfort_preferences} onChange={event=>editText("comfort_preferences",event.target.value)} placeholder="Relaxed fits, walkable shoes, soft fabrics..." /></label>
          <div className="flex flex-wrap justify-between gap-3 pt-2"><Button variant="ghost" onClick={()=>goTo(0)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button><Button variant="accent" onClick={()=>continueTo(2)}>Continue to inspiration<ArrowRight className="ml-2 h-4 w-4" /></Button></div>
        </fieldset>}
        {view && step===2 && <div className="space-y-5">
          {inspirationMode==="intro" && <><div className="rounded-2xl border border-dashed border-[#d9cce4] bg-[#faf7fc] p-7 text-center"><ImagePlus className="mx-auto h-9 w-9 text-[#8b72a0]" /><h3 className="serif mt-3 text-2xl">Have a look you love?</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#756e78]">Add a few photos to discover colors and styling ideas. Your own choices will stay yours.</p><Button variant="accent" className="mt-5" disabled={locked} onClick={()=>{ setInspirationMode("gallery");setNotice(""); }}>Add inspiration photos</Button></div><div className="flex flex-wrap justify-between gap-3"><Button variant="ghost" disabled={locked} onClick={()=>goTo(1)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button><Button variant="ghost" disabled={locked} onClick={()=>continueTo(3)}>Skip for now<ArrowRight className="ml-2 h-4 w-4" /></Button></div></>}
          {inspirationMode==="gallery" && <>
            <form onSubmit={upload}><fieldset disabled={locked || Boolean(deletion)} className="space-y-4 disabled:opacity-60">
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-label="Choose inspiration photo" onChange={event=>{
                const chosen=event.target.files?.[0] || null;const issue=chosen ? imageMetadataError(chosen) : null;const next=issue ? null : chosen;
                setFile(next);setPreview(next ? URL.createObjectURL(next) : "");uploadId.current="";setName(next ? next.name.replace(/\.[^.]+$/,"").slice(0,100) : "");setError(issue || "");
              }} />
              {!file && <div className="rounded-2xl border border-dashed border-[#d9cce4] bg-[#faf7fc] p-5"><Button type="button" variant={selected.length ? "ghost" : "accent"} disabled={view.images.length>=50} onClick={()=>fileInput.current?.click()}><ImagePlus className="mr-2 h-4 w-4" />{view.images.length ? "Choose another photo" : "Choose a photo"}</Button><p className="mt-3 text-xs leading-5 text-[#756e78]">Use images you have permission to upload. JPEG, PNG, or WebP, up to 4 MB each.</p></div>}
              {file && <div className="space-y-4 rounded-2xl bg-[#faf7fc] p-4">{preview && <img src={preview} alt="Inspiration upload preview" className="max-h-64 w-full rounded-xl object-contain" />}<label className="block text-sm font-semibold text-[#594273]">Give this photo a name<input required maxLength={100} className={inputClass} value={name} onChange={event=>setName(event.target.value)} /></label><div className="flex flex-wrap gap-3"><Button type="submit" variant="accent" disabled={!name.trim() || view.images.length>=50}><Upload className="mr-2 h-4 w-4" />Upload photo</Button><Button type="button" variant="ghost" onClick={()=>{ setFile(null);setPreview("");if (fileInput.current) fileInput.current.value=""; }}>Cancel</Button></div></div>}
            </fieldset></form>
            {view.images.length>0 && <div><div className="mb-3 flex items-center justify-between text-xs text-[#756e78]"><p>Select photos to analyze together</p><p>{selected.length} of 5 selected</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{view.images.map(image=><article key={image.id} className={`overflow-hidden rounded-2xl border ${selected.includes(image.id) ? "border-[#594273] bg-[#f5eff9]" : "border-[#e4dce9] bg-[#fcfafc]"}`}><label className="block cursor-pointer"><div className="relative"><InspirationPhoto key={image.image_url} src={image.image_url} name={image.name} /><input type="checkbox" aria-label={`Analyze ${image.name}`} checked={selected.includes(image.id)} disabled={locked || Boolean(deletion) || (!selected.includes(image.id) && selected.length>=5)} onChange={event=>{ setSelected(previous=>event.target.checked ? [...previous,image.id] : previous.filter(id=>id!==image.id));setSuggestion(null); }} className="absolute left-3 top-3 h-5 w-5 accent-[#594273]" /></div><p className="break-words px-3 pt-2 text-xs leading-5 text-[#594273]">{image.name}</p></label><button type="button" disabled={locked || Boolean(deletion)} onClick={()=>void perform("Preparing image removal...",async()=>{ setDeletion(await readApiResponse(await fetch("/api/style-dna/inspiration/delete",{ method:"POST",...json({ id:image.id }) }))); })} className="m-3 inline-flex items-center gap-1 text-xs text-[#756e78] underline"><Trash2 className="h-3 w-3" />Remove</button></article>)}</div></div>}
            {deletion && <div aria-label="Confirm inspiration removal" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><p>{deletion.cleanup ? "The private upload still needs cleanup." : `Remove “${deletion.name}”? Your saved preferences stay unchanged.`}</p><div className="mt-3 flex flex-wrap gap-2">{!deletion.cleanup && <Button variant="ghost" disabled={locked} onClick={()=>void resolveDelete(false)}>Keep image</Button>}<Button variant="accent" disabled={locked} onClick={()=>void resolveDelete(true)}>{deletion.cleanup ? "Retry cleanup" : "Confirm removal"}</Button></div></div>}
            {!file && <div className="space-y-3"><Button variant="accent" className="w-full" disabled={navigationLocked || !selected.length} onClick={()=>void analyze()}><Sparkles className="mr-2 h-4 w-4" />Analyze {selected.length || "selected"} photo{selected.length===1 ? "" : "s"}</Button><p className="text-xs leading-5 text-[#756e78]">Selected photos are sent to OpenAI using your API allowance. Your saved preferences stay unchanged.</p></div>}
            <div className="flex flex-wrap justify-between gap-3 border-t border-[#eee8f2] pt-4"><Button variant="ghost" disabled={navigationLocked} onClick={()=>goTo(1)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button><Button variant="ghost" disabled={navigationLocked} onClick={()=>continueTo(3)}>Continue without analysis<ArrowRight className="ml-2 h-4 w-4" /></Button></div>
          </>}
          {inspirationMode==="results" && suggestion && <><div className="rounded-2xl bg-[#f5eff9] p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[#8a759d]">Ideas from your inspiration</p><h3 className="serif mt-2 text-2xl text-[#594273]">Patterns worth exploring</h3><p className="mt-3 text-sm leading-6 text-[#756e78]">{suggestion.style_summary}</p><dl className="mt-4 space-y-3 text-sm">{fields.filter(field=>field!=="disliked_styles").map(field=><div key={field}><dt className="font-semibold text-[#594273]">{labels[field]}</dt><dd className="mt-1 text-[#756e78]">{suggestion[field].join(", ") || "No clear suggestion"}</dd></div>)}</dl></div><p className="text-sm leading-6 text-[#756e78]">Add these ideas to your draft while keeping your existing choices, dislikes, comfort, and notes. You can still edit everything before saving.</p><Button variant="accent" className="w-full" disabled={locked} onClick={()=>{
            try { replaceDraft(mergeStyleSuggestion(currentProfile(),suggestion));setActiveReview(null);goTo(3);setNotice("Inspiration added to your draft. Review your choices before saving."); } catch(cause) { setError(cause instanceof Error ? cause.message : "Check your current choices first."); }
          }}>Add suggestions & continue<ArrowRight className="ml-2 h-4 w-4" /></Button><div className="flex flex-wrap justify-between gap-3"><Button variant="ghost" disabled={locked} onClick={()=>{ setInspirationMode("gallery");setNotice(""); }}>Back to photos</Button><Button variant="ghost" disabled={locked} onClick={()=>continueTo(3)}>Continue without suggestions</Button></div></>}
        </div>}
        {view && step===3 && <div className="space-y-5">
          {activeReview ? <PendingActionCard key={activeReview.token} action={activeReview} onBusyChange={setApprovalBusy} onResolved={(message,status)=>{ void perform("Loading your preferences...",async()=>{
            await reload(status==="completed");setActiveReview(null);
            if (status==="completed") goTo(4);
            setNotice(message);
          }); }} /> : <><ProfileSummary profile={draftSummary} /><details className="rounded-xl border border-[#e4dce9] p-4"><summary className="cursor-pointer text-sm font-medium text-[#594273]">Add a summary or styling notes (optional)</summary><fieldset disabled={locked} className="mt-4 space-y-4">{(["style_summary","notes"] as const).map(field=><label key={field} className="block text-sm font-semibold text-[#594273]">{labels[field]}<textarea rows={3} maxLength={1000} className={inputClass} value={draft[field]} onChange={event=>editText(field,event.target.value)} placeholder={field==="style_summary" ? "What makes an outfit feel like you?" : "Anything else your stylist should keep in mind."} /></label>)}</fieldset></details><Button variant="accent" className="w-full" disabled={locked} onClick={()=>void prepareProfile()}>Review changes to save<ArrowRight className="ml-2 h-4 w-4" /></Button><p className="text-center text-xs leading-5 text-[#756e78]">You’ll approve the exact changes in the next confirmation.</p></>}
          <Button variant="ghost" disabled={locked} onClick={()=>goTo(1)}><ArrowLeft className="mr-2 h-4 w-4" />Back to edit preferences</Button>
        </div>}
        {view && step===4 && <div className="space-y-6"><div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900"><CheckCheck className="h-5 w-5 shrink-0" />Saved to your Style DNA. You can revisit it anytime.</div><ProfileSummary profile={view.profile} /><div className="flex flex-wrap items-center gap-3"><Link href="/stylist" className="inline-flex items-center rounded-full bg-[#594273] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#47345d]">Create a look with my style<ArrowRight className="ml-2 h-4 w-4" /></Link><Button variant="ghost" disabled={locked} onClick={()=>goTo(0)}>Edit my Style DNA</Button></div></div>}
      </div>
    </section>
    {view && <details className="rounded-2xl border border-[#e4dce9] bg-white/70 px-5 py-4"><summary className="cursor-pointer text-sm text-[#756e78]">More options</summary><div className="mt-4 space-y-5"><div><Button variant="ghost" disabled={navigationLocked} onClick={()=>void perform("Loading saved preferences...",async()=>{
      const fresh=await reload(true);const pending=fresh.pending[0] || null;setActiveReview(pending);
      if (pending) { const parsed=profileSchema.safeParse({ ...EMPTY_PROFILE,...fresh.profile,...pending.payload.proposal as object });if (parsed.success) replaceDraft(parsed.data); }
      goTo(pending ? 3 : fresh.updated_at ? 4 : 0);setNotice("Your saved profile or pending review has been reloaded. Unsaved edits were reset.");
    })}><RefreshCw className="mr-2 h-4 w-4" />Reload saved progress</Button><p className="mt-2 text-xs leading-5 text-[#756e78]">Restores your saved profile or pending review, resets unsaved edits, and refreshes photo previews.</p></div>{step===4 && <div className="border-t border-[#e4dce9] pt-5"><h3 className="serif text-xl text-[#594273]">Save a Pinterest reference</h3><p className="mt-2 text-sm leading-6 text-[#756e78]">Optional bookmark only. Pinterest sync is not configured, so saving a board link won’t fetch or analyze Pins.</p><form className="mt-4" onSubmit={event=>{ event.preventDefault();void perform("Saving your board reference...",async()=>{ const saved=await readApiResponse(await fetch("/api/style-dna/pinterest",{ method:"POST",...json({ url:board }) }));setBoard(saved.board_url);await reload();setNotice("Board reference saved. No Pins were fetched or analyzed."); }); }}><label className="text-sm font-semibold text-[#594273]">Board URL<input type="url" required disabled={locked} maxLength={500} value={board} onChange={event=>setBoard(event.target.value)} placeholder="https://www.pinterest.com/username/board-name/" className={inputClass} /></label><Button type="submit" variant="accent" className="mt-3" disabled={locked || !board.trim()}>Save board reference</Button></form>{view.board_url && <a href={view.board_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-[#594273] underline">Open saved board on Pinterest</a>}</div>}</div></details>}
  </div>;
}

function ProfileSummary({ profile }: { profile:StyleProfile }) {
  return <dl className="divide-y divide-[#eee8f2]">{Object.entries(labels).map(([field,label])=>{
    const value=profile[field as keyof StyleProfile];const text=Array.isArray(value) ? value.join(", ") : value;
    if (!text && (field==="style_summary" || field==="notes")) return null;
    return <div key={field} className="py-3 first:pt-0"><dt className="text-xs font-semibold text-[#8a759d]">{label}</dt><dd className="mt-1 break-words text-sm leading-6 text-[#3e3548]">{text || "Open to exploring"}</dd></div>;
  })}</dl>;
}
function InspirationPhoto({ src,name }: { src:string | null;name:string }) {
  const [failed,setFailed]=useState(false);
  return <div className="flex aspect-[4/5] items-center justify-center bg-[#f3eff6]">{src && !failed ? <img src={src} alt={name} loading="lazy" onError={()=>setFailed(true)} className="h-full w-full object-cover" /> : <p className="p-3 text-center text-xs text-[#756e78]">Preview unavailable. Reload saved progress to refresh.</p>}</div>;
}
