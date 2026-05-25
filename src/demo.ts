// Run with: npm run demo
// Shows the side-by-side story: a generic tool sees "execution reverted";
// RevertLens explains exactly why — offline, from calldata alone.

import { encodeFunctionData } from "viem";
import { lint } from "./linter/lint.js";

const BANK = "0x0000000000000000000000000000000000000064";
const HOLDER = "0x1111111111111111111111111111111111111111";
const TOKEN = "0x2222222222222222222222222222222222222222";

const cases: { label: string; to: string; data: string }[] = [
  {
    label: "Dev uses standard ERC20 balanceOf(account) against the Bank precompile",
    to: BANK,
    data: encodeFunctionData({
      abi: [
        { type: "function", name: "balanceOf", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
      ],
      functionName: "balanceOf",
      args: [HOLDER],
    }),
  },
  {
    label: "Dev uses standard ERC20 transfer(to, amount) against the Bank precompile",
    to: BANK,
    data: encodeFunctionData({
      abi: [
        { type: "function", name: "transfer", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
      ],
      functionName: "transfer",
      args: [HOLDER, 1000n],
    }),
  },
  {
    label: "Correct Injective Bank balanceOf(token, account)",
    to: BANK,
    data: encodeFunctionData({
      abi: [
        { type: "function", name: "balanceOf", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
      ],
      functionName: "balanceOf",
      args: [TOKEN, HOLDER],
    }),
  },
];

for (const c of cases) {
  console.log("\n──────────────────────────────────────────────");
  console.log("CASE:", c.label);
  console.log("Generic tool says:  execution reverted");
  const result = lint({ to: c.to, data: c.data });
  for (const f of result.findings) {
    const tag = f.source === "verified" ? "✔ VERIFIED" : `~ AI (conf ${f.confidence})`;
    console.log(`RevertLens says [${f.severity}] [${tag}]: ${f.title}`);
    console.log("  →", f.detail);
    if (f.suggestedFix) console.log("  FIX:", f.suggestedFix);
  }
}
