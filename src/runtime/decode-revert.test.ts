import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeErrorString, decodeRevert } from "./decode-revert.js";

// This is the REAL Error(string) payload returned by Injective testnet for a
// standard ERC20 balanceOf(address) call to the Bank precompile (captured live).
const REAL_DATA =
  "0x08c379a00000000000000000000000000000000000000000000000000000000000000020" +
  "000000000000000000000000000000000000000000000000000000000000001d" +
  "6e6f206d6574686f6420776974682069643a2030783730613038323331000000";

test("decodeErrorString decodes the real on-chain Error(string)", () => {
  assert.equal(decodeErrorString(REAL_DATA), "no method with id: 0x70a08231");
});

test("decodeRevert extracts the missing selector from real data", () => {
  const d = decodeRevert("execution reverted", REAL_DATA);
  assert.equal(d.reason, "no method with id: 0x70a08231");
  assert.equal(d.missingSelector, "0x70a08231");
});

test("decodeRevert falls back to the RPC message when data is absent", () => {
  const d = decodeRevert("execution reverted: no method with id: 0xABCDEF12");
  assert.equal(d.reason, "no method with id: 0xABCDEF12");
  assert.equal(d.missingSelector, "0xabcdef12");
});

test("decodeRevert handles a plain revert with no selector", () => {
  const d = decodeRevert("execution reverted: insufficient funds");
  assert.equal(d.reason, "insufficient funds");
  assert.equal(d.missingSelector, null);
});
