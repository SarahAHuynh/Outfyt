import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { WardrobeError } from "./service";
import { readBoundedBytes } from "./body";
import { imageExtension, imageMetadataError, MAX_IMAGE_BYTES, type WardrobeItem } from "./schema";

export const BUCKET = "wardrobe-images";

export function checkMutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new WardrobeError("This request must come from your Outfyt app.", 403);
}

export async function wardrobeContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new WardrobeError("Your session expired. Sign in again.", 401);
  return { supabase, user };
}

// Bound the complete multipart body even if a client omits Content-Length.
export async function readImageForm(request: Request) {
  const maxBodyBytes = MAX_IMAGE_BYTES + 64 * 1024;
  if (Number(request.headers.get("content-length")) > maxBodyBytes) throw new WardrobeError("Upload exceeds the 10 MB image limit.", 413);
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) throw new WardrobeError("Send the image using the upload form.");
  const buffer = await readBoundedBytes(request, maxBodyBytes);
  try { return await new Response(buffer, { headers: { "content-type": request.headers.get("content-type")! } }).formData(); }
  catch { throw new WardrobeError("Could not read the upload. Please choose the image again."); }
}

export async function validatedImage(form: FormData, required = false) {
  const file = form.get("image");
  if (file === null) {
    if (required) throw new WardrobeError("Choose a clothing photo first.");
    return null;
  }
  if (!(file instanceof File)) throw new WardrobeError("Choose a valid image file.");
  const issue = imageMetadataError(file);
  if (issue) throw new WardrobeError(issue, 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = imageExtension(bytes, file.type);
  if (!extension) throw new WardrobeError("This file does not match its image type. Choose a valid JPEG, PNG, or WebP photo.");
  return { bytes, mime: file.type, extension };
}

export async function getOwnedItem(id: string, context: Awaited<ReturnType<typeof wardrobeContext>>) {
  const { data, error } = await context.supabase.from("wardrobe_items").select("*").eq("id", id).eq("user_id", context.user.id).maybeSingle();
  if (error) throw new WardrobeError("Could not load this piece. Please try again.", 503);
  return data as WardrobeItem | null;
}

export function wardrobeFailure(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Check the item details." }, { status: 400 });
  if (error instanceof WardrobeError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json({ error: "The closet service is unavailable. Please try again shortly." }, { status: 503 });
}
