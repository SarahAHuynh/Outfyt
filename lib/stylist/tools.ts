import { z } from "zod";
import { zodFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/responses/responses";
import { clothingSchema, CATEGORIES } from "@/lib/wardrobe/schema";
import { styleProposalSchema } from "./schema";

export const toolSchemas = {
  search_reference_photos: z.object({ query:z.string().trim().min(1).max(120) }),
  get_wardrobe: z.object({ category: z.enum(CATEGORIES).nullable(), color: z.string().max(40).nullable(), search: z.string().max(100).nullable() }),
  get_wardrobe_item: z.object({ id: z.string().uuid() }),
  add_clothing_item: z.object({ attributes: clothingSchema }),
  update_clothing_item: z.object({ id: z.string().uuid(), attributes: clothingSchema }),
  generate_outfits: z.object({ occasion: z.string().max(100), aesthetic: z.string().max(150), restrictions: z.array(z.string().max(200)).max(12), required_item_ids: z.array(z.string().uuid()).max(12), excluded_item_ids: z.array(z.string().uuid()).max(100), count: z.number().int().min(1).max(3) }),
  save_outfit: z.object({ candidate_id: z.string().uuid() }),
  get_saved_outfits: z.object({}),
  update_outfit: z.object({ id: z.string().uuid(), name: z.string().min(1).max(100).nullable(), occasion: z.string().max(100).nullable(), aesthetic: z.string().max(150).nullable(), description: z.string().max(1000).nullable(), item_ids: z.array(z.string().uuid()).min(1).max(12).nullable(), is_favorite: z.boolean().nullable() }),
  delete_outfit: z.object({ id: z.string().uuid() }),
  delete_clothing_item: z.object({ id: z.string().uuid() }),
  get_style_profile: z.object({}),
  update_style_profile: styleProposalSchema,
  analyze_inspiration: z.object({ image_id: z.string().uuid() }),
};
export type ToolName = keyof typeof toolSchemas;
const descriptions: Record<ToolName, string> = {
  search_reference_photos: "Find up to three real Unsplash clothing reference photos for missing-piece recommendations or requested image examples. One search per turn. Use a short clothing/style query without personal data. References are not owned clothes, verified products, or exact matches. Cards display automatically; no Markdown images needed.",
  get_wardrobe: "Retrieve owned clothing with optional category, color and search filters. Null means no filter.",
  get_wardrobe_item: "Retrieve one exact owned clothing item by ID.",
  add_clothing_item: "Add one explicitly requested manual clothing entry without a photo. Never add clothes the user does not own.",
  update_clothing_item: "Update one owned item's complete editable attributes. Read the current item first and preserve unspecified attributes.",
  generate_outfits: "Generate up to three validated outfit candidates from owned clothes and Style DNA; exclusions and requirements are enforced. Does not save outfits.",
  save_outfit: "Save one previously validated candidate by candidate_id. Returns the persisted saved outfit; repeat saves do not duplicate it.",
  get_saved_outfits: "Retrieve the user's saved outfits, exact IDs and actual item combinations.",
  update_outfit: "Modify one saved outfit. Null fields preserve current values. Item IDs, if supplied, replace the complete combination.",
  delete_outfit: "Prepare deletion of one saved outfit. This never deletes immediately; a separate user approval is required.",
  delete_clothing_item: "Prepare deletion of one clothing item and its private photo. Blocks items used in saved outfits. Requires separate approval.",
  get_style_profile: "Retrieve the persisted user Style DNA, or report that it is not configured.",
  update_style_profile: "Propose complete style-preference changes for separate user approval. Does not apply them immediately.",
  analyze_inspiration: "Analyze one already-uploaded, owned inspiration image and return a proposed style summary. Does not change preferences or retrieve Pinterest data.",
};

export const stylistTools: FunctionTool[] = Object.entries(toolSchemas).map(([name, schema]) => {
  const tool = zodFunction({ name, description: descriptions[name as ToolName], parameters: schema });
  if (!tool.function.parameters) throw new Error("A stylist tool is missing its input schema.");
  return { type: "function", name, description: tool.function.description, parameters: tool.function.parameters, strict: true };
});

export function parseToolCall(name: string, raw: string): { name: ToolName; arguments: Record<string, unknown> } {
  if (!Object.hasOwn(toolSchemas, name)) throw new Error("This tool is not allowed.");
  if (raw.length > 16_384) throw new Error("Tool arguments are too large.");
  const schema = toolSchemas[name as ToolName];
  return { name: name as ToolName, arguments: schema.strict().parse(JSON.parse(raw)) };
}

export function sanitizeToolArguments(args: Record<string, unknown>) {
  const safe: Record<string, unknown> = { argument_keys: Object.keys(args) };
  for (const [key, value] of Object.entries(args)) {
    if ((key === "id" || key.endsWith("_id")) && typeof value === "string" && z.string().uuid().safeParse(value).success) safe[key] = value;
    if (Array.isArray(value)) safe[`${key}_count`] = value.length;
  }
  return safe;
}
