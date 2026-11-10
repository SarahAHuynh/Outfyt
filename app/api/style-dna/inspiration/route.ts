import { NextResponse } from "next/server";
import { z } from "zod";
import { checkMutationOrigin,readImageForm,validatedImage,wardrobeContext } from "@/lib/wardrobe/server";
import { WardrobeError } from "@/lib/wardrobe/service";
import { INSPIRATION_BUCKET,styleFailure,styleRpc } from "@/lib/style/server";
import { saveInspirationUpload } from "@/lib/style/upload";

export const runtime="nodejs";
export async function POST(request:Request) {
  try {
    checkMutationOrigin(request);const { supabase,user }=await wardrobeContext();
    const form=await readImageForm(request);const id=z.string().uuid().parse(form.get("id"));
    const name=z.string().trim().min(1).max(100).parse(form.get("name"));
    const image=await validatedImage(form,true);if (!image) throw new WardrobeError("Choose an inspiration image.");
    const result=await saveInspirationUpload(user.id,id,name,image,{
      find:async () => { const r=await supabase.from("inspiration_images").select("id,user_id,image_path").eq("user_id",user.id).eq("id",id).maybeSingle();styleRpc(r.error);return r.data; },
      upload:async (path,bytes,mime) => { const r=await supabase.storage.from(INSPIRATION_BUCKET).upload(path,bytes,{ contentType:mime,upsert:false });if (r.error) throw new WardrobeError("Could not upload inspiration. Refresh before retrying.",503); },
      register:async (path,title) => { const r=await supabase.rpc("register_inspiration",{ p_id:id,p_path:path,p_name:title });styleRpc(r.error);return r.data; },
      remove:async path => { const r=await supabase.storage.from(INSPIRATION_BUCKET).remove([path]);if (r.error) throw Error("Cleanup failed"); },
    });
    return NextResponse.json({ id:result.image.id,alreadySaved:result.alreadySaved },{ status:result.alreadySaved ? 200 : 201 });
  } catch(error) { return styleFailure(error); }
}
