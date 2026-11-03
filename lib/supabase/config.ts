export function hasSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(url && key && !url.includes("your-project") && !key.includes("your-publishable"));
}

export function getSupabaseConfig() {
  if (!hasSupabaseConfig()) throw new Error("Supabase is not configured. Add the project URL and publishable key to .env.local.");
  return { url: process.env.NEXT_PUBLIC_SUPABASE_URL!, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! };
}
