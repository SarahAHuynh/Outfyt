// Run against a started app. No cookies, real mutations, or paid calls.
import assert from "node:assert/strict";
const base = process.argv[2] || "http://localhost:3000";
const id = "00000000-0000-4000-8000-000000000001";
for (const [method,path] of [
  ["GET","/api/stylist"],["POST","/api/stylist"],["POST","/api/stylist/approval"],["POST","/api/stylist/chats"],
  ["GET","/api/outfits"],["POST","/api/outfits"],["PATCH",`/api/outfits/${id}`],["DELETE",`/api/outfits/${id}`],
]) {
  const response = await fetch(new URL(path,base),{ method,redirect:"manual" });
  assert.equal(response.status,401,`${method} ${path} must require authentication`);
  assert.match((await response.json()).error,/sign in/i);
  console.log(`PASS: ${method} ${path} rejects signed-out access`);
}
for (const path of ["/api/stylist","/api/stylist/approval","/api/outfits"]) {
  const response = await fetch(new URL(path,base),{ method:"POST",headers:{ Origin:"https://untrusted.example" } });
  assert.equal(response.status,403); console.log(`PASS: cross-origin mutation rejected by ${path}`);
}
