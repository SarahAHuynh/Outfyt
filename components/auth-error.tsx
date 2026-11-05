"use client";

import { useEffect, useState } from "react";
import { formatRetryTime } from "@/lib/auth/rate-limit";

export function AuthError({ error, retryAt }: { error: string; retryAt?: number }) {
  return <div role="alert" className="text-sm text-rose-800"><p>{error}</p>{retryAt !== undefined && <RetryCountdown key={retryAt} retryAt={retryAt} />}</div>;
}

function RetryCountdown({ retryAt }: { retryAt: number }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [retryAt]);

  return <p className="mt-1" role="timer" aria-live="off">{remaining > 0 ? `Try again in ${formatRetryTime(remaining)} (minutes:seconds).` : "The reported wait has ended. You can try again; delivery is still subject to email service limits."}</p>;
}
