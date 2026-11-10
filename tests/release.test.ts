import { test } from "node:test";
import assert from "node:assert/strict";
import { AppUrlError,confirmationRedirectUrl } from "../lib/auth/app-url";
import { profileUpdateSchema } from "../lib/profile/schema";
import { MAX_IMAGE_BYTES,MAX_STORED_IMAGE_BYTES,imageMetadataError } from "../lib/wardrobe/schema";

test("production email callbacks require an explicit public HTTPS app origin",()=>{
  assert.equal(confirmationRedirectUrl({ appUrl:"https://outfyt.example/",vercel:"1" }),"https://outfyt.example/auth/callback");
  for (const appUrl of [undefined,"http://outfyt.example","https://localhost:3000","https://127.0.0.1:3000","https://outfyt.example/nested","https://outfyt.example/?token=private","https://user:secret@outfyt.example/","javascript:alert(1)"]) {
    assert.throws(()=>confirmationRedirectUrl({ appUrl,vercel:"1" }),error=>error instanceof AppUrlError && !/private|secret|javascript/.test(error.message));
  }
});
test("local production smoke servers can still use localhost confirmation callbacks",()=>{
  assert.equal(confirmationRedirectUrl({}),"http://localhost:3000/auth/callback");
  assert.equal(confirmationRedirectUrl({ appUrl:"http://127.0.0.1:3104" }),"http://127.0.0.1:3104/auth/callback");
});
test("profile updates validate names and versions and reject owner/email injection",()=>{
  const value={ display_name:"  Sarah  ",updated_at:"2026-11-10T01:00:00Z" };
  assert.equal(profileUpdateSchema.parse(value).display_name,"Sarah");
  for (const invalid of [{ ...value,display_name:" " },{ ...value,display_name:"x".repeat(101) },{ ...value,updated_at:"not-a-version" },{ ...value,id:"other-owner" },{ ...value,email:"attacker@example.invalid" }]) assert.equal(profileUpdateSchema.safeParse(invalid).success,false);
});
test("new multipart uploads fit the hosting limit without rejecting previously stored images",()=>{
  assert.ok(MAX_IMAGE_BYTES+64*1024<4_500_000);
  assert.equal(imageMetadataError({ size:MAX_IMAGE_BYTES,type:"image/jpeg" }),null);
  assert.match(imageMetadataError({ size:MAX_IMAGE_BYTES+1,type:"image/jpeg" })!,/4 MB/);
  assert.equal(imageMetadataError({ size:MAX_STORED_IMAGE_BYTES,type:"image/jpeg" },MAX_STORED_IMAGE_BYTES),null);
});
