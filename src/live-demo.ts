// Run with: npm run live
// Hits the REAL Injective testnet (no mocks). Shows the full story:
// static lint + the actual on-chain revert, decoded and explained.

import { encodeFunctionData } from "viem";
import { analyzeCall } from "./runtime/analyze.js";

const BANK = "0x0000000000000000000000000000000000000064";
const HOLDER = "0x1111111111111111111111111111111111111111";

const data = encodeFunctionData({
  abi: [
    { type: "function", name: "balanceOf", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  ],
  functionName: "balanceOf",
  args: [HOLDER],
});

console.log("Calling Bank precompile (0x64) with standard ERC20 balanceOf(account)…");
console.log("Calldata:", data, "\n");

const analysis = await analyzeCall({ network: "testnet", to: BANK, data });

console.log("On-chain revert (REAL):", analysis.onchainRevert ?? "(did not revert)");
console.log("Precompile:", analysis.precompile, "| selector:", analysis.selector, "\n");

for (const f of analysis.findings) {
  const tag = f.source === "verified" ? "✔ VERIFIED" : `~ AI (conf ${f.confidence})`;
  console.log(`[${f.severity}] [${tag}] ${f.title}`);
  console.log("  →", f.detail);
  if (f.suggestedFix) console.log("  FIX:", f.suggestedFix);
  console.log();
}
