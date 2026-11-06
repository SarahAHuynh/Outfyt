import OpenAI from "openai";
import { ZodError } from "zod";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { STYLIST_PROMPT } from "@/lib/prompts/stylist";
import { parseToolCall, sanitizeToolArguments, stylistTools, type ToolName } from "./tools";

export type ToolResult = { status: "completed" | "awaiting_confirmation" | "failed"; [key: string]: unknown };
export type AgentDependencies = {
  execute: (name: ToolName, args: Record<string, unknown>, logId: string) => Promise<ToolResult>;
  log: (id: string, name: string, args: Record<string, unknown>, status: string, error?: string) => Promise<void>;
  id: () => string;
  stage: (name: string) => void;
};

export async function runAgentLoop(client: OpenAI, model: string, initialInput: ResponseInputItem[], dependencies: AgentDependencies) {
  const input: ResponseInputItem[] = [...initialInput];
  let callCount = 0;
  const deadline = Date.now() + 150_000;
  for (let step = 0; step < 8; step++) {
    if (Date.now() > deadline) throw new Error("The stylist reached its time limit. Check action history for any completed changes before trying again.");
    dependencies.stage("Reasoning about your styling request...");
    const response = await client.responses.create({
      model, instructions: STYLIST_PROMPT, input, tools: stylistTools,
      parallel_tool_calls: false, store: false, include: ["reasoning.encrypted_content"], max_output_tokens: 3000,
      ...(model.startsWith("gpt-5") ? { reasoning: { effort: "low" as const } } : {}),
    });
    if (response.status !== "completed") throw new Error("The AI response was incomplete. Check action history before retrying any changes.");
    // Preserve all response items (including encrypted reasoning), then pair
    // each actual function call with its output before the next reasoning step.
    input.push(...response.output as ResponseInputItem[]);
    const calls = response.output.filter(item => item.type === "function_call");
    if (!calls.length) return response.output_text?.trim() || "I could not produce a reply. Your action history shows any operations that completed.";
    for (const call of calls) {
      if (++callCount > 12) throw new Error("The stylist reached its tool-call limit. Check action history before trying again.");
      const logId = dependencies.id();
      let parsed: ReturnType<typeof parseToolCall>;
      try {
        parsed = parseToolCall(call.name, call.arguments);
      } catch (error) {
        const message = safeToolError(error);
        await dependencies.log(logId, Object.hasOwn(stylistToolsByName, call.name) ? call.name : "rejected_tool", {}, "failed", message);
        input.push({ type:"function_call_output",call_id:call.call_id,output:JSON.stringify({ status:"failed",error:message }) });
        continue;
      }
      const safeArgs = sanitizeToolArguments(parsed.arguments);
      // Stop if logging fails: the model must not retry a committed mutation.
      await dependencies.log(logId,parsed.name,safeArgs,"pending");
      dependencies.stage(parsed.name);
      let result:ToolResult;
      try { result = await dependencies.execute(parsed.name,parsed.arguments,logId); }
      catch(error) { result = { status:"failed",error:safeToolError(error) }; }
      await dependencies.log(logId,parsed.name,safeArgs,result.status,typeof result.error === "string" ? result.error : undefined);
      input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) });
    }
  }
  throw new Error("The stylist reached its step limit. Check action history for completed changes and pending approvals before continuing.");
}

const stylistToolsByName = Object.fromEntries(stylistTools.map(tool => [tool.name, true]));

export function safeToolError(error:unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError) return "The tool arguments or model output were invalid. Retrieve current facts and use the required schema.";
  if (error instanceof OpenAI.APIError) return error.status === 429 ? "The AI service reached a rate or billing limit. No generated suggestions were saved." : "The AI service failed. Check the server's API configuration or try again later.";
  return error instanceof Error ? error.message.slice(0,400) : "The action failed. Check action history before retrying.";
}
