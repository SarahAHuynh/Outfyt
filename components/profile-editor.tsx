"use client";
import { useState,type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "./ui";
import { readApiResponse } from "./wardrobe/item-editor";
import { profileUpdateSchema } from "@/lib/profile/schema";

export function ProfileEditor({ displayName,email,updatedAt,initialError }: { displayName:string;email:string;updatedAt:string | null;initialError:string }) {
  const [name,setName]=useState(displayName);const [version,setVersion]=useState(updatedAt);
  const [busy,setBusy]=useState(false);const [error,setError]=useState(initialError);const [notice,setNotice]=useState("");
  async function save(event:FormEvent) {
    event.preventDefault();setError("");setNotice("");
    const parsed=profileUpdateSchema.safeParse({ display_name:name,updated_at:version });
    if (!parsed.success) { setError(parsed.error.issues[0].message);return; }
    setBusy(true);
    try {
      const result=await readApiResponse(await fetch("/api/profile",{ method:"PATCH",headers:{ "Content-Type":"application/json" },body:JSON.stringify(parsed.data) }));
      setName(result.display_name);setVersion(result.updated_at);setNotice("Your display name is saved.");
    } catch(cause) { setError(cause instanceof Error ? cause.message : "Could not save your display name."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="mt-6 space-y-4"><fieldset disabled={busy || !version} className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-[#594273]">Display name<input value={name} maxLength={100} required onChange={event=>setName(event.target.value)} autoComplete="nickname" className="mt-2 w-full rounded-xl border border-[#ded5e7] px-4 py-3" /></label><label className="text-sm font-medium text-[#594273]">Email<input value={email} readOnly aria-readonly="true" autoComplete="email" className="mt-2 w-full rounded-xl border border-[#ebe7e7] bg-[#f9f7f4] px-4 py-3 text-[#756e78]" /></label></fieldset><p className="text-xs leading-5 text-[#756e78]">Your email is managed through your sign-in account. Changing your display name keeps your wardrobe and Style DNA intact.</p>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}<Button variant="accent" disabled={busy || !version || !name.trim()} type="submit">{busy && <LoaderCircle className="mr-2 h-4 w-4 motion-safe:animate-spin" />}Save changes</Button></form>;
}
