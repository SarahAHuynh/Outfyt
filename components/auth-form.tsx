"use client";

import { useActionState, useState } from "react";
import { authenticate, resendConfirmation } from "@/app/auth/actions";
import { AuthError } from "./auth-error";

export function AuthForm({ configured }: { configured: boolean }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  return <div className="mt-7">
    {!configured && <p role="alert" className="mb-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Supabase is not connected yet. Add your project URL and publishable key to .env.local, then restart the server.</p>}
    <div className="mb-6 flex gap-2" aria-label="Account options">
      {(["login", "signup"] as const).map(value => <button type="button" key={value} aria-pressed={mode === value} onClick={() => setMode(value)} className={`flex-1 rounded-full px-4 py-2 text-sm ${mode === value ? "bg-[#eee9f4] font-semibold text-[#71638e]" : "text-[#756e78]"}`}>{value === "login" ? "Sign in" : "Create account"}</button>)}
    </div>
    <CredentialsForm key={mode} mode={mode} configured={configured} />
    <details className="mt-6 text-sm text-[#756e78]">
      <summary className="cursor-pointer">Need another confirmation email?</summary>
      <ResendForm configured={configured} />
    </details>
  </div>;
}

const inputStyle = "mt-2 w-full rounded-xl border border-[#d9d0dc] px-4 py-3 outline-none focus:ring-2 focus:ring-[#a69ac5]";

function CredentialsForm({ mode, configured }: { mode: "login" | "signup"; configured: boolean }) {
  const [state, action, pending] = useActionState(authenticate, {});
  return <form action={action} className="space-y-4">
    <input type="hidden" name="mode" value={mode} />
    <fieldset disabled={pending || !configured} className="space-y-4 disabled:opacity-60">
      {mode === "signup" && <label className="block text-sm">Your name<input name="displayName" required maxLength={100} autoComplete="name" className={inputStyle} /></label>}
      <label className="block text-sm">Email address<input name="email" required type="email" maxLength={254} autoComplete="email" className={inputStyle} /></label>
      <label className="block text-sm">Password<input name="password" required type="password" minLength={mode === "signup" ? 8 : 1} maxLength={256} autoComplete={mode === "signup" ? "new-password" : "current-password"} aria-describedby={mode === "signup" ? "password-help" : undefined} className={inputStyle} /></label>
      {mode === "signup" && <><p id="password-help" className="text-xs text-[#756e78]">Use at least 8 characters.</p><label className="block text-sm">Confirm password<input name="confirmPassword" required type="password" maxLength={256} autoComplete="new-password" className={inputStyle} /></label></>}
      <button type="submit" className="w-full rounded-full bg-[#28262b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#71638e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71638e]">{pending ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}</button>
    </fieldset>
    {state.error && <AuthError error={state.error} retryAt={state.retryAt} />}
    {state.message && <p role="status" className="text-sm text-[#71638e]">{state.message}</p>}
  </form>;
}

function ResendForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(resendConfirmation, {});
  return <form action={action} className="mt-4 space-y-3">
    <p>Already confirmed your email? Sign in instead. This form only requests a link for an account that still needs confirmation.</p>
    <label className="block">Email address<input name="email" required type="email" autoComplete="email" className={inputStyle} /></label>
    <button disabled={pending || !configured} className="underline disabled:opacity-50">{pending ? "Requesting..." : "Send a new confirmation link"}</button>
    {state.error && <AuthError error={state.error} retryAt={state.retryAt} />}
    {state.message && <p role="status">{state.message}</p>}
  </form>;
}
