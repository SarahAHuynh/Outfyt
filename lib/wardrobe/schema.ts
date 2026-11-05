import { z } from "zod";

export const CATEGORIES = ["Tops", "Bottoms", "Dresses", "Outerwear", "Shoes", "Bags", "Accessories", "Other"] as const;
export const SEASONS = ["Spring", "Summer", "Fall", "Winter", "All season"] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const clothingSchema = z.object({
  name: z.string().trim().min(1, "Give this piece a name.").max(100),
  category: z.enum(CATEGORIES),
  subcategory: z.string().trim().max(80),
  primary_color: z.string().trim().min(1, "Enter a primary color.").max(40),
  secondary_colors: z.array(z.string().trim().min(1).max(40)).max(8),
  style_tags: z.array(z.string().trim().min(1).max(40)).max(10),
  season_tags: z.array(z.enum(SEASONS)).max(5),
  description: z.string().trim().max(1000),
});

export const clothingAnalysisSchema = clothingSchema.extend({ is_clothing: z.boolean() });
export const itemIdSchema = z.string().uuid();
export const updateItemSchema = clothingSchema.extend({ updated_at: z.string().datetime({ offset: true }) });
export type Clothing = z.infer<typeof clothingSchema>;
export type WardrobeItem = Clothing & { id: string; user_id: string; image_path: string | null; created_at: string; updated_at: string; image_url?: string | null };

export function imageMetadataError(file: { size: number; type: string }): string | null {
  if (!IMAGE_TYPES.includes(file.type as typeof IMAGE_TYPES[number])) return "Choose a JPEG, PNG, or WebP image. HEIC and SVG are not supported.";
  if (file.size <= 0) return "This image is empty. Choose another photo.";
  if (file.size > MAX_IMAGE_BYTES) return "Choose an image smaller than or equal to 10 MB.";
  return null;
}

export function imageExtension(bytes: Uint8Array, mime: string): string | null {
  if (mime === "image/jpeg" && bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (mime === "image/png" && bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)) return "png";
  if (mime === "image/webp" && bytes.length >= 16 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  return null;
}
