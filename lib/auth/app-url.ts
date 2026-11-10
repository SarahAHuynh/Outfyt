export class AppUrlError extends Error {}

export function confirmationRedirectUrl(config:{ appUrl?:string;vercel?:string }) {
  const configured=config.appUrl?.trim();
  if (config.vercel && !configured) throw new AppUrlError("Email confirmation is not configured for this website. Please try again later.");
  let url:URL;
  try { url=new URL(configured || "http://localhost:3000"); }
  catch { throw new AppUrlError("Email confirmation is not configured for this website. Please try again later."); }
  const local=["localhost","127.0.0.1","[::1]"].includes(url.hostname);
  if (!["https:","http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname!=="/" || config.vercel && (url.protocol!=="https:" || local)) throw new AppUrlError("Email confirmation is not configured for this website. Please try again later.");
  return new URL("/auth/callback",url).toString();
}
