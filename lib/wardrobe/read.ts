import "server-only";
import { BUCKET, wardrobeContext } from "./server";
import { WardrobeError } from "./service";
import type { WardrobeItem } from "./schema";

export async function loadWardrobe() {
  const { supabase, user } = await wardrobeContext();
  const { data, error } = await supabase.from("wardrobe_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) throw new WardrobeError("Could not load your closet. Please try again.", 503);
  const items = (data || []) as WardrobeItem[];
  const paths = items.flatMap(item => item.image_path ? [item.image_path] : []);
  const signed = paths.length ? await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600) : { data: [], error: null };
  const urls = new Map(signed.data?.map(image => [image.path, image.signedUrl]));
  return { items: items.map(item => ({ ...item, image_url: item.image_path ? urls.get(item.image_path) || null : null })), warning: signed.error ? "Some photos could not be loaded. Refresh to try again." : undefined };
}
