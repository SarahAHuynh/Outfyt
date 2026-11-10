import { NextResponse } from "next/server";
import { z } from "zod";
import { checkMutationOrigin,wardrobeContext } from "@/lib/wardrobe/server";
import { readSmallJson } from "@/lib/wardrobe/body";
import { pinterestSchema } from "@/lib/style/schema";
import { styleFailure,styleRpc } from "@/lib/style/server";

export async function POST(request:Request) {
  try {
    checkMutationOrigin(request);const { supabase }=await wardrobeContext();
    const { url }=z.object({ url:pinterestSchema }).strict().parse(await readSmallJson(request));
    const result=await supabase.rpc("save_pinterest_reference",{ p_url:url });styleRpc(result.error);
    return NextResponse.json({ board_url:url,status:"reference_only" });
  } catch(error) { return styleFailure(error); }
}
