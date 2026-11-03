// Start the app first, then run: node tests/auth-smoke.mjs http://localhost:3000
// Uses no credentials, cookies, or live account mutations.
import assert from "node:assert/strict";

const base = process.argv[2] || "http://localhost:3000";
const login = await fetch(new URL("/login", base));
assert.equal(login.status, 200);
assert.match(await login.text(), /Your style starts here/);
console.log("PASS: login renders");

for (const path of ["/dashboard", "/closet", "/stylist", "/style-dna", "/lookbook", "/settings"]) {
  const res = await fetch(new URL(path, base), { redirect: "manual" });
  assert.equal(res.status, 307);
  assert.equal(new URL(res.headers.get("location"), base).pathname, "/login");
  console.log(`PASS: signed-out request to ${path} redirects to login`);
}

for (const path of ["/auth/confirm", "/auth/confirm?token_hash=invalid&type=recovery", "/auth/callback"]) {
  const res = await fetch(new URL(path, base), { redirect: "manual" });
  assert.equal(res.status, 307);
  assert.equal(new URL(res.headers.get("location"), base).pathname, "/login");
  assert.equal(new URL(res.headers.get("location"), base).search, "?error=confirmation");
  console.log("PASS: missing or unsupported confirmation/callback input rejected");
}
