import { z } from "zod";
import type { WardrobeItem } from "@/lib/wardrobe/schema";
import type { PhotoBatch } from "./photos";

export const outfitDetailsSchema = z.object({
  name: z.string().trim().min(1).max(100), occasion: z.string().trim().max(100),
  aesthetic: z.string().trim().max(150), description: z.string().trim().max(1000),
  explanation: z.string().trim().max(1000), item_ids: z.array(z.string().uuid()).min(1).max(12),
});
export const outfitGenerationSchema = z.object({ outfits: z.array(outfitDetailsSchema).max(3), limitations: z.array(z.string().max(400)).max(6) });
export const styleProposalSchema = z.object({
  aesthetic_tags: z.array(z.string().trim().min(1).max(40)).max(12), preferred_colors: z.array(z.string().trim().min(1).max(40)).max(12),
  favorite_clothing_types: z.array(z.string().trim().min(1).max(40)).max(12), disliked_styles: z.array(z.string().trim().min(1).max(40)).max(12),
  style_summary: z.string().trim().max(1000),
});
export const chatRequestSchema = z.object({ request_id: z.string().uuid(), message: z.string().trim().min(1).max(2000),chat_id:z.string().uuid().optional() });
export const outfitUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100), occasion: z.string().trim().max(100), aesthetic: z.string().trim().max(150),
  description: z.string().trim().max(1000), item_ids: z.array(z.string().uuid()).min(1).max(12),
  is_favorite: z.boolean(), updated_at: z.string().datetime({ offset: true }),
});

export type OutfitDetails = z.infer<typeof outfitDetailsSchema>;
export type OutfitCandidate = OutfitDetails & { id: string; turn_id: string; ordinal: number };
export type SavedOutfit = { id: string; name: string; occasion: string; aesthetic: string; description: string; is_favorite: boolean; updated_at: string; item_ids: string[] };
export type PendingAction = { token: string; action_name: string; payload: Record<string, unknown>; status: string; expires_at: string; result: Record<string, unknown> | null };
export type ActionLog = { id: string; action_name: string; sanitized_arguments: Record<string, unknown>; status: string; confirmation_status: string | null; error_message: string | null; created_at: string };
export type StylistMessage = { id: string; role: "user" | "assistant"; content: string; turn_id: string | null; candidates: OutfitCandidate[]; reference_photos?:PhotoBatch };
export type StylistChatSummary = { id:string; title:string; updated_at:string };
export type StylistView = { messages: StylistMessage[]; candidates: OutfitCandidate[]; pending: PendingAction[]; logs: ActionLog[]; wardrobe: WardrobeItem[];saved_outfit_ids:string[];chats:StylistChatSummary[];active_chat_id:string | null };
export type StylistEvent = { type: "stage"; text: string } | { type: "result"; message: string } | { type: "error"; error: string };

export function validateOutfitItems(ids: string[], wardrobe: Pick<WardrobeItem, "id" | "category">[], required: string[] = [], excluded: string[] = []) {
  if (ids.length !== new Set(ids).size) throw new Error("An outfit cannot contain the same piece twice.");
  const lookup = new Map(wardrobe.map(item => [item.id, item]));
  if (!ids.length || ids.some(id => !lookup.has(id))) throw new Error("An outfit refers to a missing or unowned piece. No outfit was saved.");
  if (required.some(id => !ids.includes(id))) throw new Error("A required piece is missing from the outfit.");
  if (ids.some(id => excluded.includes(id))) throw new Error("The outfit contains an explicitly excluded piece.");
  const categories = new Set(ids.map(id => lookup.get(id)!.category));
  if (!categories.has("Dresses") && !(categories.has("Tops") && categories.has("Bottoms"))) throw new Error("A complete outfit needs a dress or a top and bottom. Add those pieces to your closet first.");
  if (!categories.has("Shoes")) throw new Error("A complete outfit needs shoes. Add a pair to your closet first.");
}
