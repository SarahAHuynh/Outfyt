import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readSavedOutfits } from "../lib/stylist/outfits";

const outfit = { id:"look-1",name:"Saved look",is_favorite:true,updated_at:"2026-11-06T00:00:00Z",occasion:null,aesthetic:null,description:null };

function client(options:{ empty?:boolean; outfitError?:boolean; linksError?:boolean } = {}) {
  const calls:string[] = [];
  const mock = {
    from(table:string) {
      calls.push(table);
      const chain = {
        select(columns:string) { assert.equal(columns.includes("("),false,"do not request ambiguous embedded relations"); return chain; },
        eq(column:string,value:string) { assert.equal(column,"user_id"); assert.equal(value,"owner"); return chain; },
        order() { return chain; },
        async limit() { return { data:options.empty ? [] : [outfit],error:options.outfitError ? { code:"PGRST201" } : null }; },
        async in(column:string,ids:string[]) {
          assert.equal(column,"outfit_id"); assert.deepEqual(ids,["look-1"]);
          return { data:[{ outfit_id:"look-1",wardrobe_item_id:"shoe",position:2 },{ outfit_id:"look-1",wardrobe_item_id:"top",position:0 },{ outfit_id:"look-1",wardrobe_item_id:"bottom",position:1 }],error:options.linksError ? { code:"network" } : null };
        },
      };
      return chain;
    },
  };
  return { mock:mock as unknown as Pick<SupabaseClient,"from">,calls };
}

test("lookbook loads saved combinations with owner-scoped non-embedded queries",async () => {
  const { mock,calls } = client();
  const result = await readSavedOutfits(mock,"owner");
  assert.deepEqual(calls,["outfits","outfit_items"]);
  assert.deepEqual(result[0].item_ids,["top","bottom","shoe"]);
  assert.equal(result[0].is_favorite,true); assert.equal(result[0].occasion,"");
});
test("empty lookbooks do not query relationships",async () => {
  const { mock,calls } = client({ empty:true });
  assert.deepEqual(await readSavedOutfits(mock,"owner"),[]); assert.deepEqual(calls,["outfits"]);
});
test("database failures do not pretend the lookbook is empty or saved successfully",async () => {
  await assert.rejects(readSavedOutfits(client({ outfitError:true }).mock,"owner"),/Could not load your saved looks/);
  await assert.rejects(readSavedOutfits(client({ linksError:true }).mock,"owner"),/looks exist/);
});
