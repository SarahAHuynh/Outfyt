// Run against a started app. No cookies, real mutations, or paid calls.
import assert from "node:assert/strict";
const base = process.argv[2] || "http://localhost:3000";
const id = "00000000-0000-4000-8000-000000000001";
for (const [method,path] of [
  ["GET","/api/stylist"],["POST","/api/stylist"],["POST","/api/stylist/approval"],["POST","/api/stylist/chats"],
  ["GET","/api/outfits"],["POST","/api/outfits"],["PATCH",`/api/outfits/${id}`],["DELETE",`/api/outfits/${id}`],
  ["GET","/api/style-dna"],["POST","/api/style-dna"],["POST","/api/style-dna/analyze"],
  ["POST","/api/style-dna/inspiration"],["POST","/api/style-dna/inspiration/delete"],["PATCH","/api/style-dna/inspiration/delete"],["POST","/api/style-dna/pinterest"],
  ["PATCH","/api/profile"],
]) {
  const response = await fetch(new URL(path,base),{ method,redirect:"manual" });
  assert.equal(response.status,401,`${method} ${path} must require authentication`);
  assert.match((await response.json()).error,/sign in/i);
  console.log(`PASS: ${method} ${path} rejects signed-out access`);
}
const profileOrigin=await fetch(new URL('/api/profile',base),{ method:'PATCH',headers:{ Origin:'https://untrusted.example' } });
assert.equal(profileOrigin.status,403);console.log('PASS: cross-origin profile mutation rejected');
for (const path of ["/api/stylist","/api/stylist/approval","/api/outfits","/api/style-dna","/api/style-dna/analyze","/api/style-dna/inspiration","/api/style-dna/inspiration/delete","/api/style-dna/pinterest"]) {
  const response = await fetch(new URL(path,base),{ method:"POST",headers:{ Origin:"https://untrusted.example" } });
  assert.equal(response.status,403); console.log(`PASS: cross-origin mutation rejected by ${path}`);
}
