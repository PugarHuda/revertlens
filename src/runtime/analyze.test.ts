import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeCall, type AnalyzeDeps } from "./analyze.js";
import type { Finding } from "../types.js";

const BANK = "0x0000000000000000000000000000000000000064";
const EXCHANGE = "0x0000000000000000000000000000000000000065";
// Standard ERC20 balanceOf(address) sent to the Bank precompile (the #1 mistake).
const BAL = "0x70a082310000000000000000000000001111111111111111111111111111111111111111";

const reverts =
  (message: string): NonNullable<AnalyzeDeps["ethCall"]> =>
  async () => ({ ok: false, error: { code: 3, message } });

const aiOn = () => true;
const aiOff = () => false;

test("bank ERC20 mismatch → verified findings, AI is NOT consulted", async () => {
  let aiCalled = false;
  const a = await analyzeCall(
    { network: "testnet", to: BANK, data: BAL },
    {
      ethCall: reverts("execution reverted: no method with id: 0x70a08231"),
      aiEnabled: aiOn,
      explain: async () => {
        aiCalled = true;
        return null;
      },
    },
  );
  assert.equal(aiCalled, false, "AI must not run when a verified fix already exists");
  assert.ok(
    a.findings.some((f) => f.code === "BANK_ERC20_SIGNATURE_MISMATCH" && f.source === "verified"),
  );
  assert.ok(a.findings.some((f) => f.code === "ONCHAIN_NO_METHOD"));
  assert.equal(a.onchainRevert, "no method with id: 0x70a08231");
});

test("exchange unknown selector → AI long-tail consulted and appended", async () => {
  const fake: Finding = {
    severity: "warning",
    code: "AI_EXPLANATION",
    title: "x",
    detail: "y",
    source: "ai-inferred",
    confidence: 0.7,
  };
  let aiCalls = 0;
  const a = await analyzeCall(
    { network: "testnet", to: EXCHANGE, data: "0xdeadbeef" },
    {
      ethCall: reverts("execution reverted: no method with id: 0xdeadbeef"),
      aiEnabled: aiOn,
      explain: async () => {
        aiCalls++;
        return fake;
      },
    },
  );
  assert.equal(aiCalls, 1);
  assert.ok(a.findings.some((f) => f.code === "AI_EXPLANATION"));
});

test("useAI=false disables the AI long-tail", async () => {
  let aiCalled = false;
  await analyzeCall(
    { network: "testnet", to: EXCHANGE, data: "0xdeadbeef", useAI: false },
    {
      ethCall: reverts("execution reverted: no method with id: 0xdeadbeef"),
      aiEnabled: aiOn,
      explain: async () => {
        aiCalled = true;
        return null;
      },
    },
  );
  assert.equal(aiCalled, false);
});

test("aiEnabled=false disables the AI long-tail", async () => {
  let aiCalled = false;
  await analyzeCall(
    { network: "testnet", to: EXCHANGE, data: "0xdeadbeef" },
    {
      ethCall: reverts("execution reverted: no method with id: 0xdeadbeef"),
      aiEnabled: aiOff,
      explain: async () => {
        aiCalled = true;
        return null;
      },
    },
  );
  assert.equal(aiCalled, false);
});
