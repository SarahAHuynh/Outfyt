import { NextResponse } from "next/server";
import { checkMutationOrigin,wardrobeContext,wardrobeFailure } from "@/lib/wardrobe/server";
import { readSmallJson } from "@/lib/wardrobe/body";
import { WardrobeError } from "@/lib/wardrobe/service";
import { profileUpdateSchema } from "@/lib/profile/schema";

export async function PATCH(request:Request) {
  try {
    checkMutationOrigin(request);const { supabase,user }=await wardrobeContext();
    const input=profileUpdateSchema.parse(await readSmallJson(request));
    const result=await supabase.from("profiles").update({ display_name:input.display_name }).eq("id",user.id).eq("updated_at",input.updated_at).select("display_name,updated_at").maybeSingle();
    if (result.error) throw new WardrobeError("Could not save your profile. Please try again.",503);
    if (!result.data) throw new WardrobeError("Your profile changed or is unavailable. Refresh Settings before editing again.",409);
    return NextResponse.json(result.data,{ headers:{ "Cache-Control":"private, no-store" } });
  } catch(error) { return wardrobeFailure(error); }
}
