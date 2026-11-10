import { WardrobeError } from "@/lib/wardrobe/service";

type RecordImage = { id:string;user_id:string;image_path:string };
export async function saveInspirationUpload(owner:string,id:string,name:string,image:{ bytes:Uint8Array;mime:string;extension:string },deps:{
  find:()=>Promise<RecordImage | null>;upload:(path:string,bytes:Uint8Array,mime:string)=>Promise<void>;
  register:(path:string,name:string)=>Promise<RecordImage>;remove:(path:string)=>Promise<void>;
}) {
  const current = await deps.find();
  if (current) {
    if (current.user_id!==owner) throw new WardrobeError("Image unavailable.",404);
    return { image:current,alreadySaved:true };
  }
  const path = `${owner}/${id}.${image.extension}`;
  await deps.upload(path,image.bytes,image.mime);
  try { return { image:await deps.register(path,name),alreadySaved:false }; }
  catch {
    // A lost response can follow a committed insert: read before cleanup.
    let saved:RecordImage | null;
    try { saved=await deps.find(); }
    catch { throw new WardrobeError("The upload result is uncertain. Refresh inspiration before retrying; its private image was kept.",503); }
    if (saved?.user_id===owner) return { image:saved,alreadySaved:true };
    try { await deps.remove(path); }
    catch { throw new WardrobeError("The image record was not saved, but its private upload needs storage cleanup. Refresh before retrying.",503); }
    throw new WardrobeError("The inspiration image could not be saved. You can keep up to 50 images. Refresh before retrying.",503);
  }
}
