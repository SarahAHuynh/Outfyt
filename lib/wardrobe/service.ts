import type { Clothing, WardrobeItem } from "./schema";

export class WardrobeError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type NewItemDependencies = {
  find: (id: string, userId: string) => Promise<WardrobeItem | null>;
  upload: (path: string, bytes: Uint8Array, mime: string) => Promise<void>;
  insert: (item: Clothing & { id: string; user_id: string; image_path: string | null }) => Promise<WardrobeItem>;
  removeImage: (path: string) => Promise<void>;
};

// Stable item IDs make a retry after an interrupted response safe. A repeated
// create returns the original item and never overwrites an existing image.
export async function createWardrobeItem(
  userId: string, id: string, clothing: Clothing,
  image: { bytes: Uint8Array; mime: string; extension: string } | null,
  dependencies: NewItemDependencies,
) {
  const existing = await dependencies.find(id, userId);
  if (existing) {
    if (existing.user_id !== userId) throw new WardrobeError("This piece is unavailable.", 404);
    return { item: existing, alreadySaved: true };
  }
  const imagePath = image ? `${userId}/${id}.${image.extension}` : null;
  if (image && imagePath) await dependencies.upload(imagePath, image.bytes, image.mime);
  try {
    const item = await dependencies.insert({ ...clothing, id, user_id: userId, image_path: imagePath });
    return { item, alreadySaved: false };
  } catch {
    // A write may have committed despite a disconnected response. Check before
    // removing the image so an already-saved item keeps its photo.
    let committed: WardrobeItem | null;
    try { committed = await dependencies.find(id, userId); }
    catch { throw new WardrobeError("Could not verify whether this piece was saved. Retry with this form open; its photo has been kept safely.", 503); }
    if (committed) return { item: requireOwnedItem(committed, userId), alreadySaved: true };
    if (imagePath) {
      try { await dependencies.removeImage(imagePath); }
      catch { throw new WardrobeError("The piece was not saved. Its private upload could not be cleaned up; please try again with a new form.", 503); }
    }
    throw new WardrobeError("Could not save this piece. Please try again.", 503);
  }
}

export function requireOwnedItem(item: WardrobeItem | null, userId: string): WardrobeItem {
  if (!item || item.user_id !== userId) throw new WardrobeError("This piece is unavailable or no longer exists.", 404);
  return item;
}
