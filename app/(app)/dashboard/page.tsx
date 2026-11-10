import Link from "next/link";
import { ArrowRight,Sparkles,Shirt,Palette,Bookmark,Star } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyCard,Stat } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

type RecentLook={ id:string;name:string;description:string | null;is_favorite:boolean };
export default async function Dashboard() {
  const { stats,recent }=await loadDashboard();
  return <AppShell title="Welcome to your studio." eyebrow="your closet. your aesthetic. your way."><div className="grid gap-5 xl:grid-cols-[1.4fr_.8fr]"><section className="rounded-3xl bg-[#d9cee4] p-8 md:p-10"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[#594273]">your next great outfit</p><h2 className="serif mt-3 max-w-md text-4xl leading-tight">What are we getting dressed for?</h2><p className="mt-4 max-w-sm text-sm leading-6 text-[#665872]">Tell your stylist the occasion and the mood. We’ll find combinations in your closet that feel like you.</p></div><Sparkles className="h-7 w-7 shrink-0 text-[#71638e]" /></div><Link href="/stylist" className="mt-8 inline-flex items-center rounded-full bg-[#594273] px-5 py-3 text-sm font-semibold text-white hover:bg-[#47345d]">Ask the stylist<ArrowRight className="ml-2 h-4 w-4" /></Link></section><section aria-label="Wardrobe statistics" className="rounded-3xl border border-[#ebe7e7] bg-white p-8"><p className="text-sm font-semibold text-[#756e78]">your closet at a glance</p><div className="mt-8 grid grid-cols-2 gap-7"><Stat number={stats.pieces} label="pieces" /><Stat number={stats.looks} label="saved looks" /><Stat number={stats.style} label="style DNA" /><Stat number={stats.favorites} label="favorites" /></div></section></div>
    <div className="mt-6 grid gap-3 xl:grid-cols-3">{[{ href:"/closet",title:"Build your closet",description:"Add your everyday pieces.",icon:Shirt },{ href:"/style-dna",title:"Define your Style DNA",description:"Make your preferences yours.",icon:Palette },{ href:"/lookbook",title:"Start your lookbook",description:"Keep your favorite outfits.",icon:Bookmark }].map(({ href,title,description,icon:Icon })=><Link key={href} href={href} className="group flex items-center gap-3 rounded-2xl border border-[#ebe7e7] bg-white px-4 py-4 transition-colors hover:border-[#c9bddb] hover:bg-[#f6f2fa]"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eee9f4] text-[#71638e]"><Icon aria-hidden="true" className="h-[18px] w-[18px]" /></span><span className="min-w-0 flex-1"><span className="serif block text-lg leading-snug">{title}</span><span className="mt-1 block text-xs leading-5 text-[#756e78]">{description}</span></span><ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#71638e]" /></Link>)}</div>
    <section className="mt-8"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="serif text-2xl">Recent looks</h2>{Boolean(recent?.length) && <Link href="/lookbook" className="text-sm font-semibold text-[#594273] underline">View lookbook</Link>}</div>{recent===null ? <p className="rounded-2xl border border-[#ebe7e7] bg-white p-6 text-sm text-[#756e78]">We couldn’t load recent looks. Refresh to try again.</p> : recent.length ? <div className="grid gap-4 sm:grid-cols-3">{recent.map(look=><Link key={look.id} href="/lookbook" className="rounded-2xl border border-[#e4dce9] bg-white p-5 transition hover:border-[#b7a2cc]"><div className="flex items-start justify-between gap-2"><h3 className="serif break-words text-xl">{look.name}</h3>{look.is_favorite && <Star aria-label="Favorite look" className="h-4 w-4 shrink-0 fill-[#c9b0dc] text-[#8a6aa5]" />}</div><p className="mt-2 line-clamp-3 text-sm leading-6 text-[#756e78]">{look.description || "A combination from your own closet."}</p><span className="mt-4 inline-flex items-center text-xs font-semibold text-[#594273]">Open in lookbook<ArrowRight className="ml-1 h-3 w-3" /></span></Link>)}</div> : <EmptyCard title="Your lookbook is waiting" text="Save a look you love, and find it here whenever you need a little inspiration." action={<Link href="/stylist" className="text-sm font-semibold text-[#594273]">Create your first look<ArrowRight className="ml-1 inline h-4 w-4" /></Link>} />}</section>
  </AppShell>;
}
async function loadDashboard() {
  const unavailable={ stats:{ pieces:"—",looks:"—",favorites:"—",style:"—" },recent:null as RecentLook[] | null };
  try {
    const supabase=await createClient();const { data:{ user } }=await supabase.auth.getUser();if (!user) return unavailable;
    const [pieces,looks,favorites,style,recent]=await Promise.all([
      supabase.from("wardrobe_items").select("id",{ count:"exact",head:true }).eq("user_id",user.id),
      supabase.from("outfits").select("id",{ count:"exact",head:true }).eq("user_id",user.id),
      supabase.from("outfits").select("id",{ count:"exact",head:true }).eq("user_id",user.id).eq("is_favorite",true),
      supabase.from("style_profiles").select("id",{ count:"exact",head:true }).eq("user_id",user.id),
      supabase.from("outfits").select("id,name,description,is_favorite").eq("user_id",user.id).order("created_at",{ ascending:false }).limit(3),
    ]);
    return { stats:{ pieces:pieces.error ? "—" : String(pieces.count ?? 0),looks:looks.error ? "—" : String(looks.count ?? 0),favorites:favorites.error ? "—" : String(favorites.count ?? 0),style:style.error || !style.count ? "—" : "Set" },recent:recent.error ? null : recent.data as RecentLook[] };
  } catch { return unavailable; }
}
