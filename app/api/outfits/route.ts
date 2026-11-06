import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readSmallJson } from "@/lib/wardrobe/body";
import { checkMutationOrigin, wardrobeContext, wardrobeFailure } from "@/lib/wardrobe/server";
import { loadWardrobe } from "@/lib/wardrobe/read";
import { checkRpc, recordAction, savedOutfits, writeOutfit } from "@/lib/stylist/server";
import { outfitDetailsSchema } from "@/lib/stylist/schema";
import { WardrobeError } from "@/lib/wardrobe/service";

export async function GET() {
  try {
    const context = await wardrobeContext();
    const [outfits,wardrobe] = await Promise.all([savedOutfits(context),loadWardrobe()]);
    return NextResponse.json({ outfits,wardrobe:wardrobe.items,warning:wardrobe.warning },{ headers:{ "Cache-Control":"private, no-store" } });
  } catch(error) { return wardrobeFailure(error); }
}

export async function POST(request: Request) {
  try {
    checkMutationOrigin(request); const context = await wardrobeContext();
    const { candidate_id } = z.object({ candidate_id:z.string().uuid() }).parse(await readSmallJson(request));
    const { data,error } = await context.supabase.from("outfit_candidates").select("payload").eq("id",candidate_id).eq("user_id",context.user.id).maybeSingle(); checkRpc(error);
    if (!data) throw new WardrobeError("This outfit candidate is unavailable. Generate a new look.",404);
    const details = outfitDetailsSchema.parse(data.payload); const logId = randomUUID();
    await recordAction(context,logId,"save_outfit",{ candidate_id },"pending");
    try {
      const outfit = await writeOutfit(context,candidate_id,{ ...details,is_favorite:false },details.item_ids,null);
      await recordAction(context,logId,"save_outfit",{ candidate_id },"completed");
      return NextResponse.json({ outfit });
    } catch(error) { await recordAction(context,logId,"save_outfit",{ candidate_id },"failed","Could not verify the save. Refresh the lookbook before retrying."); throw error; }
  } catch(error) { return wardrobeFailure(error); }
}
