import "server-only";
import { createHash, randomUUID } from "node:crypto";
import OpenAI from "openai";
import { loadWardrobe } from "@/lib/wardrobe/read";
import { getOwnedItem, wardrobeContext } from "@/lib/wardrobe/server";
import { createWardrobeItem, requireOwnedItem, WardrobeError } from "@/lib/wardrobe/service";
import { clothingSchema, type WardrobeItem } from "@/lib/wardrobe/schema";
import { toolSchemas, sanitizeToolArguments, type ToolName } from "./tools";
import { outfitDetailsSchema, styleProposalSchema, validateOutfitItems, type OutfitCandidate, type SavedOutfit, type StylistView, type ActionLog, type PendingAction, type StylistMessage } from "./schema";
import { generateOwnedOutfits } from "./generation";
import { runInspirationAnalysis } from "@/lib/style/server";
import type { ToolResult } from "./loop";
import { readSavedOutfits } from "./outfits";
import { photoBatchSchema, searchReferencePhotos } from "./photos";

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
  if (["PGRST202","PGRST204","PGRST205","42P01","42703","42501"].includes(error.code || "")) throw new WardrobeError("Database setup is incomplete. Run the supplied migrations through 0006_style_dna.sql.", 503);
  if (error.message.includes("Hourly")) throw new WardrobeError("You have reached 10 stylist requests this hour. Try again next hour.", 429);
  if (error.message.includes("already running")) throw new WardrobeError("A stylist request is already running. Wait for it to finish, then refresh.", 409);
  if (error.message.includes("changed") || error.message.includes("expired")) throw new WardrobeError("This item changed or its approval expired. Refresh and request the action again.", 409);
  if (error.message.includes("saved outfits")) throw new WardrobeError("This clothing item is used in saved outfits. Remove it from those looks before deleting it.", 409);
  throw new WardrobeError("The requested record is unavailable or the database operation failed. Refresh and try again.", 409);
}

export type StylistContext = Awaited<ReturnType<typeof wardrobeContext>> & { chatId?:string };

export async function savedOutfits(context: StylistContext): Promise<SavedOutfit[]> {
  return readSavedOutfits(context.supabase,context.user.id);
}

export async function getStyle(context: StylistContext) {
  const { data, error } = await context.supabase.from("style_profiles").select("aesthetic_tags,preferred_colors,favorite_clothing_types,disliked_styles,style_summary,comfort_preferences,notes,updated_at").eq("user_id",context.user.id).maybeSingle();
  checkRpc(error); return data;
}

export async function loadStylistView(context: StylistContext,chatId?:string): Promise<StylistView> {
  const { supabase, user } = context;
  const chats = await supabase.from("stylist_chats").select("id,title,updated_at").eq("user_id",user.id).order("updated_at",{ ascending:false }).limit(100);
  checkRpc(chats.error);
  const active = chatId ? chats.data?.find(chat => chat.id === chatId)?.id : chats.data?.[0]?.id;
  if (chatId && !active) throw new WardrobeError("This chat is unavailable. Choose one of your own previous chats.",404);
  const emptyView = { messages:[],candidates:[],pending:[],logs:[],wardrobe:[],saved_outfit_ids:[],chats:chats.data || [],active_chat_id:null };
  if (!active) return emptyView;
  const turns = await supabase.from("stylist_turns").select("id").eq("user_id",user.id).eq("chat_id",active).order("created_at",{ ascending:false }).limit(50);
  checkRpc(turns.error);
  const ids = turns.data?.map(turn => turn.id) || [];
  const [messages, candidates, pending, logs, wardrobe,saved,photos] = await Promise.all([
    ids.length ? supabase.from("stylist_messages").select("id,role,content,turn_id,created_at").eq("user_id",user.id).in("turn_id",ids).order("created_at",{ ascending:false }).limit(100) : { data:[],error:null },
    ids.length ? supabase.from("outfit_candidates").select("id,turn_id,ordinal,payload,created_at").eq("user_id",user.id).in("turn_id",ids).order("created_at",{ ascending:false }).limit(150) : { data:[],error:null },
    supabase.from("agent_pending_actions").select("token,action_name,payload,status,expires_at,result").eq("user_id",user.id).eq("chat_id",active).order("created_at",{ ascending:false }).limit(20),
    supabase.from("agent_action_logs").select("id,action_name,sanitized_arguments,status,confirmation_status,error_message,created_at").eq("user_id",user.id).eq("chat_id",active).order("created_at",{ ascending:false }).limit(40),
    loadWardrobe(),supabase.from("outfits").select("id").eq("user_id",user.id),
    ids.length ? supabase.from("stylist_photo_searches").select("turn_id,payload").eq("user_id",user.id).in("turn_id",ids) : { data:[],error:null },
  ]);
  checkRpc(saved.error);
  [messages.error,candidates.error,pending.error,logs.error].forEach(checkRpc);
  // Older chats remain usable before the optional photo migration is applied.
  if (photos.error && !["42P01","PGRST205"].includes(photos.error.code || "")) checkRpc(photos.error);
  const photoBatches = new Map((photos.data || []).flatMap(row => {
    const parsed = photoBatchSchema.safeParse(row.payload);
    return parsed.success ? [[row.turn_id,parsed.data] as const] : [];
  }));
  const rows = (candidates.data || []).map(row => ({ ...outfitDetailsSchema.parse(row.payload), id: row.id, turn_id: row.turn_id, ordinal: row.ordinal })) as OutfitCandidate[];
  return {
    messages: (messages.data || []).reverse().map(row => ({ id: row.id, role: row.role as StylistMessage["role"], content: row.content, turn_id: row.turn_id, candidates: rows.filter(candidate => candidate.turn_id === row.turn_id).sort((a,b) => a.ordinal-b.ordinal),reference_photos:photoBatches.get(row.turn_id) })),
    candidates: rows,
    pending: (pending.data || []).map(row => ({ ...row, payload: { id: row.payload.id, name: row.payload.name, proposal: row.payload.proposal } })) as PendingAction[],
    logs: (logs.data || []) as ActionLog[], wardrobe: wardrobe.items,saved_outfit_ids:saved.data?.map(outfit => outfit.id) || [],chats:chats.data || [],active_chat_id:active,
  };
}

export async function writeOutfit(context: StylistContext, id: string, details: { name: string; occasion: string; aesthetic: string; description: string; is_favorite: boolean }, ids: string[], expected: string | null) {
  const { data: wardrobe, error: wardrobeError } = await context.supabase.from("wardrobe_items").select("id,category").eq("user_id",context.user.id).in("id",ids);
  checkRpc(wardrobeError); validateOutfitItems(ids,wardrobe || []);
  const { data, error } = await context.supabase.rpc("write_outfit",{ p_id:id, p_details:details, p_item_ids:ids, p_expected:expected });
  checkRpc(error); return { ...data, item_ids:data.item_ids || ids } as SavedOutfit;
}

export async function recordAction(context: StylistContext, id: string, name: string, args: Record<string,unknown>, status: string, error?: string) {
  const { error: logError } = await context.supabase.rpc("record_agent_action",{ p_id:id,p_action:name,p_args:args,p_status:status,p_confirmation:status === "awaiting_confirmation" ? status : "not_required",p_error:error || null,...(context.chatId ? { p_chat:context.chatId } : {}) });
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
  let generated = false, analyzed = false, clothingWrite = false, outfitWrite = false, photoSearch = false;
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
      case "search_reference_photos": {
        if (photoSearch) throw new Error("Only one photo search is allowed per request. Use the current examples or ask in a new message.");
        photoSearch = true;
        const { query } = toolSchemas.search_reference_photos.parse(args);
        if (!process.env.UNSPLASH_ACCESS_KEY?.trim()) throw new Error("Reference photos are not configured. Add UNSPLASH_ACCESS_KEY on the server and restart it.");
        const reservation = await supabase.rpc("reserve_photo_search",{ p_turn:turnId });
        if (reservation.error) {
          if (reservation.error.message.includes("allowance")) throw new Error("The shared photo-search allowance is used up. Try again later; written recommendations still work.");
          throw new Error("Reference-photo setup is incomplete or this search was already attempted. Apply 0005_reference_photos.sql if needed. Written recommendations still work.");
        }
        const batch = await searchReferencePhotos(query,process.env.UNSPLASH_ACCESS_KEY);
        const stored = await supabase.rpc("store_reference_photos",{ p_turn:turnId,p_payload:batch });
        if (stored.error) throw new Error("Photo examples were found but could not be saved to this chat. No reference cards were added.");
        return completed({ query:batch.query,photo_count:batch.photos.length,cards_displayed:batch.photos.length>0,limitations:"Stock style references only; exact garment, color and product matches are not verified. Not owned clothing or shopping listings." });
      }
      case "get_wardrobe": {
        const filters = toolSchemas.get_wardrobe.parse(args);
        const rows = (await wardrobe()).filter(item => (!filters.category || item.category === filters.category) && (!filters.color || item.primary_color?.toLowerCase() === filters.color.toLowerCase()) && (!filters.search || `${item.name} ${item.description}`.toLowerCase().includes(filters.search.toLowerCase())));
        return completed({ items:rows.map(item => ({ id:item.id,name:item.name,category:item.category,subcategory:item.subcategory,primary_color:item.primary_color,secondary_colors:item.secondary_colors,style_tags:item.style_tags,season_tags:item.season_tags,description:item.description })), limit:300 });
      }
      case "get_wardrobe_item": return completed(requireOwnedItem(await getOwnedItem(toolSchemas.get_wardrobe_item.parse(args).id,context),user.id));
      case "get_style_profile": {
        const images=await supabase.from("inspiration_images").select("id,name").eq("user_id",user.id).order("created_at",{ ascending:false }).limit(50);checkRpc(images.error);
        return completed({ profile:await getStyle(context),inspiration_images:images.data || [] });
      }
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
        return completed({ ...await runInspirationAnalysis(context,[image_id]),applied:false });
      }
    }
  };
}
