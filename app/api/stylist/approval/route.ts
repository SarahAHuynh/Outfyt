import { NextResponse } from "next/server";
import { z } from "zod";
import { readSmallJson } from "@/lib/wardrobe/body";
import { BUCKET, checkMutationOrigin, wardrobeContext, wardrobeFailure } from "@/lib/wardrobe/server";
import { checkRpc } from "@/lib/stylist/server";

export async function POST(request: Request) {
  try {
    checkMutationOrigin(request);
    const { supabase } = await wardrobeContext();
    const { token,approve } = z.object({ token:z.string().uuid(),approve:z.boolean() }).strict().parse(await readSmallJson(request));
    const { data,error } = await supabase.rpc("resolve_agent_action",{ p_token:token,p_approve:approve });
    checkRpc(error);
    let warning: string | undefined;
    if (data.result?.image_path) {
      const removed = await supabase.storage.from(BUCKET).remove([data.result.image_path]);
      if (removed.error) warning = "The clothing item was deleted, but its private image still needs storage cleanup.";
      delete data.result.image_path;
    }
    return NextResponse.json({ ...data,warning },{ headers:{ "Cache-Control":"no-store" } });
  } catch(error) { return wardrobeFailure(error); }
}
