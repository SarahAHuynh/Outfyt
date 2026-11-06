import { test } from "node:test";
import assert from "node:assert/strict";
import { searchReferencePhotos } from "../lib/stylist/photos";

const photo = { id:"reference-1",urls:{ small:"https://images.unsplash.com/photo-1?ixid=app&w=400" },links:{ html:"https://unsplash.com/photos/reference-1" },user:{ name:"Test Photographer",links:{ html:"https://unsplash.com/@test" } },alt_description:"Relaxed blue jeans" };
function mock(payload:unknown,status=200,headers:Record<string,string>={}):typeof fetch {
  return async () => new Response(JSON.stringify(payload),{ status,headers:{ "Content-Type":"application/json",...headers } });
}
test("photo search uses bounded server-authenticated search and preserves hotlinks with attribution",async () => {
  let calls = 0;
  const batch = await searchReferencePhotos("blue relaxed jeans","test-private-key",async (input,init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.origin,"https://api.unsplash.com");
    assert.equal(url.pathname,"/search/photos");
    assert.equal(url.searchParams.get("per_page"),"3");
    assert.equal(url.searchParams.get("content_filter"),"high");
    assert.equal(url.searchParams.get("query"),"blue relaxed jeans");
    assert.doesNotMatch(url.toString(),/test-private-key/);
    assert.equal((init?.headers as Record<string,string>).Authorization,"Client-ID test-private-key");
    return mock({ results:[photo,photo] })(input,init);
  });
  assert.equal(calls,1);
  assert.equal(batch.photos.length,1);
  assert.equal(batch.photos[0].image_url,photo.urls.small);
  assert.match(batch.photos[0].photographer_url,/utm_source=outfyt/);
  assert.equal(batch.photos[0].photographer,"Test Photographer");
  assert.doesNotMatch(JSON.stringify(batch),/test-private-key/);
});
test("empty results remain empty; unsafe image and credit URLs are rejected",async () => {
  assert.deepEqual((await searchReferencePhotos("green cargo pants","key",mock({ results:[] }))).photos,[]);
  const unsafe = [
    { ...photo,urls:{ small:"https://attacker.invalid/tracker" } },
    { ...photo,links:{ html:"javascript:alert(1)" } },
    { ...photo,user:{ name:"Bad",links:{ html:"https://unsplash.com.attacker.invalid/" } } },
  ];
  assert.equal((await searchReferencePhotos("pants","key",mock({ results:unsafe }))).photos.length,0);
});
test("missing key, quota and authentication errors stay helpful and never expose provider errors",async () => {
  await assert.rejects(searchReferencePhotos("pants",undefined),/not configured/);
  for (const status of [401,403,429,500]) {
    await assert.rejects(searchReferencePhotos("pants","sensitive",mock({ errors:["sensitive"] },status)),error => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message,/sensitive/);
      assert.match(error.message,/recommendations still work/);
      return true;
    });
  }
  await assert.rejects(searchReferencePhotos("pants","key",mock({},403,{ "x-ratelimit-remaining":"0" })),/allowance/);
});
test("network and malformed responses do not fabricate reference photos",async () => {
  await assert.rejects(searchReferencePhotos("pants","key",async () => { throw new Error("sensitive-key network issue"); }),/unavailable right now/);
  await assert.rejects(searchReferencePhotos("pants","key",mock({ results:null })),/invalid response/);
  await assert.rejects(searchReferencePhotos("pants","key",async () => new Response("not-json")),/invalid response/);
});
