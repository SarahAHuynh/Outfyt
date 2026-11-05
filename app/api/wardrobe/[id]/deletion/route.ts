import { NextResponse } from "next/server";
import { z } from "zod";
import { itemIdSchema } from "@/lib/wardrobe/schema";
import { WardrobeError } from "@/lib/wardrobe/service";
import { BUCKET, checkMutationOrigin, wardrobeContext, wardrobeFailure } from "@/lib/wardrobe/server";
import { readSmallJson } from "@/lib/wardrobe/body";

function rpcFailure(error: { message: string; code?: string }) {
  if (error.code === "PGRST202") throw new WardrobeError("Deletion setup is missing. Run the Milestone 2 SQL migration first.", 503);
  if (error.message.includes("saved outfits") || error.code === "23503") throw new WardrobeError("This piece is used in saved outfits. Remove it from those outfits before deleting it.", 409);
  if (error.message.includes("expired") || error.message.includes("changed")) throw new WardrobeError("This confirmation expired or the piece changed. Refresh and request deletion again.", 409);
  throw new WardrobeError("Deletion could not be authorized. Refresh and try again.", 409);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkMutationOrigin(request);
    const { supabase } = await wardrobeContext();
    const id = itemIdSchema.parse((await params).id);
    const { data, error } = await supabase.rpc("prepare_wardrobe_delete", { p_item_id: id });
    if (error) rpcFailure(error);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return wardrobeFailure(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkMutationOrigin(request);
    const { supabase, user } = await wardrobeContext();
    const id = itemIdSchema.parse((await params).id);
    const { token } = z.object({ token: z.string().uuid() }).parse(await readSmallJson(request));
    // Bind the URL to the persisted action too; the browser cannot substitute
    // another item's ID or supply a new image path to delete.
    const { data: pending, error: pendingError } = await supabase.from("wardrobe_delete_requests").select("item_id").eq("token", token).eq("user_id", user.id).maybeSingle();
    if (pendingError || !pending || pending.item_id !== id) throw new WardrobeError("Deletion confirmation is invalid. Request deletion again.", 409);
    const { data, error } = await supabase.rpc("confirm_wardrobe_delete", { p_token: token });
    if (error) rpcFailure(error);
    let warning: string | undefined;
    if (data.image_path) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([data.image_path]);
      if (storageError) warning = "The piece was deleted, but its private image could not be removed from storage. Storage cleanup is still needed.";
    }
    return NextResponse.json({ id: data.id, warning });
  } catch (error) { return wardrobeFailure(error); }
}
