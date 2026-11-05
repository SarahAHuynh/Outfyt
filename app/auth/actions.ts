"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { authErrorMessage, credentialsSchema, signupSchema } from "@/lib/auth/validation";
import { getAuthRetryAt } from "@/lib/auth/rate-limit";

type AuthState = { error?: string; message?: string; retryAt?: number };

function authFailure(error: { code?: string; status?: number; message?: string }, headerRetryAt?: number): AuthState {
  const retryAt = getAuthRetryAt(error, headerRetryAt);
  if (retryAt !== undefined) return { error: error.code === "over_email_send_rate_limit" ? "Email delivery limit reached." : "Too many attempts.", retryAt };
  return { error: authErrorMessage(error) };
}

export async function authenticate(_previous: AuthState, form: FormData): Promise<AuthState> {
  if (!hasSupabaseConfig()) return { error: "Add your Supabase URL and publishable key to .env.local, then restart the development server." };
  const mode = form.get("mode");
  if (mode !== "signup" && mode !== "login") return { error: "Choose sign in or create account." };
  const input = { email: form.get("email"), password: form.get("password"), displayName: form.get("displayName"), confirmPassword: form.get("confirmPassword") };
  const parsed = mode === "signup" ? signupSchema.safeParse(input) : credentialsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    let headerRetryAt: number | undefined;
    const supabase = await createClient({ onAuthRateLimit: value => { headerRetryAt = value; } });
    if (mode === "signup") {
      const data = signupSchema.parse(input);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const { data: result, error } = await supabase.auth.signUp({
        email: data.email, password: data.password,
        options: { data: { display_name: data.displayName }, emailRedirectTo: new URL("/auth/callback", appUrl).toString() },
      });
      if (error) return authFailure(error, headerRetryAt);
      if (!result.session) return { message: "Check your email for a confirmation link. If you already have an account, switch to Sign in. Delivery may take a minute; check spam too." };
    } else {
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      if (error) return authFailure(error, headerRetryAt);
    }
  } catch {
    return { error: "Could not connect to Supabase. Check your connection and local project settings, then try again." };
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function resendConfirmation(_previous: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z.string().trim().email().max(254).safeParse(form.get("email"));
  if (!parsed.success) return { error: "Enter your email address before requesting a new link." };
  try {
    let headerRetryAt: number | undefined;
    const supabase = await createClient({ onAuthRateLimit: value => { headerRetryAt = value; } });
    const { error } = await supabase.auth.resend({ type: "signup", email: parsed.data, options: { emailRedirectTo: new URL("/auth/callback", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").toString() } });
    if (error) return authFailure(error, headerRetryAt);
    return { message: "Request accepted. A new email is only sent for an account that still needs confirmation. If you already confirmed your email, sign in instead. Otherwise, check your inbox and spam folder." };
  } catch {
    return { error: "Could not connect to the email service. Please try again shortly." };
  }
}

export async function logout(): Promise<AuthState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { error: "Could not sign out. Please try again." };
  } catch {
    return { error: "Could not sign out. Check your connection and try again." };
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
