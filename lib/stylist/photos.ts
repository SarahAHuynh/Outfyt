import { z } from "zod";

function allowedUrl(host: string) {
  return z.string().url().refine(value => {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === host && !url.username && !url.password && !url.port;
  });
}
export const referencePhotoSchema = z.object({
  id:z.string().min(1).max(100), image_url:allowedUrl("images.unsplash.com"),
  photo_url:allowedUrl("unsplash.com"), photographer:z.string().min(1).max(200),
  photographer_url:allowedUrl("unsplash.com"), alt:z.string().max(500),
});
export const photoBatchSchema = z.object({ query:z.string().trim().min(1).max(120), photos:z.array(referencePhotoSchema).max(3) });
export type PhotoBatch = z.infer<typeof photoBatchSchema>;

function creditLink(value:string) {
  const url = new URL(value);
  url.searchParams.set("utm_source","outfyt");
  url.searchParams.set("utm_medium","referral");
  return url.toString();
}

// The caller supplies a server-only key; tests inject fetch without live requests.
export async function searchReferencePhotos(query:string,key:string | undefined,request:typeof fetch = fetch):Promise<PhotoBatch> {
  const input = photoBatchSchema.shape.query.parse(query);
  if (!key?.trim()) throw new Error("Reference photos are not configured. Add UNSPLASH_ACCESS_KEY on the server and restart it.");
  const url = new URL("https://api.unsplash.com/search/photos");
  url.search = new URLSearchParams({ query:input,per_page:"3",content_filter:"high",order_by:"relevant" }).toString();
  let response:Response;
  try {
    response = await request(url,{ headers:{ Authorization:`Client-ID ${key}`,"Accept-Version":"v1" },cache:"no-store",signal:AbortSignal.timeout(12_000) });
  } catch { throw new Error("Reference-photo search is unavailable right now. You can still ask for written recommendations."); }
  if (!response.ok) {
    if (response.status === 429 || response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") throw new Error("The shared photo-search allowance is used up. Try again later; written recommendations still work.");
    if ([401,403].includes(response.status)) throw new Error("The server's Unsplash access needs attention. Written recommendations still work.");
    throw new Error("Reference-photo search is unavailable right now. Written recommendations still work.");
  }
  let payload:unknown;
  try { payload = await response.json(); } catch { throw new Error("The photo service returned an invalid response. No reference photos were added."); }
  const envelope = z.object({ results:z.array(z.unknown()) }).safeParse(payload);
  if (!envelope.success) throw new Error("The photo service returned an invalid response. No reference photos were added.");
  const photos:PhotoBatch["photos"] = [];
  for (const raw of envelope.data.results.slice(0,3)) {
    const item = z.object({ id:z.string(),urls:z.object({ small:z.string() }),links:z.object({ html:z.string() }),user:z.object({ name:z.string(),links:z.object({ html:z.string() }) }),alt_description:z.string().nullable().optional() }).safeParse(raw);
    if (!item.success) continue;
    const p = item.data;
    const parsed = referencePhotoSchema.safeParse({ id:p.id,image_url:p.urls.small,photo_url:p.links.html,photographer:p.user.name,photographer_url:p.user.links.html,alt:(p.alt_description || `Style reference for ${input}`).slice(0,500) });
    if (parsed.success && !photos.some(photo => photo.id === parsed.data.id)) photos.push({ ...parsed.data,photo_url:creditLink(parsed.data.photo_url),photographer_url:creditLink(parsed.data.photographer_url) });
  }
  return { query:input,photos };
}
