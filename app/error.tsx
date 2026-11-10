"use client";
import Link from "next/link";
import { Button } from "@/components/ui";
export default function AppError({ reset }: { error:Error & { digest?:string };reset:()=>void }) {
  return <main className="flex min-h-screen items-center justify-center px-6"><section role="alert" className="w-full max-w-md rounded-3xl border border-[#e4dce9] bg-white p-8"><p className="text-sm font-semibold text-[#594273]">outfyt studio</p><h1 className="serif mt-4 text-3xl">Let’s try that again.</h1><p className="mt-3 text-sm leading-6 text-[#756e78]">This page couldn’t load. If an action was interrupted, check its history before repeating it.</p><div className="mt-6 flex flex-wrap items-center gap-4"><Button variant="accent" onClick={reset}>Try again</Button><Link href="/dashboard" className="text-sm text-[#594273] underline">Back to dashboard</Link></div></section></main>;
}
