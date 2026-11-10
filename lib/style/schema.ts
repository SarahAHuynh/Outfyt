import { z } from "zod";
import { styleProposalSchema } from "@/lib/stylist/schema";

export const profileSchema = styleProposalSchema.extend({ comfort_preferences:z.string().trim().max(1000),notes:z.string().trim().max(1000) });
export type StyleProfile = z.infer<typeof profileSchema>;
export const EMPTY_PROFILE:StyleProfile = { aesthetic_tags:[],preferred_colors:[],favorite_clothing_types:[],disliked_styles:[],style_summary:"",comfort_preferences:"",notes:"" };
export const profileRequestSchema = z.object({ profile:profileSchema,expected_version:z.string().datetime({ offset:true }).nullable() }).strict();
export const analysisRequestSchema = z.object({ image_ids:z.array(z.string().uuid()).min(1).max(5).refine(ids => new Set(ids).size===ids.length,"Choose each image once.") }).strict();
export const pinterestSchema = z.string().trim().max(500).transform((value,ctx) => {
  try {
    const url = new URL(value);
    if (url.protocol!=="https:" || !["pinterest.com","www.pinterest.com"].includes(url.hostname) || url.username || url.password || url.port || !/^\/[\w-]+\/[\w-]+\/?$/.test(url.pathname) || ["pin","search","ideas","settings","business"].includes(url.pathname.split("/")[1])) throw Error();
    return `https://www.pinterest.com${url.pathname.replace(/\/$/,"")}/`;
  } catch { ctx.addIssue({ code:"custom",message:"Use a full Pinterest board URL: https://www.pinterest.com/username/board-name/" }); return z.NEVER; }
});
export type InspirationImage = { id:string;name:string;image_url:string | null;created_at:string };
export type StyleView = { profile:StyleProfile;updated_at:string | null;images:InspirationImage[];board_url:string | null;pending:import("@/lib/stylist/schema").PendingAction[] };

export function mergeStyleSuggestion(current:StyleProfile,suggestion:z.infer<typeof styleProposalSchema>):StyleProfile {
  const merged = { ...current };
  for (const field of ["aesthetic_tags","preferred_colors","favorite_clothing_types"] as const) {
    const values = [...current[field]];
    for (const value of suggestion[field]) if (!values.some(existing => existing.toLowerCase()===value.toLowerCase()) && values.length<12 && !(field==="aesthetic_tags" && current.disliked_styles.some(disliked => disliked.toLowerCase()===value.toLowerCase()))) values.push(value);
    merged[field] = values;
  }
  merged.style_summary = current.style_summary || suggestion.style_summary;
  return profileSchema.parse(merged);
}
