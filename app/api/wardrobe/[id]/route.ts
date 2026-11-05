import { NextResponse } from "next/server";
import { itemIdSchema, updateItemSchema } from "@/lib/wardrobe/schema";
import { requireOwnedItem, WardrobeError } from "@/lib/wardrobe/service";
import { checkMutationOrigin, getOwnedItem, wardrobeContext, wardrobeFailure } from "@/lib/wardrobe/server";
import { readSmallJson } from "@/lib/wardrobe/body";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkMutationOrigin(request);
    const context = await wardrobeContext();
    const id = itemIdSchema.parse((await params).id);
    const input = updateItemSchema.parse(await readSmallJson(request));
    requireOwnedItem(await getOwnedItem(id, context), context.user.id);
    const { updated_at, ...attributes } = input;
    const { data, error } = await context.supabase.from("wardrobe_items").update(attributes).eq("id", id).eq("user_id", context.user.id).eq("updated_at", updated_at).select("*").maybeSingle();
    if (error) throw new WardrobeError("Could not save the changes. Please try again.", 503);
    if (!data) throw new WardrobeError("This piece changed in another tab. Refresh before editing again.", 409);
    return NextResponse.json({ item: data });
  } catch (error) { return wardrobeFailure(error); }
}
