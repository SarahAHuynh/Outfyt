import { test } from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
import { clothingSchema, clothingAnalysisSchema, imageMetadataError, imageExtension, MAX_IMAGE_BYTES, type Clothing, type WardrobeItem } from "../lib/wardrobe/schema";
import { createWardrobeItem, requireOwnedItem, type NewItemDependencies } from "../lib/wardrobe/service";
import { analyzeClothingWithClient } from "../lib/ai/clothing-core";
import { readBoundedBytes, readSmallJson } from "../lib/wardrobe/body";

const clothing: Clothing = { name: "Black cardigan", category: "Tops", subcategory: "Cardigan", primary_color: "Black", secondary_colors: [], style_tags: ["Minimalist"], season_tags: ["Fall"], description: "A black cardigan." };
const row: WardrobeItem = { ...clothing, id: "00000000-0000-4000-8000-000000000001", user_id: "owner", image_path: null, created_at: "2026-11-05T12:00:00Z", updated_at: "2026-11-05T12:00:00Z" };
const image = { bytes: new Uint8Array([255, 216, 255, 224]), mime: "image/jpeg", extension: "jpg" };

test("body limits reject oversized payloads even without a Content-Length header", async () => {
  const request = new Request("https://outfyt.test/api/wardrobe", { method: "POST", body: new Uint8Array(50) });
  assert.equal(request.headers.has("content-length"), false);
  await assert.rejects(readBoundedBytes(request, 40), /too large/);
});
test("malformed item JSON returns a useful validation error", async () => {
  const request = new Request("https://outfyt.test/api/wardrobe", { method: "POST", body: "{broken" });
  await assert.rejects(readSmallJson(request), /could not be read/);
});

test("clothing schemas reject unknown categories and oversized AI attributes", () => {
  assert.equal(clothingSchema.safeParse({ ...clothing, category: "Invented" }).success, false);
  assert.equal(clothingAnalysisSchema.safeParse({ ...clothing, is_clothing: true, name: "a".repeat(101) }).success, false);
  assert.equal(clothingAnalysisSchema.safeParse({ ...clothing, is_clothing: true }).success, true);
});
test("upload validation rejects empty, oversized, HEIC, SVG and forged MIME files", () => {
  for (const file of [{ size: 0, type: "image/png" }, { size: MAX_IMAGE_BYTES + 1, type: "image/jpeg" }, { size: 10, type: "image/heic" }, { size: 10, type: "image/svg+xml" }]) assert.ok(imageMetadataError(file));
  assert.equal(imageMetadataError({ size: MAX_IMAGE_BYTES, type: "image/jpeg" }), null);
  assert.equal(imageExtension(image.bytes, "image/jpeg"), "jpg");
  assert.equal(imageExtension(new TextEncoder().encode("<svg>not a photo</svg>"), "image/jpeg"), null);
});
test("ownership checks reject missing and cross-user clothing", () => {
  assert.throws(() => requireOwnedItem(null, "owner"), /unavailable/);
  assert.throws(() => requireOwnedItem(row, "other-user"), /unavailable/);
  assert.equal(requireOwnedItem(row, "owner"), row);
});

function dependencies(overrides: Partial<NewItemDependencies> = {}) {
  const calls: string[] = [];
  const deps: NewItemDependencies = {
    find: async () => null,
    upload: async path => { calls.push(`upload:${path}`); },
    insert: async input => { calls.push("insert"); return { ...row, ...input }; },
    removeImage: async path => { calls.push(`remove:${path}`); },
    ...overrides,
  };
  return { calls, deps };
}
test("successful save uploads a private owner-prefixed path and persists editable details", async () => {
  const { calls, deps } = dependencies();
  const result = await createWardrobeItem("owner", row.id, { ...clothing, name: "My corrected name" }, image, deps);
  assert.equal(result.item.name, "My corrected name");
  assert.equal(result.item.image_path, `owner/${row.id}.jpg`);
  assert.deepEqual(calls, [`upload:owner/${row.id}.jpg`, "insert"]);
});
test("manual entry without an image persists without touching storage", async () => {
  const { calls, deps } = dependencies();
  const result = await createWardrobeItem("owner", row.id, clothing, null, deps);
  assert.equal(result.item.image_path, null);
  assert.deepEqual(calls, ["insert"]);
});
test("duplicate create returns the existing item without another mutation", async () => {
  const { calls, deps } = dependencies({ find: async () => row });
  const result = await createWardrobeItem("owner", row.id, clothing, image, deps);
  assert.equal(result.alreadySaved, true);
  assert.deepEqual(calls, []);
});
test("failed database save removes its uploaded image and reports failure", async () => {
  const { calls, deps } = dependencies({ insert: async () => { throw Error("database failed"); } });
  await assert.rejects(createWardrobeItem("owner", row.id, clothing, image, deps), /Could not save/);
  assert.deepEqual(calls, [`upload:owner/${row.id}.jpg`, `remove:owner/${row.id}.jpg`]);
});
test("lost database response does not delete the image of a committed item", async () => {
  let reads = 0;
  const { calls, deps } = dependencies({ find: async () => ++reads === 1 ? null : row, insert: async () => { throw Error("connection lost after commit"); } });
  const result = await createWardrobeItem("owner", row.id, clothing, image, deps);
  assert.equal(result.alreadySaved, true);
  assert.equal(calls.some(value => value.startsWith("remove:")), false);
});
test("failed storage upload never starts a database mutation", async () => {
  const { calls, deps } = dependencies({ upload: async () => { throw Error("storage failed"); } });
  await assert.rejects(createWardrobeItem("owner", row.id, clothing, image, deps), /storage failed/);
  assert.deepEqual(calls, []);
});

function fakeClient(output: unknown, status = 200, inspect?: (body: Record<string, unknown>) => void) {
  return new OpenAI({ apiKey: "test-key-not-real", maxRetries: 0, fetch: async (_url, init) => {
    inspect?.(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify(status === 200 ? {
      id: "resp_mock", object: "response", created_at: 1, status: "completed", model: "gpt-5.4-mini",
      output: [{ type: "message", id: "msg_mock", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(output), annotations: [] }] }],
    } : { error: { message: "mock provider error", type: "rate_limit_error" } }), { status, headers: { "Content-Type": "application/json" } });
  } });
}
test("Responses API vision request uses structured output and returns real parsed attributes", async () => {
  let called = false;
  const result = await analyzeClothingWithClient(image, { apiKey: "test-key-not-real" }, fakeClient({ ...clothing, is_clothing: true }, 200, body => {
    called = true;
    assert.equal(body.store, false);
    const input = body.input as Array<{ content: Array<{ type: string; image_url?: string }> }>;
    assert.ok(input[0].content.some(part => part.type === "input_image" && part.image_url?.startsWith("data:image/jpeg;base64,")));
    assert.equal((body.text as { format: { type: string } }).format.type, "json_schema");
  }));
  assert.equal(called, true);
  assert.deepEqual(result, clothing);
});
test("missing API credentials provide manual-entry fallback without calling the provider", async () => {
  await assert.rejects(analyzeClothingWithClient(image, {}), /not configured/);
});
test("non-clothing and invalid provider output are not presented as valid suggestions", async () => {
  await assert.rejects(analyzeClothingWithClient(image, { apiKey: "test" }, fakeClient({ ...clothing, is_clothing: false })), /No clothing/);
  await assert.rejects(analyzeClothingWithClient(image, { apiKey: "test" }, fakeClient({ ...clothing, is_clothing: true, category: "Invented" })), /unavailable|reliably/);
});
test("OpenAI rate limits and authentication failures have safe, useful errors", async () => {
  await assert.rejects(analyzeClothingWithClient(image, { apiKey: "test" }, fakeClient({}, 429)), /rate or billing limit/);
  await assert.rejects(analyzeClothingWithClient(image, { apiKey: "test" }, fakeClient({}, 401)), /key or model access/);
});
