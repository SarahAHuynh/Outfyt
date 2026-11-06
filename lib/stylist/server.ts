import "server-only";
import { createHash, randomUUID } from "node:crypto";
import OpenAI from "openai";
import { loadWardrobe } from "@/lib/wardrobe/read";
import { getOwnedItem, wardrobeContext } from "@/lib/wardrobe/server";
import { createWardrobeItem, requireOwnedItem, WardrobeError } from "@/lib/wardrobe/service";
import { clothingSchema, imageMetadataError, imageExtension, type WardrobeItem } from "@/lib/wardrobe/schema";
import { toolSchemas, sanitizeToolArguments, type ToolName } from "./tools";
import { outfitDetailsSchema, styleProposalSchema, validateOutfitItems, type OutfitCandidate, type SavedOutfit, type StylistView, type ActionLog, type PendingAction, type StylistMessage } from "./schema";
import { generateOwnedOutfits, analyzeOwnedInspiration } from "./generation";
import type { ToolResult } from "./loop";

export function stylistError(error: unknown) {
  if (error instanceof WardrobeError) return error;
  if (error instanceof OpenAI.APIError) {
    if (error.status === 429) return new WardrobeError("The AI service reached a rate or billing limit. Check action history before retrying.", 429);
    if ([401,403,404].includes(error.status || 0)) return new WardrobeError("The server's OpenAI key or model access needs attention.", 503);
  }
  return new WardrobeError("The stylist could not finish. Check action history for completed changes before trying again.", 503);
}

export function checkRpc(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (["PGRST202","PGRST205","42P01","42501"].includes(error.code || "")) throw new WardrobeError("Stylist setup is missing. Run the Milestone 3 database migration first.", 503);
  if (error.message.includes("Hourly")) throw new WardrobeError("You have reached 10 stylist requests this hour. Try again next hour.", 429);
  if (error.message.includes("already running")) throw new WardrobeError("A stylist request is already running. Wait for it to finish, then refresh.", 409);
  if (error.message.includes("changed") || error.message.includes("expired")) throw new WardrobeError("This item changed or its approval expired. Refresh and request the action again.", 409);
  if (error.message.includes("saved outfits")) throw new WardrobeError("This clothing item is used in saved outfits. Remove it from those looks before deleting it.", 409);
  throw new WardrobeError("The requested record is unavailable or the database operation failed. Refresh and try again.", 409);
}

export type StylistContext = Awaited<ReturnType<typeof wardrobeContext>>;

export async function savedOutfits(context: StylistContext): Promise<SavedOutfit[]> {
  const { data, error } = await context.supabase.from("outfits").select("*, outfit_items(wardrobe_item_id,position)").eq("user_id",context.user.id).order("created_at",{ ascending: false }).limit(100);
  checkRpc(error);
  return (data || []).map(outfit => ({ id: outfit.id, name: outfit.name, occasion: outfit.occasion || "", aesthetic: outfit.aesthetic || "", description: outfit.description || "", is_favorite: outfit.is_favorite, updated_at: outfit.updated_at, item_ids: (outfit.outfit_items as { wardrobe_item_id: string; position: number }[]).sort((a,b) => a.position-b.position).map(item => item.wardrobe_item_id) }));
}

export async function getStyle(context: StylistContext) {
  const { data, error } = await context.supabase.from("style_profiles").select("aesthetic_tags,preferred_colors,favorite_clothing_types,disliked_styles,style_summary,comfort_preferences,updated_at").eq("user_id",context.user.id).maybeSingle();
  checkRpc(error); return data;
}

export async function loadStylistView(context: StylistContext): Promise<StylistView> {
  const { supabase, user } = context;
  const [messages, candidates, pending, logs, wardrobe] = await Promise.all([
    supabase.from("stylist_messages").select("id,role,content,turn_id,created_at").eq("user_id",user.id).order("created_at",{ ascending:false }).limit(30),
    supabase.from("outfit_candidates").select("id,turn_id,ordinal,payload,created_at").eq("user_id",user.id).order("created_at",{ ascending:false }).limit(90),
    supabase.from("agent_pending_actions").select("token,action_name,payload,status,expires_at,result").eq("user_id",user.id).order("created_at",{ ascending:false }).limit(20),
    supabase.from("agent_action_logs").select("id,action_name,sanitized_arguments,status,confirmation_status,error_message,created_at").eq("user_id",user.id).order("created_at",{ ascending:false }).limit(40),
    loadWardrobe(),
  ]);
  [messages.error,candidates.error,pending.error,logs.error].forEach(checkRpc);
  const rows = (candidates.data || []).map(row => ({ ...outfitDetailsSchema.parse(row.payload), id: row.id, turn_id: row.turn_id, ordinal: row.ordinal })) as OutfitCandidate[];
  return {
    messages: (messages.data || []).reverse().map(row => ({ id: row.id, role: row.role as StylistMessage["role"], content: row.content, turn_id: row.turn_id, candidates: rows.filter(candidate => candidate.turn_id === row.turn_id).sort((a,b) => a.ordinal-b.ordinal) })),
    candidates: rows,
    pending: (pending.data || []).map(row => ({ ...row, payload: { id: row.payload.id, name: row.payload.name, proposal: row.payload.proposal } })) as PendingAction[],
    logs: (logs.data || []) as ActionLog[], wardrobe: wardrobe.items,
  };
}

export async function writeOutfit(context: StylistContext, id: string, details: { name: string; occasion: string; aesthetic: string; description: string; is_favorite: boolean }, ids: string[], expected: string | null) {
  const { data: wardrobe, error: wardrobeError } = await context.supabase.from("wardrobe_items").select("id,category").eq("user_id",context.user.id).in("id",ids);
  checkRpc(wardrobeError); validateOutfitItems(ids,wardrobe || []);
  const { data, error } = await context.supabase.rpc("write_outfit",{ p_id:id, p_details:details, p_item_ids:ids, p_expected:expected });
  checkRpc(error); return { ...data, item_ids:data.item_ids || ids } as SavedOutfit;
}

export async function recordAction(context: StylistContext, id: string, name: string, args: Record<string,unknown>, status: string, error?: string) {
  const { error: logError } = await context.supabase.rpc("record_agent_action",{ p_id:id,p_action:name,p_args:args,p_status:status,p_confirmation:status === "awaiting_confirmation" ? status : "not_required",p_error:error || null });
  checkRpc(logError);
}

export async function prepareAction(context: StylistContext, name: string, payload: Record<string,unknown>, logId?: string) {
  const id = logId || randomUUID();
  if (!logId) await recordAction(context,id,name,sanitizeToolArguments(payload),"pending");
  const { data,error } = await context.supabase.rpc("prepare_agent_action",{ p_action:name,p_payload:payload,p_log_id:id });
  if (error) { await recordAction(context,id,name,sanitizeToolArguments(payload),"failed","Could not prepare confirmation."); checkRpc(error); }
  return data as ToolResult;
}

function stableId(turn: string, value: unknown) {
  const hex = createHash("sha256").update(`${turn}:${JSON.stringify(value)}`).digest("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

export function createToolExecutor(context: StylistContext, turnId: string, client: OpenAI, model: string) {
  let generated = false, analyzed = false, clothingWrite = false, outfitWrite = false;
  const completed = (data: unknown): ToolResult => ({ status:"completed", data });
  const claimWriteAllowance = (kind: "clothing" | "outfit") => {
    if ((kind === "clothing" ? clothingWrite : outfitWrite)) throw new Error("Bulk changes are not enabled. Review one item or outfit at a time.");
    if (kind === "clothing") clothingWrite = true; else outfitWrite = true;
  };
  const wardrobe = async () => {
    const { data,error } = await context.supabase.from("wardrobe_items").select("*").eq("user_id",context.user.id).order("created_at",{ ascending:false }).limit(300);
    checkRpc(error); return (data || []) as WardrobeItem[];
  };
  return async function execute(name: ToolName, args: Record<string,unknown>, logId: string): Promise<ToolResult> {
    const { supabase,user } = context;
    switch(name) {
      case "get_wardrobe": {
        const filters = toolSchemas.get_wardrobe.parse(args);
        const rows = (await wardrobe()).filter(item => (!filters.category || item.category === filters.category) && (!filters.color || item.primary_color?.toLowerCase() === filters.color.toLowerCase()) && (!filters.search || `${item.name} ${item.description}`.toLowerCase().includes(filters.search.toLowerCase())));
        return completed({ items:rows.map(item => ({ id:item.id,name:item.name,category:item.category,subcategory:item.subcategory,primary_color:item.primary_color,secondary_colors:item.secondary_colors,style_tags:item.style_tags,season_tags:item.season_tags,description:item.description })), limit:300 });
      }
      case "get_wardrobe_item": return completed(requireOwnedItem(await getOwnedItem(toolSchemas.get_wardrobe_item.parse(args).id,context),user.id));
      case "get_style_profile": return completed(await getStyle(context));
      case "get_saved_outfits": return completed(await savedOutfits(context));
      case "add_clothing_item": {
        const input = toolSchemas.add_clothing_item.parse(args); claimWriteAllowance("clothing");
        const id = stableId(turnId,input);
        const result = await createWardrobeItem(user.id,id,input.attributes,null,{
          find:() => getOwnedItem(id,context), upload:async () => {}, removeImage:async () => {},
          insert:async item => { const { data,error } = await supabase.from("wardrobe_items").insert(item).select("*").single(); checkRpc(error); return data as WardrobeItem; },
        });
        return completed(result.item);
      }
      case "update_clothing_item": {
        const input = toolSchemas.update_clothing_item.parse(args); const item = requireOwnedItem(await getOwnedItem(input.id,context),user.id); claimWriteAllowance("clothing");
        const { data,error } = await supabase.from("wardrobe_items").update(clothingSchema.parse(input.attributes)).eq("id",item.id).eq("user_id",user.id).eq("updated_at",item.updated_at).select("*").maybeSingle();
        checkRpc(error); if (!data) throw new Error("This piece changed. Retrieve it again before editing."); return completed(data);
      }
      case "generate_outfits": {
        if (generated) throw new Error("One outfit-generation batch is allowed per request. Use the current candidates or ask again in a new message.");
        generated = true;
        const request = toolSchemas.generate_outfits.parse(args);
        const result = await generateOwnedOutfits(client,model,await wardrobe(),await getStyle(context),request);
        const candidates = result.outfits.map((outfit,index) => ({ ...outfit,id:randomUUID(),turn_id:turnId,ordinal:index+1 }));
        if (candidates.length) { const { error } = await supabase.rpc("store_outfit_candidates",{ p_turn:turnId,p_candidates:candidates }); checkRpc(error); }
        return completed({ candidates,limitations:result.limitations });
      }
      case "save_outfit": {
        const { candidate_id } = toolSchemas.save_outfit.parse(args);
        const { data,error } = await supabase.from("outfit_candidates").select("payload").eq("id",candidate_id).eq("user_id",user.id).maybeSingle(); checkRpc(error);
        if (!data) throw new Error("That candidate is unavailable. Generate an outfit first.");
        const details = outfitDetailsSchema.parse(data.payload); claimWriteAllowance("outfit");
        return completed(await writeOutfit(context,candidate_id,{ ...details,is_favorite:false },details.item_ids,null));
      }
      case "update_outfit": {
        const input = toolSchemas.update_outfit.parse(args); const existing = (await savedOutfits(context)).find(outfit => outfit.id === input.id);
        if (!existing) throw new Error("That saved outfit is unavailable. Retrieve saved outfits and clarify the target.");
        const merged = Object.fromEntries(Object.entries(input).filter(([,value]) => value !== null));
        const updated = { ...existing,...merged } as SavedOutfit; claimWriteAllowance("outfit");
        return completed(await writeOutfit(context,existing.id,updated,updated.item_ids,existing.updated_at));
      }
      case "delete_outfit": return prepareAction(context,name,toolSchemas.delete_outfit.parse(args),logId);
      case "delete_clothing_item": return prepareAction(context,name,toolSchemas.delete_clothing_item.parse(args),logId);
      case "update_style_profile": return prepareAction(context,name,styleProposalSchema.parse(args),logId);
      case "analyze_inspiration": {
        if (analyzed) throw new Error("One inspiration analysis is allowed per request."); analyzed = true;
        const { image_id } = toolSchemas.analyze_inspiration.parse(args);
        const { data,error } = await supabase.from("inspiration_images").select("image_path").eq("id",image_id).eq("user_id",user.id).maybeSingle(); checkRpc(error);
        if (!data) throw new Error("No matching owned inspiration image exists. Inspiration uploads arrive in Milestone 4; no image was analyzed.");
        const download = await supabase.storage.from("inspiration-images").download(data.image_path); if (download.error || !download.data) throw new Error("Could not access that private inspiration image.");
        const issue = imageMetadataError(download.data); if (issue) throw new Error(issue);
        const bytes = new Uint8Array(await download.data.arrayBuffer()); if (!imageExtension(bytes,download.data.type)) throw new Error("Invalid inspiration image type.");
        return completed({ proposal:await analyzeOwnedInspiration(client,model,bytes,download.data.type), applied:false });
      }
    }
  };
}
