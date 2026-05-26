# RevertLens — Submission Pack

Everything you need to submit to the **Injective Solo AI Builder Sprint**.
Fill the `<...>` placeholders after you push to GitHub / deploy.

---

## 1. Typeform answers
Submit at: https://xsxo494365r.typeform.com/to/uT6R8vhf

- **Project name:** RevertLens
- **GitHub repository:** https://github.com/PugarHuda/revertlens
- **Demo / product link:** https://revertlens.vercel.app
- **Demo video:** `<youtube/loom link — record using §3>`
- **Short description:**
  > RevertLens is the only debugger that understands Injective EVM precompiles. Generic tools (Tenderly, Foundry) go blind at Injective's Bank/Exchange/Staking precompiles and just say "execution reverted". RevertLens decodes those opaque reverts into plain English with a concrete fix — by reading the non-standard precompile ABIs that no generic tool knows. It runs against the live Injective chain (no mock data), ships as a web playground and an MCP server callable from Claude Code / Cursor, and labels every finding as verified (mechanically proven) or AI-inferred so a guess never masquerades as fact.

---

## 2. X (Twitter) post — copy-paste

> Shipped RevertLens for the Injective Solo AI Builder Sprint 🥷
>
> Every EVM debugger goes blind at Injective's precompiles (0x64/0x65/0x66) and just says "execution reverted". RevertLens decodes WHY — and how to fix it.
>
> • Reads the non-standard Bank/Exchange/Staking ABIs Tenderly & Foundry don't know
> • Runs on the LIVE Injective chain — no mock data
> • Web playground + MCP server for @AnthropicAI Claude Code / Cursor
> • Labels every finding ✔verified vs ~AI-inferred
>
> Code: https://github.com/PugarHuda/revertlens
> Demo: https://revertlens.vercel.app
>
> @injective @NinjaLabsHQ @NinjaLabsCN
> #Injective #AI #Web3

(Attach 1–2 screenshots: the playground showing the Bank `balanceOf` revert decoded with the fix.)

---

## 3. Demo video script (~2.5 min, no fluff)

**0:00–0:20 — The problem.**
"If you build on Injective EVM and call a precompile wrong, you get this:
`execution reverted`. That's it. Tenderly and Foundry can't help — they don't
know Injective's precompiles exist."

**0:20–0:55 — The reveal (LIVE playground at revertlens.vercel.app).**
- Open the deployed site (no localhost — it's live).
- Click the preset chip **"Bank · ERC20 balanceOf (wrong)"** → hit **Analyze**.
- Show the LIVE on-chain revert banner: `no method with id: 0x70a08231`.
- Show the two **✔ VERIFIED** findings + the fix: *"Bank precompile balanceOf takes
  (tokenAddress, account)."*
- Emphasise: this hit the real Injective chain, not a canned response. Then point at
  the address bar — *"shareable link"* — and mention the other preset chips
  (Exchange/Staking) to show breadth.

**0:55–1:30 — Why it's unique.**
- Open `src/precompiles/knowledge-base.ts`. Show the non-standard signatures
  (`transfer(from,to,amount)`, `balanceOf(token,account)`, bech32 validators).
- "These are verified against InjectiveLabs/solidity-contracts. Generic tools are
  blind to them — that's the moat."

**1:30–2:10 — Agent-native (MCP).**
- `npm run mcp:smoke`. Show Claude-Code-style tool call `explain_revert` returning
  the same verified analysis through the MCP protocol.
- "It plugs straight into the AI coding agents Injective's dev stack is built around."

**2:10–2:30 — Trust + close.**
- Point at the ✔ VERIFIED vs ~ AI-inferred labels: "We never let an AI guess
  pretend to be a fact."
- "RevertLens: others say 'execution reverted'. We say exactly why, and how to fix it."

---

## 4. README 3-question checklist (already satisfied in README.md)
- [x] How AI is used — load-bearing only for the long tail; deterministic core labelled verified
- [x] Whether/how Injective is integrated — precompile-ABI-aware, live RPC, verified against InjectiveLabs/solidity-contracts
- [x] What it does & how users interact — paste tx/calldata in the playground, or call the MCP tools

---

## 5. Screenshot deep-links (one-click → the result auto-renders, then screenshot)

These links open the live demo with the case pre-loaded and **auto-run** the
analysis — the revert + fix is on screen the moment it loads. No clicking.

1. **Hero — Bank ERC20 mismatch** (the money shot: revert + ✔VERIFIED fix):
   `https://revertlens.vercel.app/?mode=call&network=testnet&to=0x0000000000000000000000000000000000000064&data=0x70a082310000000000000000000000001111111111111111111111111111111111111111`

2. **Breadth — Exchange precompile, unknown selector**:
   `https://revertlens.vercel.app/?mode=call&network=testnet&to=0x0000000000000000000000000000000000000065&data=0xdeadbeef`

Capture: open link → wait ~1s for "Analyzing on-chain…" to finish → screenshot the
card (revert banner + findings). Do both for 2 distinct images.

---

## 6. X post — 3 variants (pick one; attach the §5 screenshots)

**A — Punchy (hook-first, shortest):**
> Every EVM debugger goes blind at Injective's precompiles. RevertLens doesn't. 🥷
>
> Paste a failed tx → it tells you *exactly* why it reverted, and the fix. Live on-chain, zero mock.
>
> 🔗 https://revertlens.vercel.app · code: https://github.com/PugarHuda/revertlens
> @injective @NinjaLabsHQ @NinjaLabsCN

**B — Problem→solution (default):**
> Shipped RevertLens for the Injective Solo AI Builder Sprint 🥷
>
> Injective's Bank/Exchange/Staking precompiles use non-standard ABIs → Tenderly & Foundry just say "execution reverted". RevertLens decodes WHY + the fix.
>
> • Live chain, no mock • Web + MCP for Claude Code • Findings labelled ✔verified vs ~AI
>
> https://github.com/PugarHuda/revertlens · https://revertlens.vercel.app
> @injective @NinjaLabsHQ @NinjaLabsCN #Injective #AI

**C — Builder/technical:**
> "execution reverted." Useless, right? Especially on Injective's precompiles, which Tenderly & Foundry don't even know exist.
>
> RevertLens reads the real precompile ABIs (verified vs InjectiveLabs/solidity-contracts) and decodes the live revert into a plain-English fix. Web + MCP server.
>
> 🔗 https://revertlens.vercel.app
> @injective @NinjaLabsHQ @NinjaLabsCN
