import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254),
  password: z.string().min(1, "Enter your password.").max(256, "Password must be at most 256 characters."),
});

export const signupSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(1, "Enter your name.").max(100),
  password: z.string().min(8, "Choose a password with at least 8 characters.").max(256),
  confirmPassword: z.string(),
}).refine(value => value.password === value.confirmPassword, {
  message: "Passwords do not match.", path: ["confirmPassword"],
});

export function authErrorMessage(error: { code?: string; status?: number }) {
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") return "Too many attempts. Please wait a few minutes before trying again.";
  if (error.code === "email_not_confirmed") return "Confirm your email before signing in. Check your inbox and spam folder.";
  if (error.code === "invalid_credentials") return "Email or password is incorrect.";
  if (error.code === "weak_password") return "Choose a stronger password that meets your project's password requirements.";
  if (error.code === "email_address_not_authorized") return "Email delivery is limited in this Supabase project. For this test, use the project owner's email address.";
  return "We could not complete that request. Check your details and try again shortly.";
}
