import { test } from "node:test";
import assert from "node:assert/strict";
import { explainRevertWithAI, isAIEnabled } from "./explain.js";

// Locks the "no fake output" contract: with no API key, the AI explainer is
// disabled and returns null — it never invents an explanation.
test("AI explainer is disabled and returns null when no API key is set", async () => {
  const prev = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
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
    if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
  }
});
