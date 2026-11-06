"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Send, Sparkles, LoaderCircle, RefreshCw, Bookmark, History } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { readApiResponse } from "@/components/wardrobe/item-editor";
import type { StylistEvent, StylistView } from "@/lib/stylist/schema";
import { OutfitCard } from "./outfit-card";
import { PendingActionCard } from "./pending-action";

const stageNames:Record<string,string> = {
  get_wardrobe:"Looking through your closet...",get_wardrobe_item:"Checking that piece...",get_style_profile:"Reading your Style DNA...",
  generate_outfits:"Creating outfit combinations...",save_outfit:"Saving your look...",get_saved_outfits:"Opening your lookbook...",
  update_outfit:"Updating your saved look...",add_clothing_item:"Adding your clothing item...",update_clothing_item:"Updating your clothing item...",
  delete_outfit:"Preparing an outfit deletion for review...",delete_clothing_item:"Preparing a clothing deletion for review...",
  update_style_profile:"Preparing Style DNA changes for review...",analyze_inspiration:"Analyzing your inspiration image...",
};

export function StylistChat({ initialView,initialError }: { initialView:StylistView | null; initialError:string }) {
  const [view,setView] = useState(initialView);
  const [draft,setDraft] = useState("");
  const [busy,setBusy] = useState(false);
  const [stage,setStage] = useState("");
  const [pendingUser,setPendingUser] = useState("");
  const [error,setError] = useState(initialError);
  const [notice,setNotice] = useState("");
  const [saving,setSaving] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => { end.current?.scrollIntoView({ behavior:"smooth",block:"nearest" }); },[view?.messages.length,pendingUser,stage]);

  async function reload(clearError = true) {
    try { setView(await readApiResponse(await fetch("/api/stylist",{ cache:"no-store" }))); if (clearError) setError(""); }
    catch(cause) { setError(cause instanceof Error ? cause.message : "Could not reload the conversation."); }
  }
  function receive(event:StylistEvent) {
    if (event.type === "stage") setStage(stageNames[event.text] || event.text);
    if (event.type === "error") setError(event.error);
  }
  async function submit(event:FormEvent) {
    event.preventDefault(); const message = draft.trim(); if (!message || busy) return;
    setBusy(true); setPendingUser(message); setError(""); setNotice(""); setStage("Starting your stylist request...");
    try {
      const response = await fetch("/api/stylist",{ method:"POST",headers:{ "Content-Type":"application/json" },body:JSON.stringify({ request_id:crypto.randomUUID(),message }) });
      if (!response.ok) { await readApiResponse(response); return; }
      setDraft("");
      if (response.headers.get("content-type")?.includes("application/x-ndjson")) {
        const reader = response.body?.getReader(); if (!reader) throw new Error("The response was interrupted. Refresh the conversation before trying again.");
        const decoder = new TextDecoder(); let buffer = "";
        while (true) {
          const { done,value } = await reader.read(); if (done) break;
          buffer += decoder.decode(value,{ stream:true }); const lines = buffer.split("\n"); buffer = lines.pop() || "";
          for (const line of lines) if (line.trim()) receive(JSON.parse(line));
        }
        buffer += decoder.decode(); if (buffer.trim()) receive(JSON.parse(buffer));
      } else await readApiResponse(response);
      await reload(false); router.refresh();
    } catch(cause) { setError(cause instanceof Error ? cause.message : "The request was interrupted. Refresh action history before trying again."); }
    finally { setBusy(false); setStage(""); setPendingUser(""); }
  }
  async function saveCandidate(id:string) {
    setSaving(id); setError("");
    try { await readApiResponse(await fetch("/api/outfits",{ method:"POST",headers:{ "Content-Type":"application/json" },body:JSON.stringify({ candidate_id:id }) })); setNotice("Outfit saved to your lookbook."); await reload(); router.refresh(); }
    catch(cause) { setError(cause instanceof Error ? cause.message : "Could not save that outfit."); }
    finally { setSaving(null); }
  }

  return <div className="mx-auto max-w-4xl space-y-5">
    <section className="overflow-hidden rounded-3xl border border-[#e4dce9] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe7e7] p-5"><div className="flex items-center gap-3"><div className="rounded-2xl bg-[#eee9f4] p-3 text-[#594273]"><Sparkles /></div><div><h2 className="serif text-2xl">Your personal stylist</h2><p className="text-xs text-[#756e78]">Real pieces. Thoughtful combinations.</p></div></div><Button variant="ghost" disabled={busy} onClick={() => void reload()} aria-label="Refresh conversation"><RefreshCw className="h-4 w-4" /></Button></div>
      <div className="max-h-[65dvh] min-h-[320px] space-y-5 overflow-y-auto p-5 sm:p-7" aria-label="Stylist conversation">
        {!view?.messages.length && !busy && <div className="py-10 text-center"><Sparkles className="mx-auto h-9 w-9 text-[#a69ac5]" /><h3 className="serif mt-4 text-3xl">What are we wearing?</h3><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#756e78]">Ask for a look, save a favorite, or update an outfit. Complete looks need a dress or top and bottom, plus shoes.</p><div className="mt-5 flex flex-wrap justify-center gap-2">{["Make me a cute outfit for brunch.","Give me three casual looks.","Show my saved outfits."].map(text => <button key={text} onClick={() => setDraft(text)} className="rounded-full border border-[#e0d7e9] px-3 py-2 text-xs text-[#594273] hover:bg-[#eee9f4]">{text}</button>)}</div></div>}
        {view?.messages.map(message => <div key={message.id} className={message.role === "user" ? "ml-auto max-w-[85%]" : "max-w-full"}><p className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-7 ${message.role === "user" ? "bg-[#594273] text-white" : "bg-[#f6f3f8] text-[#3e3548]"}`}>{message.content}</p>{message.role === "assistant" && message.candidates.length > 0 && <div className="mt-4 grid gap-4 lg:grid-cols-2">{message.candidates.map(candidate => <OutfitCard key={candidate.id} name={candidate.name} description={candidate.description} explanation={candidate.explanation} ordinal={candidate.ordinal} itemIds={candidate.item_ids} wardrobe={view.wardrobe} footer={<Button variant="accent" disabled={Boolean(saving) || busy} onClick={() => void saveCandidate(candidate.id)}><Bookmark className="mr-2 h-4 w-4" />{saving === candidate.id ? "Saving..." : "Save look"}</Button>} />)}</div>}</div>)}
        {pendingUser && <p className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-[#594273] px-4 py-3 text-sm leading-7 text-white">{pendingUser}</p>}
        {busy && <p role="status" className="flex items-center gap-2 text-sm text-[#594273]"><LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />{stage}</p>}
        <div ref={end} />
      </div>
      <form onSubmit={submit} className="border-t border-[#ebe7e7] p-4"><label htmlFor="stylist-message" className="sr-only">Message your stylist</label><div className="flex items-end gap-2 rounded-2xl bg-[#f6f3f8] p-2"><textarea id="stylist-message" maxLength={2000} rows={2} value={draft} disabled={busy} onChange={event => setDraft(event.target.value)} placeholder="Tell me what you are in the mood for..." className="min-w-0 flex-1 resize-y bg-transparent p-2 text-sm leading-6 outline-none" /><Button type="submit" variant="accent" disabled={busy || !draft.trim()} aria-label="Send message" className="rounded-xl p-3 disabled:opacity-50"><Send className="h-5 w-5" /></Button></div><p className="mt-2 text-xs text-[#756e78]">AI suggestions can be imperfect. Deletions and preference changes require your separate approval.</p></form>
    </section>
    {error && <div role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">{error}<button disabled={busy} onClick={() => void reload()} className="ml-2 underline">Refresh history</button></div>}
    {notice && <p role="status" className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">{notice} <Link href="/lookbook" className="underline">Open lookbook</Link></p>}
    {view?.pending.filter(action => action.status === "awaiting_confirmation").map(action => <PendingActionCard key={action.token} action={action} onResolved={message => { setNotice(message); void reload(); router.refresh(); }} />)}
    <details className="rounded-2xl border border-[#e4dce9] bg-white p-5"><summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#594273]"><History className="h-4 w-4" />Action history ({view?.logs.length || 0} recent)</summary><p className="mt-3 text-xs text-[#756e78]">Database-confirmed tool execution; private images and API credentials are never included.</p><ol className="mt-4 space-y-3">{view?.logs.map(log => <li key={log.id} className="border-t border-[#ebe7e7] pt-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span>{log.action_name.replaceAll("_"," ")}</span><span className={log.status === "completed" ? "text-emerald-700" : log.status === "failed" || log.status === "rejected" ? "text-rose-700" : "text-amber-800"}>{log.status.replaceAll("_"," ")}</span></div><p className="mt-1 text-xs text-[#756e78]">{new Date(log.created_at).toLocaleString()}{log.confirmation_status === "approved" ? " · Approved by you" : ""}</p>{log.error_message && <p className="mt-1 text-xs text-rose-800">{log.error_message}</p>}</li>)}</ol>{!view?.logs.length && <p className="mt-3 text-sm text-[#756e78]">Executed actions will appear here.</p>}</details>
  </div>;
}
