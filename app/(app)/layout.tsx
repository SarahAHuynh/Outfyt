import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseConfig()) redirect("/login");
  let authorized = false;
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    authorized = Boolean(user && !error);
  } catch { /* Fail closed when authentication cannot be verified. */ }
  if (!authorized) redirect("/login");
  return children;
}
