import { AppShell } from "@/components/app-shell";
import { Closet } from "@/components/wardrobe/closet";
import { loadWardrobe } from "@/lib/wardrobe/read";
import { WardrobeError } from "@/lib/wardrobe/service";
import type { WardrobeItem } from "@/lib/wardrobe/schema";

export default async function ClosetPage() {
  let items: WardrobeItem[] = [];
  let warning: string | undefined;
  let error = "";
  try { ({ items, warning } = await loadWardrobe()); }
  catch (cause) { error = cause instanceof WardrobeError ? cause.message : "Could not load your closet. Please try again."; }
  return <AppShell title="My Closet" eyebrow="your pieces, your starting point">
    <Closet aiEnabled={Boolean(process.env.OPENAI_API_KEY?.trim())} initialItems={items} initialError={error} initialWarning={warning} />
  </AppShell>;
}
