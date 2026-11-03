import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hasSupabaseConfig, getSupabaseConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  if (!hasSupabaseConfig()) return NextResponse.redirect(new URL("/login", request.url));
  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseConfig();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!user || error) {
      const login = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.getAll().forEach(cookie => login.cookies.set(cookie));
      return login;
    }
  } catch {
    return NextResponse.redirect(new URL("/login?error=unavailable", request.url));
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/dashboard/:path*", "/closet/:path*", "/stylist/:path*", "/style-dna/:path*", "/lookbook/:path*", "/settings/:path*"] };
