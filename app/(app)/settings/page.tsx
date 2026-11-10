import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ProfileEditor } from "@/components/profile-editor";
import { wardrobeContext } from "@/lib/wardrobe/server";

export default async function Settings() {
  let displayName="";let email="";let updatedAt:string | null=null;let error="";
  try {
    const { supabase,user }=await wardrobeContext();email=user.email || "";
    const result=await supabase.from("profiles").select("display_name,updated_at").eq("id",user.id).maybeSingle();
    if (result.error || !result.data) error="Could not load your profile. Refresh this page to try again.";
    else { displayName=result.data.display_name || "";updatedAt=result.data.updated_at; }
  } catch { error="Could not load your account. Refresh or sign in again."; }
  return <AppShell title="Settings" eyebrow="your account, your control" contentClassName="mx-auto w-full max-w-2xl"><div className="space-y-5"><section className="rounded-3xl border border-[#ebe7e7] bg-white p-7"><h2 className="serif text-2xl">Your profile</h2><p className="mt-2 text-sm text-[#756e78]">A name that feels like you.</p><ProfileEditor key={updatedAt || "unavailable"} displayName={displayName} email={email} updatedAt={updatedAt} initialError={error} /></section><section className="rounded-3xl border border-[#ebe7e7] bg-white p-7"><h2 className="serif text-2xl">Your inspiration</h2><p className="mt-2 text-sm leading-6 text-[#756e78]">Manage your style preferences and private inspiration in Style DNA. Pinterest board links are optional bookmarks; board synchronization is not connected.</p><Link href="/style-dna" className="mt-5 inline-flex rounded-full bg-[#594273] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#47345d]">Open Style DNA</Link></section></div></AppShell>;
}
