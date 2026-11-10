import { NextResponse } from "next/server";
import { checkMutationOrigin,wardrobeContext } from "@/lib/wardrobe/server";
import { readSmallJson } from "@/lib/wardrobe/body";
import { profileRequestSchema } from "@/lib/style/schema";
import { loadStyleView,styleFailure,styleRpc } from "@/lib/style/server";

export async function GET() {
  try { return NextResponse.json(await loadStyleView(await wardrobeContext()),{ headers:{ "Cache-Control":"private, no-store" } }); }
  catch(error) { return styleFailure(error); }
}
export async function POST(request:Request) {
  try {
    checkMutationOrigin(request);const { supabase }=await wardrobeContext();
    const input=profileRequestSchema.parse(await readSmallJson(request));
    const result=await supabase.rpc("prepare_style_profile",{ p_profile:input.profile,p_expected:input.expected_version });styleRpc(result.error);
    return NextResponse.json(result.data,{ headers:{ "Cache-Control":"no-store" } });
  } catch(error) { return styleFailure(error); }
}
