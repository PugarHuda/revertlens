// AI long-tail explainer (QA issue #2 — where the LLM is genuinely load-bearing).
//
// The deterministic linter handles everything we can PROVE (precompile detection,
// ABI mismatch, on-chain "no method" reverts). This module covers the long tail:
// reverts with no verified mapping. It is OPTIONAL and degrades honestly —
// with no API key it returns null (never fabricated output).
//
// Multi-provider: prefers OpenRouter (free models) when OPENROUTER_API_KEY is
// set, falls back to Anthropic when ANTHROPIC_API_KEY is set.

import Anthropic from "@anthropic-ai/sdk";
import type { Finding } from "../types.js";
import { PRECOMPILE_ABI } from "../precompiles/knowledge-base.js";

const ANTHROPIC_MODEL = "claude-opus-4-7";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free";

export function isAIEnabled(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY);
}

// Static system prompt built from the verified knowledge base. For the Anthropic
// path, `cache_control` caches it once it exceeds the model minimum (4096 tokens
// on Opus 4.7) — today the KB is small so it won't cache yet, but caching engages
// as the KB grows with no code change. (No artificial padding to force a hit.)
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

function buildUserMessage(ctx: AIContext): string {
  return (
    `Explain this Injective EVM revert:\n` +
    `- to: ${ctx.to}\n` +
    `- target precompile: ${ctx.precompile ?? "none / regular contract"}\n` +
    `- selector: ${ctx.selector ?? "n/a"}\n` +
    `- on-chain revert reason: ${ctx.onchainRevert ?? "(call did not revert or reason unavailable)"}\n` +
    `- calldata: ${ctx.data}`
  );
}

function toFinding(out: Explanation): Finding {
  return {
    severity: "warning",
    code: "AI_EXPLANATION",
    title: out.title,
    detail: out.detail,
    suggestedFix: out.suggestedFix?.trim() ? out.suggestedFix : undefined,
    source: "ai-inferred",
    confidence: Math.max(0, Math.min(1, Number(out.confidence) || 0)),
  };
}

/** Defensively pull a JSON object out of model text (handles ```json fences / prose). */
export function extractJson(text: string): Explanation | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Explanation;
  } catch {
    return null;
  }
}

/** Reject malformed/partial model output — title + detail must be real strings. */
function finalizeExplanation(out: Explanation | null): Finding | null {
  if (!out || typeof out.title !== "string" || typeof out.detail !== "string") return null;
  if (!out.title.trim() || !out.detail.trim()) return null;
  return toFinding(out);
}

/** Ask the LLM to explain a revert we have no verified answer for. Returns a
 *  Finding labelled `ai-inferred`, or null when disabled / on error. */
export async function explainRevertWithAI(ctx: AIContext): Promise<Finding | null> {
  const userMsg = buildUserMessage(ctx);
  try {
    if (process.env.OPENROUTER_API_KEY) {
      return await viaOpenRouter(userMsg);
    }
    if (process.env.ANTHROPIC_API_KEY) {
      return await viaAnthropic(userMsg);
    }
    return null;
  } catch {
    // No fake output: if the model call or parse fails, we add no AI finding.
    return null;
  }
}

async function viaOpenRouter(userMsg: string): Promise<Finding | null> {
  const body = JSON.stringify({
    model: OPENROUTER_MODEL,
    max_tokens: 1500,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          userMsg +
          `\n\nRespond with ONLY a JSON object: {"title": string, "detail": string, "suggestedFix": string, "confidence": number}.`,
      },
    ],
    response_format: { type: "json_object" },
  });

  // One retry on rate-limit / upstream error — free models are bursty.
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "X-Title": "RevertLens",
        },
        body,
        signal: ctrl.signal,
      });
      if (res.ok) {
        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const content = json.choices?.[0]?.message?.content;
        return content ? finalizeExplanation(extractJson(content)) : null;
      }
      if (attempt === 0 && (res.status === 429 || res.status >= 500)) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      return null;
    } catch {
      return null; // timeout / network — no fake output
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

async function viaAnthropic(userMsg: string): Promise<Finding | null> {
  const client = new Anthropic();
  const res = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2048,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMsg }],
    output_config: { format: { type: "json_schema", schema: EXPLANATION_SCHEMA } },
  });
  if (res.stop_reason === "refusal") return null;
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return null;
  return finalizeExplanation(extractJson(block.text));
}
