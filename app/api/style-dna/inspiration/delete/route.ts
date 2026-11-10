import { NextResponse } from "next/server";
import { z } from "zod";
import { checkMutationOrigin,wardrobeContext } from "@/lib/wardrobe/server";
import { readSmallJson } from "@/lib/wardrobe/body";
import { INSPIRATION_BUCKET,styleFailure,styleRpc } from "@/lib/style/server";

export async function POST(request:Request) {
  try {
    checkMutationOrigin(request);const { supabase }=await wardrobeContext();
    const { id }=z.object({ id:z.string().uuid() }).strict().parse(await readSmallJson(request));
    const result=await supabase.rpc("prepare_inspiration_delete",{ p_id:id });styleRpc(result.error);
    return NextResponse.json(result.data);
  } catch(error) { return styleFailure(error); }
}
export async function PATCH(request:Request) {
  try {
    checkMutationOrigin(request);const { supabase }=await wardrobeContext();
    const { token,approve }=z.object({ token:z.string().uuid(),approve:z.boolean() }).strict().parse(await readSmallJson(request));
    const result=await supabase.rpc("resolve_inspiration_delete",{ p_token:token,p_approve:approve });styleRpc(result.error);
    let warning:string | undefined;
    if (result.data.image_path) {
      const removed=await supabase.storage.from(INSPIRATION_BUCKET).remove([result.data.image_path]);
      if (removed.error) warning="The reference was removed, but its private upload needs cleanup. Use Retry cleanup.";
    }
    return NextResponse.json({ deleted:result.data.deleted,warning });
  } catch(error) { return styleFailure(error); }
}
