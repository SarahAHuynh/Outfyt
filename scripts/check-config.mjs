// Prints configuration names/status only. Does not call external services.
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const production=process.argv.includes("--production");
const publicOnly=process.argv.includes("--public-only");
let failures=0;
function check(name,ok) { console.log(`${ok ? 'PASS' : 'CHECK'}: ${name}`);if (!ok) failures++; }
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
let publicKey=key.startsWith("sb_publishable_");
if (!publicKey) { try { publicKey=JSON.parse(Buffer.from(key.split(".")[1],"base64url").toString()).role==="anon"; } catch { /* Not a supported public key. */ } }
if (publicOnly) {
  // CI may build without service configuration. A supplied browser key must be public.
  if (key) check("Supabase browser key is publishable/anon, not privileged",publicKey);
  else console.log("INFO: no Supabase browser key supplied; configure it before live use.");
  process.exit(failures ? 1 : 0);
}
for (const name of ["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY","OPENAI_API_KEY","OPENAI_MODEL","NEXT_PUBLIC_APP_URL"]) check(`${name} is set`,Boolean(process.env[name]?.trim()));
try { const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);check("Supabase URL uses HTTPS",url.protocol==="https:" && !url.username && !url.password && !url.hostname.includes("your-project")); } catch { check("Supabase URL is valid",false); }
check("Supabase browser key is publishable/anon, not privileged",publicKey);
try {
  const url=new URL(process.env.NEXT_PUBLIC_APP_URL);
  check("App URL is a website origin",["http:","https:"].includes(url.protocol) && !url.username && !url.password && url.pathname==="/" && !url.search && !url.hash);
  if (production) check("Production app URL uses HTTPS and a public host",url.protocol==="https:" && !["localhost","127.0.0.1","[::1]"].includes(url.hostname));
} catch { check("App URL is valid",false); }
console.log(`INFO: Unsplash ${process.env.UNSPLASH_ACCESS_KEY?.trim() ? 'configured' : 'optional key missing; photo recommendations unavailable'}`);
console.log("INFO: Pinterest synchronization is not configured. Board bookmarks still work.");
console.log("INFO: This check does not verify live credentials, migrations, billing or deployment.");
process.exitCode=failures ? 1 : 0;
