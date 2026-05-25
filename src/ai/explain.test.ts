import { test } from "node:test";
import assert from "node:assert/strict";
import { explainRevertWithAI, isAIEnabled, extractJson } from "./explain.js";

test("extractJson parses a bare JSON object", () => {
  const o = extractJson('{"title":"a","detail":"b","suggestedFix":"","confidence":0.5}');
  assert.equal(o?.title, "a");
  assert.equal(o?.confidence, 0.5);
});

test("extractJson parses JSON inside ```json fences surrounded by prose", () => {
  const o = extractJson('Sure!\n```json\n{"title":"x","detail":"y","suggestedFix":"z","confidence":1}\n```\nDone.');
  assert.equal(o?.detail, "y");
});

test("extractJson returns null on non-JSON garbage", () => {
  assert.equal(extractJson("there is no json here"), null);
});

// Locks the "no fake output" contract: with no API key, the AI explainer is
// disabled and returns null — it never invents an explanation.
test("AI explainer is disabled and returns null when no API key is set", async () => {
  const prevAnthropic = process.env.ANTHROPIC_API_KEY;
  const prevOpenRouter = process.env.OPENROUTER_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    assert.equal(isAIEnabled(), false);
    const result = await explainRevertWithAI({
      to: "0x0000000000000000000000000000000000000064",
      data: "0xdeadbeef",
      precompile: "bank",
      selector: "0xdeadbeef",
      onchainRevert: "no method with id: 0xdeadbeef",
    });
    assert.equal(result, null);
  } finally {
    if (prevAnthropic !== undefined) process.env.ANTHROPIC_API_KEY = prevAnthropic;
    if (prevOpenRouter !== undefined) process.env.OPENROUTER_API_KEY = prevOpenRouter;
  }
});
