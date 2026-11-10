import { z } from "zod";
export const profileUpdateSchema=z.object({ display_name:z.string().trim().min(1,"Enter a display name.").max(100,"Keep your display name under 101 characters."),updated_at:z.string().datetime({ offset:true }) }).strict();
