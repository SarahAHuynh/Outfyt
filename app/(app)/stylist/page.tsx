import { AppShell } from "@/components/app-shell";
import { StylistChat } from "@/components/stylist/chat";
import { loadStylistView } from "@/lib/stylist/server";
import { wardrobeContext } from "@/lib/wardrobe/server";
import { WardrobeError } from "@/lib/wardrobe/service";
import type { StylistView } from "@/lib/stylist/schema";
import { z } from "zod";

export default async function StylistPage({ searchParams }: { searchParams:Promise<{ chat?:string }> }) {
  let view:StylistView | null = null;
  let error = "";
  const { chat } = await searchParams;
  try { view = await loadStylistView(await wardrobeContext(),z.string().uuid().optional().parse(chat)); }
  catch(cause) { error = cause instanceof WardrobeError ? cause.message : "Could not load the stylist. Check the Milestone 3 database setup."; }
  return <AppShell title="AI Stylist" eyebrow="a second opinion, whenever you need it"><StylistChat key={view?.active_chat_id || "empty"} initialView={view} initialError={error} /></AppShell>;
}
