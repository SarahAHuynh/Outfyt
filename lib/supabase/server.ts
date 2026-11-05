import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";
import { parseRetryAfter } from "@/lib/auth/rate-limit";

export async function createClient(options?: { onAuthRateLimit?: (retryAt: number) => void }) {
  const { url, key } = getSupabaseConfig();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    global: {
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (response.status === 429 && requestUrl.startsWith(`${url.replace(/\/$/, "")}/auth/v1/`)) {
          const retryAt = parseRetryAfter(response.headers.get("retry-after"));
          if (retryAt !== undefined) options?.onAuthRateLimit?.(retryAt);
        }
        return response;
      },
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* Server Components cannot set cookies; proxy handles refresh. */ }
      },
    },
  });
}
