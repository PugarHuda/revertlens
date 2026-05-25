import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeFunctionData } from "viem";
import { lint } from "./lint.js";

const BANK = "0x0000000000000000000000000000000000000064";
const ADDR = "0x1111111111111111111111111111111111111111";

function call(name: string, inputs: { type: string }[], args: unknown[]): string {
  return encodeFunctionData({
    abi: [{ type: "function", name, inputs, outputs: [], stateMutability: "view" }],
    functionName: name,
    args,
  });
}

test("flags standard ERC20 balanceOf(address) sent to the Bank precompile", () => {
  const data = call("balanceOf", [{ type: "address" }], [ADDR]);
  const r = lint({ to: BANK, data });
  const f = r.findings[0]!;
  assert.equal(f.code, "BANK_ERC20_SIGNATURE_MISMATCH");
  assert.equal(f.severity, "error");
  assert.equal(f.source, "verified");
  assert.ok(f.suggestedFix);
});

test("accepts the correct Injective Bank balanceOf(token, account)", () => {
  const data = call("balanceOf", [{ type: "address" }, { type: "address" }], [ADDR, ADDR]);
  const r = lint({ to: BANK, data });
  assert.equal(r.findings[0]!.code, "PRECOMPILE_CALL_OK");
});

test("returns no special findings for a non-precompile address", () => {
  const data = call("balanceOf", [{ type: "address" }], [ADDR]);
  const r = lint({ to: ADDR, data });
  assert.equal(r.precompile, null);
  assert.equal(r.findings.length, 0);
});

test("flags an unknown selector on a precompile", () => {
  const r = lint({ to: BANK, data: "0xdeadbeef" });
  assert.equal(r.findings[0]!.code, "PRECOMPILE_UNKNOWN_SELECTOR");
});
