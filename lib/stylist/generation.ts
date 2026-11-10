import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { OUTFIT_GENERATION_PROMPT } from "@/lib/prompts/outfit-generation";
import { outfitGenerationSchema, validateOutfitItems } from "./schema";
import { analyzeStyleImages } from "@/lib/style/analysis";
import type { WardrobeItem } from "@/lib/wardrobe/schema";

export async function generateOwnedOutfits(client: OpenAI, model: string, wardrobe: WardrobeItem[], style: unknown, request: { occasion: string; aesthetic: string; restrictions: string[]; required_item_ids: string[]; excluded_item_ids: string[]; count: number }) {
  if ([...request.required_item_ids, ...request.excluded_item_ids].some(id => !wardrobe.some(item => item.id === id))) throw new Error("A required or excluded piece is not in your current wardrobe. Retrieve the current IDs first.");
  const eligible = wardrobe.filter(item => !request.excluded_item_ids.includes(item.id));
  const response = await client.responses.parse({
    model, store: false, max_output_tokens: 5000,
    ...(model.startsWith("gpt-5") ? { reasoning: { effort: "low" as const } } : {}),
    instructions: OUTFIT_GENERATION_PROMPT,
    input: [{ role: "user", content: JSON.stringify({ request, wardrobe: eligible.map(({ id, name, category, subcategory, primary_color, secondary_colors, style_tags, season_tags, description }) => ({ id, name, category, subcategory, primary_color, secondary_colors, style_tags, season_tags, description })), style_profile: style }) }],
    text: { format: zodTextFormat(outfitGenerationSchema, "wardrobe_outfits") },
  });
  const result = outfitGenerationSchema.parse(response.output_parsed);
  if (response.status !== "completed" || result.outfits.length > request.count) throw new Error("The AI returned an invalid number of outfits. No suggestions were saved.");
  const combinations = new Set<string>();
  for (const outfit of result.outfits) {
    validateOutfitItems(outfit.item_ids, eligible, request.required_item_ids, request.excluded_item_ids);
    const key = [...outfit.item_ids].sort().join(",");
    if (combinations.has(key)) throw new Error("The AI returned duplicate combinations. Ask for fewer looks or add more pieces.");
    combinations.add(key);
  }
  return result;
}

export async function analyzeOwnedInspiration(client: OpenAI, model: string, bytes: Uint8Array, mime: string) {
  return analyzeStyleImages(client,model,[{ bytes,mime }]);
}
