import "server-only";
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { wardrobeContext } from "@/lib/wardrobe/server";
import { WardrobeError } from "@/lib/wardrobe/service";
import { imageExtension,imageMetadataError,MAX_STORED_IMAGE_BYTES } from "@/lib/wardrobe/schema";
import { styleProposalSchema,type PendingAction } from "@/lib/stylist/schema";
import { EMPTY_PROFILE,pinterestSchema,profileSchema,type StyleView } from "./schema";
import { analyzeStyleImages } from "./analysis";

export const INSPIRATION_BUCKET="inspiration-images";
type Context=Awaited<ReturnType<typeof wardrobeContext>>;
export function styleRpc(error:{ code?:string;message:string } | null) {
  if (!error) return;
  if (["PGRST202","PGRST204","PGRST205","42P01","42703","42501"].includes(error.code || "")) throw new WardrobeError("Style DNA setup is incomplete. Run migration 0006_style_dna.sql after 0005.",503);
  if (error.message.includes("limit reached")) throw new WardrobeError("You have reached 10 inspiration analyses this hour. Try next hour; manual preferences still work.",429);
  if (error.message.includes("already running")) throw new WardrobeError("An inspiration analysis is already running. Wait for it to finish.",409);
  if (error.message.includes("changed")) throw new WardrobeError("Style DNA or inspiration changed. Reload saved preferences and review again.",409);
  throw new WardrobeError("This Style DNA record is unavailable or the operation failed. Refresh and try again.",409);
}
export function styleFailure(error:unknown) {
  let message="Style DNA is unavailable right now. Your saved preferences were not changed."; let status=503;
  if (error instanceof WardrobeError) { message=error.message;status=error.status; }
  else if (error instanceof ZodError) { message=error.issues[0]?.message || "Check your style details.";status=400; }
  else if (error instanceof OpenAI.APIError) {
    if (error.status===429) { message="The AI service reached a rate or billing limit. Manual preferences still work.";status=429; }
    else if ([401,403,404].includes(error.status || 0)) message="The server's OpenAI key or model access needs attention. Manual preferences still work.";
  }
  return NextResponse.json({ error:message },{ status,headers:{ "Cache-Control":"no-store" } });
}
export async function loadStyleView({ supabase,user }:Context):Promise<StyleView> {
  const [profile,images,connection,pending] = await Promise.all([
    supabase.from("style_profiles").select("aesthetic_tags,preferred_colors,favorite_clothing_types,disliked_styles,style_summary,comfort_preferences,notes,updated_at").eq("user_id",user.id).maybeSingle(),
    supabase.from("inspiration_images").select("id,name,image_path,created_at").eq("user_id",user.id).order("created_at",{ ascending:false }).limit(50),
    supabase.from("pinterest_connections").select("board_url").eq("user_id",user.id).order("created_at",{ ascending:false }).limit(1).maybeSingle(),
    supabase.from("agent_pending_actions").select("token,action_name,payload,status,expires_at,result").eq("user_id",user.id).eq("action_name","update_style_profile").eq("status","awaiting_confirmation").gt("expires_at",new Date().toISOString()).order("created_at",{ ascending:false }).limit(20),
  ]);
  [profile.error,images.error,connection.error,pending.error].forEach(styleRpc);
  const signed=await Promise.all((images.data || []).map(async image => {
    const result=await supabase.storage.from(INSPIRATION_BUCKET).createSignedUrl(image.image_path,600);
    return { id:image.id,name:image.name,image_url:result.data?.signedUrl || null,created_at:image.created_at };
  }));
  const board=pinterestSchema.safeParse(connection.data?.board_url);
  return { profile:profileSchema.parse({ ...EMPTY_PROFILE,...profile.data,comfort_preferences:profile.data?.comfort_preferences || "",style_summary:profile.data?.style_summary || "" }),updated_at:profile.data?.updated_at || null,images:signed,board_url:board.success ? board.data : null,
    pending:(pending.data || []).map(row => ({ ...row,payload:{ name:row.payload.name,proposal:row.payload.proposal } })) as PendingAction[] };
}
export async function runInspirationAnalysis(context:Context,ids:string[]) {
  if (!process.env.OPENAI_API_KEY?.trim()) throw new WardrobeError("AI inspiration analysis is not configured. Manual preferences and uploads still work.",503);
  const { supabase,user }=context;
  const claim=await supabase.rpc("claim_inspiration_analysis",{ p_ids:ids });styleRpc(claim.error);
  if (claim.data.status==="cached") return { proposal:styleProposalSchema.parse(claim.data.proposal),cached:true };
  try {
    const rows=await supabase.from("inspiration_images").select("id,image_path").eq("user_id",user.id).in("id",ids);styleRpc(rows.error);
    if (rows.data?.length!==ids.length) throw new WardrobeError("An inspiration image is unavailable. Refresh and select your images again.",404);
    const images=[];let totalBytes=0;
    for (const row of rows.data) {
      if (!row.image_path.startsWith(`${user.id}/`)) throw new WardrobeError("Inspiration image unavailable.",404);
      const download=await supabase.storage.from(INSPIRATION_BUCKET).download(row.image_path);
      if (download.error || !download.data) throw new WardrobeError("Could not read an inspiration image. Refresh or upload it again.",503);
      const issue=imageMetadataError(download.data,MAX_STORED_IMAGE_BYTES);if (issue) throw new WardrobeError(issue,400);
      totalBytes+=download.data.size;
      if (totalBytes>20*1024*1024) throw new WardrobeError("These inspiration images are too large together. Select fewer photos and try again.",400);
      const bytes=new Uint8Array(await download.data.arrayBuffer());
      if (!imageExtension(bytes,download.data.type)) throw new WardrobeError("An inspiration image has an invalid format.",400);
      images.push({ bytes,mime:download.data.type });
    }
    const client=new OpenAI({ apiKey:process.env.OPENAI_API_KEY,timeout:45_000,maxRetries:1 });
    let proposal;
    try { proposal=await analyzeStyleImages(client,process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini",images); }
    catch(error) {
      if (error instanceof OpenAI.APIError) throw error;
      throw new WardrobeError(error instanceof Error && /No clear fashion|incomplete/.test(error.message) ? error.message : "Inspiration analysis timed out or returned invalid suggestions. No preferences changed.",422);
    }
    const finished=await supabase.rpc("finish_inspiration_analysis",{ p_id:claim.data.id,p_proposal:proposal });styleRpc(finished.error);
    return { proposal,cached:false };
  } catch(error) {
    await supabase.rpc("finish_inspiration_analysis",{ p_id:claim.data.id,p_proposal:null });
    throw error;
  }
}
