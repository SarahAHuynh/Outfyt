import { AppShell } from "@/components/app-shell";
import { Lookbook } from "@/components/stylist/lookbook";
import { savedOutfits } from "@/lib/stylist/server";
import { wardrobeContext } from "@/lib/wardrobe/server";
import { loadWardrobe } from "@/lib/wardrobe/read";
import { WardrobeError } from "@/lib/wardrobe/service";
import type { SavedOutfit } from "@/lib/stylist/schema";
import type { WardrobeItem } from "@/lib/wardrobe/schema";

export default async function LookbookPage() {
  let outfits:SavedOutfit[] = [], wardrobe:WardrobeItem[] = [];
  let error = "";
  try { const context = await wardrobeContext(); const [saved,closet] = await Promise.all([savedOutfits(context),loadWardrobe()]); outfits = saved; wardrobe = closet.items; }
  catch(cause) { error = cause instanceof WardrobeError ? cause.message : "Could not load the lookbook."; }
  return <AppShell title="My Lookbook" eyebrow="the looks worth repeating"><Lookbook initialOutfits={outfits} initialWardrobe={wardrobe} initialError={error} /></AppShell>;
}
