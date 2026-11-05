import "server-only";
import { analyzeClothingWithClient } from "./clothing-core";

export async function analyzeClothing(image: { bytes: Uint8Array; mime: string }) {
  return analyzeClothingWithClient(image, { apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL });
}
