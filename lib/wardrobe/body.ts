import { WardrobeError } from "./service";

export async function readBoundedBytes(request: Request, maximum: number): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(request.headers.get("content-length")) > maximum) throw new WardrobeError("Request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new WardrobeError("The request was empty.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new WardrobeError("Request is too large.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(size);
  let offset = 0;
  chunks.forEach(chunk => { buffer.set(chunk, offset); offset += chunk.length; });
  return buffer;
}

export async function readSmallJson(request: Request) {
  try { return JSON.parse(new TextDecoder().decode(await readBoundedBytes(request, 16_384))); }
  catch (error) {
    if (error instanceof WardrobeError) throw error;
    throw new WardrobeError("The item details could not be read. Please try again.");
  }
}
