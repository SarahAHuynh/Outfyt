import { NextResponse } from "next/server";
import { analyzeClothing } from "@/lib/ai/clothing";
import { WardrobeError } from "@/lib/wardrobe/service";
import { checkMutationOrigin, readImageForm, validatedImage, wardrobeContext, wardrobeFailure } from "@/lib/wardrobe/server";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(request: Request) {
  try {
    checkMutationOrigin(request);
    const { supabase } = await wardrobeContext();
    if (!process.env.OPENAI_API_KEY?.trim()) throw new WardrobeError("AI recognition is not configured yet. You can enter the details manually.", 503);
    const image = await validatedImage(await readImageForm(request), true);
    const { data: allowed, error } = await supabase.rpc("consume_clothing_analysis_budget");
    if (error) throw new WardrobeError("AI request limits are not configured. Run the Milestone 2 SQL migration. Manual entry still works.", 503);
    if (!allowed) throw new WardrobeError("You have used this hour's 10 photo-analysis requests. Try again next hour, or enter details manually.", 429);
    const attributes = await analyzeClothing(image!);
    return NextResponse.json({ attributes }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return wardrobeFailure(error); }
}
