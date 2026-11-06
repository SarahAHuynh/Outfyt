import { NextResponse } from "next/server";
import { checkMutationOrigin,wardrobeContext,wardrobeFailure } from "@/lib/wardrobe/server";
import { checkRpc } from "@/lib/stylist/server";

export async function POST(request:Request) {
  try {
    checkMutationOrigin(request);
    const { supabase } = await wardrobeContext();
    const { data,error } = await supabase.rpc("create_stylist_chat"); checkRpc(error);
    return NextResponse.json({ chat:data },{ status:201,headers:{ "Cache-Control":"no-store" } });
  } catch(error) { return wardrobeFailure(error); }
}
