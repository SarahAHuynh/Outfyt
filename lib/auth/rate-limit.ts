type RateLimitError = { code?: string; status?: number; message?: string };

// Trust timing only when supplied by the provider, never infer a reset from
// the first local failure: the email allowance is shared across the project.
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value?.trim()) return undefined;
  const text = value.trim();
  const timestamp = /^\d+$/.test(text) ? now + Number(text) * 1000 : Date.parse(text);
  if (!Number.isFinite(timestamp) || timestamp < now || timestamp - now > 86_400_000) return undefined;
  return timestamp;
}

export function getAuthRetryAt(error: RateLimitError, headerRetryAt?: number, now = Date.now()): number | undefined {
  const isRateLimit = error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit";
  if (!isRateLimit) return undefined;
  if (headerRetryAt !== undefined && Number.isFinite(headerRetryAt) && headerRetryAt >= now && headerRetryAt - now <= 86_400_000) return headerRetryAt;
  // Supabase's per-address cooldown uses this specific message. Extract only
  // its numeric delay; do not display raw provider text or private details.
  const match = error.message?.match(/^For security purposes, you can only request this after (\d+) seconds?\.?$/i);
  if (!match) return undefined;
  return parseRetryAfter(match[1], now);
}

export function formatRetryTime(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
