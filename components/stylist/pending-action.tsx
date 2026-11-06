"use client";
import { useState } from "react";
import { ShieldCheck, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui";
import { readApiResponse } from "@/components/wardrobe/item-editor";
import type { PendingAction } from "@/lib/stylist/schema";

export function PendingActionCard({ action,onResolved }: { action:PendingAction; onResolved:(message:string) => void }) {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const title = action.action_name === "update_style_profile" ? "Review Style DNA changes" : action.action_name === "delete_clothing_item" ? "Delete clothing item?" : "Delete saved outfit?";
  async function resolve(approve:boolean) {
    setBusy(true); setError("");
    try {
      const data = await readApiResponse(await fetch("/api/stylist/approval",{ method:"POST",headers:{ "Content-Type":"application/json" },body:JSON.stringify({ token:action.token,approve }) }));
      onResolved(data.warning || data.result?.message || "Action resolved.");
    } catch(cause) { setError(cause instanceof Error ? cause.message : "Could not resolve this action."); }
    finally { setBusy(false); }
  }
  const proposal = action.payload.proposal as Record<string,unknown> | undefined;
  return <section aria-label={title} className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
    <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5" />{title}</h3>
    <p className="mt-2 leading-6">{String(action.payload.name || "Requested action")}</p>
    {proposal && <dl className="mt-3 space-y-2">{Object.entries(proposal).map(([key,value]) => <div key={key}><dt className="font-semibold">{key.replaceAll("_"," ")}</dt><dd className="break-words">{Array.isArray(value) ? value.join(", ") || "None" : String(value || "None")}</dd></div>)}</dl>}
    {action.status === "awaiting_confirmation" ? <><p className="mt-3 text-xs leading-5">Nothing has changed yet. Approval expires at {new Date(action.expires_at).toLocaleTimeString()}. {action.action_name === "update_style_profile" ? "Approval replaces the listed style preferences." : "Deletion cannot be undone."}</p><div className="mt-4 flex flex-wrap gap-2"><Button disabled={busy} variant="ghost" onClick={() => void resolve(false)}>Keep unchanged</Button><Button disabled={busy} variant="accent" onClick={() => void resolve(true)}>{busy ? <LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> : null}{action.action_name === "update_style_profile" ? "Approve changes" : "Confirm deletion"}</Button></div></> : <p className="mt-3 font-semibold">{action.result?.message ? String(action.result.message) : action.status === "completed" ? "Action completed." : "Action rejected or expired."}</p>}
    {error && <p role="alert" className="mt-3 text-rose-800">{error}</p>}
  </section>;
}
