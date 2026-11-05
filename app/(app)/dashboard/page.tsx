import { createClient } from "@/lib/supabase/server";
import Link from "next/link"; import { ArrowRight, Sparkles, Shirt, Palette, Bookmark } from "lucide-react"; import { AppShell } from "@/components/app-shell"; import { EmptyCard, Stat } from "@/components/ui";
export default async function Dashboard() { const stats = await loadStats(); return <AppShell title="Welcome to your studio." eyebrow="your closet. your aesthetic. your way."><div className="grid gap-5 xl:grid-cols-[1.4fr_.8fr]"><section className="rounded-3xl bg-[#d9cee4] p-8 md:p-10"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-[#71638e]">your next great outfit</p><h2 className="serif mt-3 max-w-md text-4xl leading-tight">What are we getting dressed for?</h2><p className="mt-4 max-w-sm text-sm leading-6 text-[#716e78]">Your styling space is taking shape. AI recommendations will be available in the AI Stylist milestone.</p></div><Sparkles className="h-7 w-7 text-[#71638e]" /></div><Link href="/stylist" className="mt-8 inline-flex items-center rounded-full bg-[#28262b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#71638e]">Ask the stylist <ArrowRight className="ml-2 h-4 w-4" /></Link></section><div className="rounded-3xl border border-[#ebe7e7] bg-white p-8"><p className="text-sm font-semibold text-[#756e78]">your closet at a glance</p><div className="mt-8 grid grid-cols-2 gap-7"><Stat number={stats.pieces} label="pieces" /><Stat number={stats.looks} label="saved looks" /><Stat number={stats.style} label="style DNA" /><Stat number={stats.favorites} label="favorites" /></div></div></div><div className="mt-6 grid gap-3 xl:grid-cols-3">{[
  { href: "/closet", title: "Build your closet", description: "Add your everyday pieces.", icon: Shirt },
  { href: "/style-dna", title: "Define your Style DNA", description: "Make your preferences yours.", icon: Palette },
  { href: "/lookbook", title: "Start your lookbook", description: "Keep your favorite outfits.", icon: Bookmark },
].map(({ href, title, description, icon: Icon }) => (
  <Link key={href} href={href} className="group flex items-center gap-3 rounded-2xl border border-[#ebe7e7] bg-white px-4 py-4 transition-colors hover:border-[#c9bddb] hover:bg-[#f6f2fa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#71638e]">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eee9f4] text-[#71638e]"><Icon aria-hidden="true" className="h-[18px] w-[18px]" /></span>
    <span className="min-w-0 flex-1"><span className="serif block text-lg leading-snug">{title}</span><span className="mt-1 block text-xs leading-5 text-[#756e78]">{description}</span></span>
    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#71638e] transition-transform motion-safe:group-hover:translate-x-0.5" />
  </Link>
))}</div><div className="mt-8"><h2 className="serif mb-4 text-2xl">Recent looks</h2><EmptyCard title="Your lookbook is waiting" text="Once you save an outfit, your favorite looks will live here." action={<Link href="/stylist" className="text-sm font-semibold text-[#71638e]">Create your first look <ArrowRight className="ml-1 inline h-4 w-4" /></Link>} /></div></AppShell>; }

async function loadStats() {
  const unavailable = { pieces: "—", looks: "—", favorites: "—", style: "—" };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unavailable;
    const [pieces, looks, favorites, style] = await Promise.all([
      supabase.from("wardrobe_items").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("outfits").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("outfits").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_favorite", true),
      supabase.from("style_profiles").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);
    return {
      pieces: pieces.error ? "—" : String(pieces.count ?? 0),
      looks: looks.error ? "—" : String(looks.count ?? 0),
      favorites: favorites.error ? "—" : String(favorites.count ?? 0),
      style: style.error ? "—" : style.count ? "Set" : "—",
    };
  } catch { return unavailable; }
}
