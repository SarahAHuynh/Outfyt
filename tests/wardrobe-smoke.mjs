// Start the app, then run: node tests/wardrobe-smoke.mjs http://localhost:3000
// No cookies, credentials, stored data, or paid API calls are used.
import assert from "node:assert/strict";

const base = process.argv[2] || "http://localhost:3000";
const id = "00000000-0000-4000-8000-000000000001";
for (const [method, path] of [
  ["GET", "/api/wardrobe"], ["POST", "/api/wardrobe"],
  ["POST", "/api/wardrobe/analyze"], ["PATCH", `/api/wardrobe/${id}`],
  ["POST", `/api/wardrobe/${id}/deletion`], ["DELETE", `/api/wardrobe/${id}/deletion`],
]) {
  const response = await fetch(new URL(path, base), { method, redirect: "manual" });
  assert.equal(response.status, 401, `${method} ${path} must require authentication`);
  assert.match((await response.json()).error, /sign in/i);
  console.log(`PASS: ${method} ${path} rejects signed-out access`);
}
const crossOrigin = await fetch(new URL("/api/wardrobe", base), { method: "POST", headers: { Origin: "https://untrusted.example" } });
assert.equal(crossOrigin.status, 403);
console.log("PASS: cross-origin mutation rejected");
