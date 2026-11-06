import type { SupabaseClient } from "@supabase/supabase-js";
import { WardrobeError } from "@/lib/wardrobe/service";
import type { SavedOutfit } from "./schema";

export async function readSavedOutfits(client: Pick<SupabaseClient,"from">,userId:string):Promise<SavedOutfit[]> {
  // Avoid a PostgREST embedded join: both the simple FK and composite ownership
  // FK connect these tables, which makes an unhinted relationship ambiguous.
  const { data:outfits,error } = await client.from("outfits").select("*").eq("user_id",userId).order("created_at",{ ascending:false }).limit(100);
  if (error) throw new WardrobeError("Could not load your saved looks. Refresh to try again.",503);
  if (!outfits?.length) return [];
  const { data:links,error:linkError } = await client.from("outfit_items").select("outfit_id,wardrobe_item_id,position").eq("user_id",userId).in("outfit_id",outfits.map(outfit => outfit.id));
  if (linkError) throw new WardrobeError("Your looks exist, but their clothing could not be loaded. Refresh to try again.",503);
  return outfits.map(outfit => ({
    id:outfit.id,name:outfit.name,occasion:outfit.occasion || "",aesthetic:outfit.aesthetic || "",description:outfit.description || "",
    is_favorite:outfit.is_favorite,updated_at:outfit.updated_at,
    item_ids:(links || []).filter(item => item.outfit_id === outfit.id).sort((a,b) => a.position-b.position).map(item => item.wardrobe_item_id),
  }));
}
