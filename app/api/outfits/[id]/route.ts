import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readSmallJson } from "@/lib/wardrobe/body";
import { checkMutationOrigin, wardrobeContext, wardrobeFailure } from "@/lib/wardrobe/server";
import { prepareAction, recordAction, writeOutfit } from "@/lib/stylist/server";
import { outfitUpdateSchema } from "@/lib/stylist/schema";

export async function PATCH(request: Request,{ params }: { params:Promise<{ id:string }> }) {
  try {
    checkMutationOrigin(request); const context = await wardrobeContext();
    const id = z.string().uuid().parse((await params).id); const input = outfitUpdateSchema.parse(await readSmallJson(request));
    const logId = randomUUID(); await recordAction(context,logId,"update_outfit",{ id,item_count:input.item_ids.length },"pending");
    try {
      const outfit = await writeOutfit(context,id,input,input.item_ids,input.updated_at);
      await recordAction(context,logId,"update_outfit",{ id },"completed"); return NextResponse.json({ outfit });
    } catch(error) { await recordAction(context,logId,"update_outfit",{ id },"failed","Could not verify the update. Refresh before retrying."); throw error; }
  } catch(error) { return wardrobeFailure(error); }
}

export async function DELETE(request: Request,{ params }: { params:Promise<{ id:string }> }) {
  try {
    checkMutationOrigin(request); const context = await wardrobeContext();
    const id = z.string().uuid().parse((await params).id);
    return NextResponse.json(await prepareAction(context,"delete_outfit",{ id }),{ headers:{ "Cache-Control":"no-store" } });
  } catch(error) { return wardrobeFailure(error); }
}
