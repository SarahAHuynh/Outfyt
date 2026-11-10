import { test } from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
import { EMPTY_PROFILE,analysisRequestSchema,mergeStyleSuggestion,pinterestSchema,profileSchema } from "../lib/style/schema";
import { analyzeStyleImages } from "../lib/style/analysis";
import { saveInspirationUpload } from "../lib/style/upload";
import { generateOwnedOutfits } from "../lib/stylist/generation";

const suggestion={ aesthetic_tags:["Minimalist","Vintage"],preferred_colors:["navy","Cream"],favorite_clothing_types:["Jeans"],disliked_styles:[],style_summary:"Relaxed denim and soft neutral layers." };
function clientWith(result:unknown,inspect?:(body:Record<string,unknown>)=>void,status="completed") {
  return new OpenAI({ apiKey:"test-not-real",maxRetries:0,fetch:async(_url,init)=>{
    inspect?.(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ id:"resp_test",object:"response",created_at:1,model:"gpt-5.4-mini",status,output:[{ type:"message",id:"msg_test",role:"assistant",status:"completed",content:[{ type:"output_text",text:JSON.stringify(result),annotations:[] }] }] }),{ headers:{ "Content-Type":"application/json" } });
  } });
}
test("style suggestions add choices without replacing manual preferences, notes or dislikes",()=>{
  const current={ ...EMPTY_PROFILE,aesthetic_tags:["Tomboy"],preferred_colors:["Navy"],disliked_styles:["Vintage"],comfort_preferences:"Flat shoes",notes:"Keep my cardigan",style_summary:"My own summary" };
  const merged=mergeStyleSuggestion(current,suggestion);
  assert.deepEqual(merged.aesthetic_tags,["Tomboy","Minimalist"]);
  assert.deepEqual(merged.preferred_colors,["Navy","Cream"]);
  assert.equal(merged.style_summary,"My own summary");assert.equal(merged.comfort_preferences,"Flat shoes");assert.equal(merged.notes,"Keep my cardigan");
  assert.deepEqual(merged.disliked_styles,["Vintage"]);
  assert.deepEqual(current.preferred_colors,["Navy"]);
});
test("style suggestion merging respects field limits and only fills an empty summary",()=>{
  const current={ ...EMPTY_PROFILE,aesthetic_tags:Array.from({ length:12 },(_,i)=>`Style ${i}`) };
  const merged=mergeStyleSuggestion(current,suggestion);
  assert.deepEqual(merged.aesthetic_tags,current.aesthetic_tags);assert.equal(merged.style_summary,suggestion.style_summary);
  assert.throws(()=>profileSchema.parse({ ...EMPTY_PROFILE,notes:"x".repeat(1001) }));
  assert.throws(()=>analysisRequestSchema.parse({ image_ids:[] }));
  const id="11111111-1111-4111-8111-111111111111";
  assert.throws(()=>analysisRequestSchema.parse({ image_ids:[id,id] }));
});
test("Pinterest accepts board bookmarks, strips tracking, rejects pins and remote URLs",()=>{
  assert.equal(pinterestSchema.parse("https://pinterest.com/sarah/fall-style/?tracking=1"),"https://www.pinterest.com/sarah/fall-style/");
  for (const value of ["http://pinterest.com/a/b/","https://pinterest.com/pin/123/","https://pinterest.com.attacker.invalid/a/b/","https://attacker.invalid/a/b/","https://user:pass@pinterest.com/a/b/","https://pinterest.com/a/"]) assert.equal(pinterestSchema.safeParse(value).success,false,value);
});
test("combined vision analysis sends selected image bytes with structured output and no profile mutation",async()=>{
  let called=false;
  const result=await analyzeStyleImages(clientWith({ is_fashion:true,proposal:suggestion },body=>{
    called=true;assert.equal(body.store,false);
    assert.match(JSON.stringify(body.text),/inspiration_analysis/);
    const content=(body.input as {content:{type:string;image_url?:string}[]}[])[0].content;
    assert.equal(content.filter(item=>item.type==="input_image").length,2);
    assert.match(content[1].image_url!,/^data:image\/jpeg;base64,/);
    assert.match(String(body.instructions),/untrusted/);
  }),"gpt-5.4-mini",[{ bytes:new Uint8Array([1]),mime:"image/jpeg" },{ bytes:new Uint8Array([2]),mime:"image/png" }]);
  assert.ok(called);assert.deepEqual(result,suggestion);
});
test("nonfashion and incomplete inspiration responses do not become usable suggestions",async()=>{
  const image=[{ bytes:new Uint8Array([1]),mime:"image/jpeg" }];
  await assert.rejects(analyzeStyleImages(clientWith({ is_fashion:false,proposal:suggestion }),"gpt-5.4-mini",image),/No clear fashion/);
  await assert.rejects(analyzeStyleImages(clientWith({ is_fashion:true,proposal:suggestion },undefined,"incomplete"),"gpt-5.4-mini",image),/incomplete/);
  await assert.rejects(analyzeStyleImages(clientWith({}),"gpt-5.4-mini",[]),/one to five/);
});
test("outfit generation receives saved comfort and styling notes as grounding",async()=>{
  let seen=false;
  await generateOwnedOutfits(clientWith({ outfits:[],limitations:["Add a bottom and shoes."] },body=>{
    const input=JSON.parse((body.input as {content:string}[])[0].content);
    assert.equal(input.style_profile.comfort_preferences,"Flat shoes");assert.equal(input.style_profile.notes,"Walk to class");seen=true;
  }),"gpt-5.4-mini",[],{ ...EMPTY_PROFILE,comfort_preferences:"Flat shoes",notes:"Walk to class" },{ occasion:"School",aesthetic:"",restrictions:[],required_item_ids:[],excluded_item_ids:[],count:1 });
  assert.ok(seen);
});
const image={ bytes:new Uint8Array([1]),mime:"image/jpeg",extension:"jpg" };
test("inspiration uploads are idempotent and use owner-prefixed paths",async()=>{
  let saved:{ id:string;user_id:string;image_path:string } | null=null;let uploads=0;
  const deps={ find:async()=>saved,upload:async(path:string)=>{ assert.equal(path,"owner/image.jpg");uploads++; },register:async(path:string)=>saved={ id:"image",user_id:"owner",image_path:path },remove:async()=>{ throw Error("Should not clean committed data"); } };
  await saveInspirationUpload("owner","image","Fall",image,deps);
  assert.equal((await saveInspirationUpload("owner","image","Fall",image,deps)).alreadySaved,true);assert.equal(uploads,1);
});
test("failed inspiration registration cleans storage only after proving no record exists",async()=>{
  let removed=false;
  await assert.rejects(saveInspirationUpload("owner","image","Fall",image,{ find:async()=>null,upload:async()=>{},register:async()=>{ throw Error("DB failed"); },remove:async()=>{ removed=true; } }),/could not be saved/);
  assert.ok(removed);
});
test("lost inspiration database response keeps committed image; uncertain reads never delete it",async()=>{
  let reads=0;let removed=false;
  const deps={ find:async()=>++reads===1 ? null : { id:"image",user_id:"owner",image_path:"owner/image.jpg" },upload:async()=>{},register:async()=>{ throw Error("response lost"); },remove:async()=>{ removed=true; } };
  assert.equal((await saveInspirationUpload("owner","image","Fall",image,deps)).alreadySaved,true);assert.equal(removed,false);
  reads=0;
  await assert.rejects(saveInspirationUpload("owner","image","Fall",image,{ ...deps,find:async()=>{ if (++reads===1) return null;throw Error("unavailable"); } }),/uncertain/);
  assert.equal(removed,false);
});
