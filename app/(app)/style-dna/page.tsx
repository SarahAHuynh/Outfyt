import { AppShell } from "@/components/app-shell";
import { StyleEditor } from "@/components/style/editor";
import { loadStyleView } from "@/lib/style/server";
import { wardrobeContext } from "@/lib/wardrobe/server";
import { WardrobeError } from "@/lib/wardrobe/service";
import type { StyleView } from "@/lib/style/schema";

export default async function StyleDNA() {
  let view:StyleView | null=null;let error="";
  try { view=await loadStyleView(await wardrobeContext()); }
  catch(cause) { error=cause instanceof WardrobeError ? cause.message : "Could not load Style DNA. Check the Milestone 4 setup and try again."; }
  return <AppShell title="Style DNA" eyebrow="the feeling behind your favorites"><StyleEditor initialView={view} initialError={error} /></AppShell>;
}
