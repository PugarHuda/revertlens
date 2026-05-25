// AI long-tail explainer (QA issue #2 — where the LLM is genuinely load-bearing).
//
// The deterministic linter handles everything we can PROVE (precompile detection,
// ABI mismatch, on-chain "no method" reverts). This module covers the long tail:
// reverts with no verified mapping. It is OPTIONAL and degrades honestly —
// with no ANTHROPIC_API_KEY it returns null (never fabricated output).
//
// We use a raw JSON-schema structured output (not the zod helper) so this module
// stays decoupled from the zod version the MCP server pins.

import Anthropic from "@anthropic-ai/sdk";
import type { Finding } from "../types.js";
import { PRECOMPILE_ABI } from "../precompiles/knowledge-base.js";

// Per the Anthropic SDK guidance, default to the latest Opus.
const MODEL = "claude-opus-4-7";

export function isAIEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Static system prompt built from the verified knowledge base. `cache_control`
// is placed correctly so this caches once it exceeds the model's minimum
// cacheable prefix (4096 tokens on Opus 4.7). Today the KB is small, so it
// won't cache yet — but as the contributable KB grows, caching engages with
// no code change. (Honest: no artificial padding to force a cache hit.)
const SYSTEM_PROMPT = `You are RevertLens, an expert on debugging Injective EVM reverts.

Injective exposes three EVM precompiles with NON-STANDARD ABIs that generic tools (Tenderly, Foundry) cannot decode:
- Bank (0x64): ${PRECOMPILE_ABI.bank.join("; ")}
- Exchange (0x65): ${PRECOMPILE_ABI.exchange.join("; ")}
- Staking (0x66): ${PRECOMPILE_ABI.staking.join("; ")}

Precompile reverts surface from the Cosmos/Go layer, often as "no method with id: 0x<selector>" when an unknown function selector is used.

Given a failed call, explain in plain English WHY it likely reverted and HOW to fix it.
Rules:
- Be specific and actionable. Reference the actual selector / precompile when relevant.
- NEVER fabricate. If you are not confident, say so and return a low confidence.
- confidence is 0.0-1.0: how sure you are this is the real cause.`;

const EXPLANATION_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "One-line summary of the likely cause" },
    detail: { type: "string", description: "Plain-English explanation of why it reverted" },
    suggestedFix: { type: "string", description: "Concrete fix, or empty string if unknown" },
    confidence: { type: "number", description: "0.0-1.0 confidence this is the real cause" },
  },
  required: ["title", "detail", "suggestedFix", "confidence"],
  additionalProperties: false,
} as const;

interface Explanation {
  title: string;
  detail: string;
  suggestedFix: string;
  confidence: number;
}

export interface AIContext {
  to: string;
  data: string;
  precompile: string | null;
  selector: string | null;
  onchainRevert: string | null;
}

/** Ask the LLM to explain a revert we have no verified answer for. Returns a
 *  Finding labelled `ai-inferred`, or null when disabled / on error. */
export async function explainRevertWithAI(ctx: AIContext): Promise<Finding | null> {
  if (!isAIEnabled()) return null;

  const client = new Anthropic();
  const userMsg =
    `Explain this Injective EVM revert:\n` +
    `- to: ${ctx.to}\n` +
    `- target precompile: ${ctx.precompile ?? "none / regular contract"}\n` +
    `- selector: ${ctx.selector ?? "n/a"}\n` +
    `- on-chain revert reason: ${ctx.onchainRevert ?? "(call did not revert or reason unavailable)"}\n` +
    `- calldata: ${ctx.data}`;

  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMsg }],
      output_config: { format: { type: "json_schema", schema: EXPLANATION_SCHEMA } },
    });

    if (res.stop_reason === "refusal") return null;
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return null;

    const out = JSON.parse(block.text) as Explanation;
    return {
      severity: "warning",
      code: "AI_EXPLANATION",
      title: out.title,
      detail: out.detail,
      suggestedFix: out.suggestedFix?.trim() ? out.suggestedFix : undefined,
      source: "ai-inferred",
      confidence: Math.max(0, Math.min(1, out.confidence)),
    };
  } catch {
    // No fake output: if the model call or parse fails, we add no AI finding.
    return null;
  }
}
