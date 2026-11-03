"use client";
import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { logout } from "@/app/auth/actions";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return <><button disabled={pending} onClick={() => { setError(""); startTransition(async () => { const result = await logout(); if (result.error) setError(result.error); }); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#756e78] hover:bg-[#f4f0f5] disabled:opacity-50"><LogOut className="h-[18px] w-[18px]" />{pending ? "Signing out..." : "Log out"}</button>{error && <p role="alert" className="px-4 text-sm text-rose-800">{error}</p>}</>;
}
