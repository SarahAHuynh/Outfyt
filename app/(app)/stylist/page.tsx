import { AppShell } from "@/components/app-shell";
import { StylistChat } from "@/components/stylist/chat";
import { loadStylistView } from "@/lib/stylist/server";
import { wardrobeContext } from "@/lib/wardrobe/server";
import { WardrobeError } from "@/lib/wardrobe/service";
import type { StylistView } from "@/lib/stylist/schema";

export default async function StylistPage() {
  let view:StylistView | null = null;
  let error = "";
  try { view = await loadStylistView(await wardrobeContext()); }
  catch(cause) { error = cause instanceof WardrobeError ? cause.message : "Could not load the stylist. Check the Milestone 3 database setup."; }
  return <AppShell title="AI Stylist" eyebrow="a second opinion, whenever you need it"><StylistChat initialView={view} initialError={error} /></AppShell>;
}
