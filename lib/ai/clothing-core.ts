import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { clothingAnalysisSchema } from "@/lib/wardrobe/schema";
import { WardrobeError } from "@/lib/wardrobe/service";
import { CLOTHING_ANALYSIS_PROMPT } from "@/lib/prompts/clothing-analysis";

export async function analyzeClothingWithClient(image: { bytes: Uint8Array; mime: string }, config: { apiKey?: string; model?: string }, injectedClient?: OpenAI) {
  if (!config.apiKey?.trim()) throw new WardrobeError("AI recognition is not configured yet. You can enter the item details manually.", 503);
  const client = injectedClient || new OpenAI({ apiKey: config.apiKey, timeout: 35_000, maxRetries: 1 });
  const model = config.model?.trim() || "gpt-5.4-mini";
  try {
    const response = await client.responses.parse({
      model,
      ...(model.startsWith("gpt-5") ? { reasoning: { effort: "low" as const } } : {}),
      store: false,
      max_output_tokens: 4096,
      instructions: CLOTHING_ANALYSIS_PROMPT,
      input: [{ role: "user", content: [
        { type: "input_text", text: "Suggest editable catalog attributes for this clothing photo." },
        { type: "input_image", image_url: `data:${image.mime};base64,${Buffer.from(image.bytes).toString("base64")}`, detail: "low" },
      ] }],
      text: { format: zodTextFormat(clothingAnalysisSchema, "clothing_attributes") },
    });
    const result = clothingAnalysisSchema.safeParse(response.output_parsed);
    if (!result.success || response.status !== "completed") throw new WardrobeError("AI recognition could not read this photo reliably. Try another photo or enter details manually.", 422);
    if (!result.data.is_clothing) throw new WardrobeError("No clothing item was identified. Try a clear photo of one piece, or enter its details manually.", 422);
    return clothingAnalysisSchema.omit({ is_clothing: true }).parse(result.data);
  } catch (error) {
    if (error instanceof WardrobeError) throw error;
    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) throw new WardrobeError("The AI service has reached a rate or billing limit. Try again later or enter the details manually.", 429);
      if (error.status === 401 || error.status === 403) throw new WardrobeError("The server's OpenAI key or model access needs attention. Manual entry is still available.", 503);
      if (error.status === 404) throw new WardrobeError("The configured AI model is unavailable. Check OPENAI_MODEL or use manual entry.", 503);
    }
    throw new WardrobeError("AI recognition is unavailable or timed out. Your photo has not been saved. Enter the details manually or try again.", 503);
  }
}
