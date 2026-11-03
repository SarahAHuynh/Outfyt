import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="flex min-h-screen items-center justify-center px-6 py-12">
    <div className="w-full max-w-md rounded-3xl border border-[#ebe7e7] bg-white p-8 md:p-10">
      <Link href="/" className="serif text-3xl">outfyt<span className="text-[#a69ac5]">.</span></Link>
      <h1 className="serif mt-10 text-4xl">Your style starts here.</h1>
      <p className="mt-3 text-sm leading-6 text-[#756e78]">Sign in or create an account to make room for your personal style.</p>
      {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error === "confirmation" ? "This confirmation link is invalid or expired. Try signing in if you already confirmed your email, or request a new confirmation below." : "We could not reach the sign-in service. Please try again shortly."}</p>}
      <AuthForm configured={hasSupabaseConfig()} />
      <Link href="/" className="mt-8 block text-center text-sm text-[#756e78] underline">Back to home</Link>
    </div>
  </main>;
}
