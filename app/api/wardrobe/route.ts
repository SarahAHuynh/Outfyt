import { NextResponse } from "next/server";
import { clothingSchema, itemIdSchema, type WardrobeItem } from "@/lib/wardrobe/schema";
import { createWardrobeItem, WardrobeError } from "@/lib/wardrobe/service";
import { BUCKET, checkMutationOrigin, getOwnedItem, readImageForm, validatedImage, wardrobeContext, wardrobeFailure } from "@/lib/wardrobe/server";
import { loadWardrobe } from "@/lib/wardrobe/read";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await loadWardrobe(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return wardrobeFailure(error); }
}

export async function POST(request: Request) {
  try {
    checkMutationOrigin(request);
    const context = await wardrobeContext();
    const { supabase, user } = context;
    const form = await readImageForm(request);
    const id = itemIdSchema.parse(form.get("id"));
    let input: unknown;
    try { input = JSON.parse(String(form.get("attributes"))); }
    catch { throw new WardrobeError("The item details could not be read."); }
    const attributes = clothingSchema.parse(input);
    const image = await validatedImage(form);
    const result = await createWardrobeItem(user.id, id, attributes, image, {
      find: () => getOwnedItem(id, context),
      upload: async (path, bytes, mime) => {
        const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
        if (error) throw new WardrobeError("Could not upload the photo. Nothing was saved. Retry, or reopen the form if an earlier upload was interrupted.", 503);
      },
      insert: async item => {
        const { data, error } = await supabase.from("wardrobe_items").insert(item).select("*").single();
        if (error) throw error;
        return data as WardrobeItem;
      },
      removeImage: async path => {
        const { error } = await supabase.storage.from(BUCKET).remove([path]);
        if (error) throw error;
      },
    });
    return NextResponse.json(result, { status: result.alreadySaved ? 200 : 201 });
  } catch (error) { return wardrobeFailure(error); }
}
