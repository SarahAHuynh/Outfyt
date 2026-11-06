import { test } from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
import { runAgentLoop, safeToolError, type AgentDependencies } from "../lib/stylist/loop";
import { parseToolCall, sanitizeToolArguments, stylistTools } from "../lib/stylist/tools";
import { validateOutfitItems, type OutfitDetails } from "../lib/stylist/schema";
import { generateOwnedOutfits } from "../lib/stylist/generation";
import type { WardrobeItem } from "../lib/wardrobe/schema";

const top = "11111111-1111-4111-8111-111111111111";
const bottom = "22222222-2222-4222-8222-222222222222";
const shoes = "33333333-3333-4333-8333-333333333333";
const foreign = "44444444-4444-4444-8444-444444444444";
const candidateId = "55555555-5555-4555-8555-555555555555";
const wardrobe = [
  { id:top,category:"Tops",name:"Black cardigan" },{ id:bottom,category:"Bottoms",name:"White skirt" },{ id:shoes,category:"Shoes",name:"Black flats" },
].map(piece => ({ ...piece,user_id:"owner",subcategory:"",primary_color:"Black",secondary_colors:[],style_tags:[],season_tags:[],description:"",image_path:null,created_at:"2026-11-05T00:00:00Z",updated_at:"2026-11-05T00:00:00Z" })) as WardrobeItem[];
const outfit:OutfitDetails = { name:"Casual dinner",occasion:"Dinner",aesthetic:"Minimalist",description:"Cardigan, skirt and flats.",explanation:"A simple coordinated look.",item_ids:[top,bottom,shoes] };

function call(name:string,args:unknown,id="call_1") { return { type:"function_call",name,arguments:JSON.stringify(args),call_id:id,id:`fc_${id}` }; }
function message(text:string) { return { type:"message",id:"msg_1",role:"assistant",status:"completed",content:[{ type:"output_text",text,annotations:[] }] }; }
function mockedClient(outputs:unknown[][],inspect?:(body:Record<string,unknown>,index:number) => void) {
  let index = 0;
  return new OpenAI({ apiKey:"test-key-not-real",maxRetries:0,fetch:async (_url,init) => {
    inspect?.(JSON.parse(String(init?.body)),index);
    const output = outputs[index++] || [message("Done.")];
    return new Response(JSON.stringify({ id:`resp_${index}`,object:"response",created_at:1,model:"gpt-5.4-mini",status:"completed",output }),{ headers:{ "Content-Type":"application/json" } });
  } });
}
function dependencies(overrides:Partial<AgentDependencies> = {}) {
  const logs:Array<{ name:string;status:string;args:Record<string,unknown>;error?:string }> = [];
  const executed:string[] = [];
  let nextId = 0;
  const deps:AgentDependencies = {
    id:() => `log-${++nextId}`,stage:() => {},
    log:async (_id,name,args,status,error) => { logs.push({ name,args,status,error }); },
    execute:async name => { executed.push(name); return { status:"completed",data:{ items:wardrobe } }; },
    ...overrides,
  };
  return { logs,executed,deps };
}

test("all registry tools use strict function schemas and nullable optional fields", () => {
  assert.equal(stylistTools.length,13);
  for (const tool of stylistTools) {
    assert.equal(tool.strict,true);
    assert.equal(tool.parameters?.additionalProperties,false);
    assert.equal((tool.parameters?.required as string[]).length,Object.keys(tool.parameters?.properties || {}).length);
  }
});
test("unknown tools, invalid JSON, oversized arguments and invented fields are rejected", () => {
  assert.throws(() => parseToolCall("run_shell_command",'{}'),/not allowed/);
  assert.throws(() => parseToolCall("get_saved_outfits",'{broken'));
  assert.throws(() => parseToolCall("get_saved_outfits","x".repeat(17000)),/too large/);
  assert.throws(() => parseToolCall("get_saved_outfits",JSON.stringify({ user_id:"someone-else" })));
});
test("sanitized logs retain IDs and counts but never descriptions or secrets", () => {
  const safe = sanitizeToolArguments({ id:top,attributes:{ description:"private image content",password:"not-for-logs" },restrictions:["private styling note"] });
  assert.equal(safe.id,top);
  assert.equal(safe.restrictions_count,1);
  assert.doesNotMatch(JSON.stringify(safe),/private image content|not-for-logs|private styling note/);
});
test("outfit validation rejects invented/missing/duplicate IDs and incomplete looks", () => {
  assert.throws(() => validateOutfitItems([top,bottom,foreign],wardrobe),/missing or unowned/);
  assert.throws(() => validateOutfitItems([top,bottom,shoes,shoes],wardrobe),/same piece twice/);
  assert.throws(() => validateOutfitItems([top,bottom],wardrobe),/needs shoes/);
  assert.throws(() => validateOutfitItems([top,shoes],wardrobe),/top and bottom/);
});
test("outfits enforce required and excluded owned item IDs", () => {
  assert.doesNotThrow(() => validateOutfitItems(outfit.item_ids,wardrobe,[top],[]));
  assert.throws(() => validateOutfitItems(outfit.item_ids,wardrobe,[],[bottom]),/excluded/);
  assert.throws(() => validateOutfitItems(outfit.item_ids,wardrobe,[foreign]),/required/);
});
test("tool loop returns actual tool results and preserves reasoning before continuing", async () => {
  const { deps,logs,executed } = dependencies();
  const reasoning = { type:"reasoning",id:"rs_1",summary:[],encrypted_content:"opaque-encrypted-reasoning" };
  const client = mockedClient([[reasoning,call("get_wardrobe",{ category:null,color:null,search:null })],[message("I found your actual pieces.")]],(body,index) => {
    assert.equal(body.store,false);
    assert.equal(body.parallel_tool_calls,false);
    if (index === 1) {
      const input = body.input as Array<{ type?:string;encrypted_content?:string;call_id?:string;output?:string }>;
      assert.ok(input.some(item => item.encrypted_content === reasoning.encrypted_content));
      const result = input.find(item => item.type === "function_call_output");
      assert.equal(result?.call_id,"call_1");
      assert.equal(JSON.parse(result!.output!).status,"completed");
    }
  });
  assert.equal(await runAgentLoop(client,"gpt-5.4-mini",[{ role:"user",content:"Show my closet" }],deps),"I found your actual pieces.");
  assert.deepEqual(executed,["get_wardrobe"]);
  assert.deepEqual(logs.map(log => log.status),["pending","completed"]);
});
test("a real multi-step tool loop generates and saves a candidate selected by ID", async () => {
  const actions:string[] = [];
  const { deps } = dependencies({ execute:async (name,args) => {
    actions.push(name);
    if (name === "generate_outfits") return { status:"completed",data:{ candidates:[{ ...outfit,id:candidateId }] } };
    assert.equal(name,"save_outfit"); assert.equal(args.candidate_id,candidateId);
    return { status:"completed",data:{ id:candidateId,name:outfit.name } };
  } });
  const client = mockedClient([
    [call("generate_outfits",{ occasion:"Dinner",aesthetic:"Minimalist",restrictions:[],required_item_ids:[top],excluded_item_ids:[],count:1 },"generate")],
    [call("save_outfit",{ candidate_id:candidateId },"save")],[message("Saved Casual dinner to your lookbook.")],
  ]);
  await runAgentLoop(client,"gpt-5.4-mini",[{ role:"user",content:"Create and save a dinner outfit" }],deps);
  assert.deepEqual(actions,["generate_outfits","save_outfit"]);
});
test("destructive calls return awaiting confirmation and do not imply approval", async () => {
  const { deps,logs } = dependencies({ execute:async () => ({ status:"awaiting_confirmation",token:candidateId }) });
  const client = mockedClient([[call("delete_outfit",{ id:candidateId })],[message("Review the deletion card before approving.")]],(body,index) => {
    if (index === 1) assert.match(JSON.stringify(body.input),/awaiting_confirmation/);
  });
  await runAgentLoop(client,"gpt-5.4-mini",[{ role:"user",content:"Delete my outfit" }],deps);
  assert.deepEqual(logs.map(log => log.status),["pending","awaiting_confirmation"]);
});
test("invalid tool calls are logged and never executed", async () => {
  const { deps,logs,executed } = dependencies();
  await runAgentLoop(mockedClient([[call("run_shell_command",{ command:"delete everything" })],[message("That action is unavailable.")]]),"gpt-5.4-mini",[],deps);
  assert.equal(executed.length,0); assert.equal(logs[0].name,"rejected_tool"); assert.equal(logs[0].status,"failed");
});
test("pending-log failure prevents the operation", async () => {
  let executed = false;
  const { deps } = dependencies({ log:async () => { throw Error("log unavailable"); },execute:async () => { executed = true; return { status:"completed" }; } });
  await assert.rejects(runAgentLoop(mockedClient([[call("get_saved_outfits",{})]]),"gpt-5.4-mini",[],deps),/log unavailable/);
  assert.equal(executed,false);
});
test("post-mutation log failure stops reasoning and cannot trigger a repeated write", async () => {
  let writes = 0,requests = 0;
  const { deps } = dependencies({ log:async (_id,_name,_args,status) => { if (status === "completed") throw Error("log response lost"); },execute:async () => { writes++; return { status:"completed" }; } });
  const client = mockedClient([[call("save_outfit",{ candidate_id:candidateId })]],() => { requests++; });
  await assert.rejects(runAgentLoop(client,"gpt-5.4-mini",[],deps),/log response lost/);
  assert.equal(writes,1); assert.equal(requests,1);
});
test("repeated reasoning is bounded by the server step limit", async () => {
  const { deps } = dependencies();
  await assert.rejects(runAgentLoop(mockedClient(Array.from({ length:9 },() => [call("get_saved_outfits",{})])),"gpt-5.4-mini",[],deps),/step limit/);
});
test("structured outfit generation validates model IDs before any persistence", async () => {
  const request = { occasion:"Dinner",aesthetic:"",restrictions:[],required_item_ids:[],excluded_item_ids:[],count:1 };
  const result = await generateOwnedOutfits(mockedClient([[message(JSON.stringify({ outfits:[outfit],limitations:[] }))]]),"gpt-5.4-mini",wardrobe,null,request);
  assert.deepEqual(result.outfits[0].item_ids,outfit.item_ids);
  await assert.rejects(generateOwnedOutfits(mockedClient([[message(JSON.stringify({ outfits:[{ ...outfit,item_ids:[top,bottom,foreign] }],limitations:[] }))]]),"gpt-5.4-mini",wardrobe,null,request),/missing or unowned/);
});
test("limited wardrobes yield limitations without fabricated outfits", async () => {
  const result = await generateOwnedOutfits(mockedClient([[message(JSON.stringify({ outfits:[],limitations:["Add shoes and a bottom."] }))]]),"gpt-5.4-mini",wardrobe.slice(0,1),null,{ occasion:"Dinner",aesthetic:"",restrictions:[],required_item_ids:[],excluded_item_ids:[],count:3 });
  assert.equal(result.outfits.length,0); assert.ok(result.limitations.length);
});
test("provider authentication errors cannot leak keys into tool outputs or action logs", () => {
  const error = new OpenAI.AuthenticationError(401,{ message:"Incorrect API key sk-test-sensitive" },"Incorrect API key sk-test-sensitive",new Headers());
  assert.doesNotMatch(safeToolError(error),/sk-test-sensitive/);
});
