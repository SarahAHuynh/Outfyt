import { NextResponse } from "next/server";
import { checkMutationOrigin,wardrobeContext } from "@/lib/wardrobe/server";
import { readSmallJson } from "@/lib/wardrobe/body";
import { analysisRequestSchema } from "@/lib/style/schema";
import { runInspirationAnalysis,styleFailure } from "@/lib/style/server";

export const runtime="nodejs";
export const maxDuration=120;
export async function POST(request:Request) {
  try {
    checkMutationOrigin(request);const context=await wardrobeContext();
    const { image_ids }=analysisRequestSchema.parse(await readSmallJson(request));
    return NextResponse.json(await runInspirationAnalysis(context,image_ids),{ headers:{ "Cache-Control":"no-store" } });
  } catch(error) { return styleFailure(error); }
}
