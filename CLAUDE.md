# RevertLens — Project Memory

## What this is
An Injective EVM precompile-aware revert debugger. Submission for the **Injective
Solo AI Builder Sprint** (HackQuest, deadline ~31 May 2026). Unique point: it
explains the opaque `execution reverted` errors caused by Injective's non-standard
precompile ABIs (`0x64` Bank, `0x65` Exchange, `0x66` Staking) — which Tenderly,
Foundry, and generic EVM tools cannot decode.

## Stack
- TypeScript (ESM, Node 22), `viem` for ABI/selector work.
- Hero surface: **web playground built** — Next.js 15 App Router (`app/`), real
  RPC-backed via `app/api/analyze/route.ts`. Bonus: MCP server (planned).
- `next.config.mjs` sets `resolve.extensionAlias` so webpack resolves our core's
  `.js` import specifiers to `.ts`. Do not remove it or the app build breaks.

## Run
```bash
npm install
npm run dev         # the web playground (hero) — live RPC, no mock
npm run live        # CLI: full analysis against live testnet
npm run demo        # offline static-linter proof
npm test            # 8 unit tests (use real captured chain data)
npm run typecheck && npm run build
```

## Architecture & conventions
- `src/precompiles/knowledge-base.ts` — **the moat**. Every signature is verified
  against github.com/InjectiveLabs/solidity-contracts. Do not add unverified ABIs.
- `src/linter/lint.ts` — **offline static linter**. MUST stay network-free; this is
  what guarantees value even when RPC revert tracing is unavailable
  (cosmos/evm PR#224 risk). Runtime `eth_call` decoding is a separate optional layer.
- `src/types.ts` — every `Finding` MUST set `source: 'verified' | 'ai-inferred'`.
  Never let an AI-inferred result be presented as verified.
- AI is load-bearing ONLY for: long-tail unknown selectors, contextual fix
  synthesis, plain-language phrasing. Deterministic logic is not "AI".
- `src/ai/explain.ts` — optional Anthropic call (model `claude-opus-4-7`, raw
  JSON-schema structured output; NOT the zod helper, to avoid clashing with the
  zod v3 the MCP server pins). Gated on `ANTHROPIC_API_KEY`; returns null when
  absent or on error. NEVER emit fabricated output here.

## Key facts
- Injective EVM mainnet chainID `1776`; testnet `1439`. Explorer: Blockscout.
- Bank precompile is the "MultiVM Token Standard" — not a separate product.
- Standard ERC20 selectors devs wrongly send to Bank: see `BANK_ERC20_CONFUSIONS`.

## Heuristics
`classifyUnknownSelector()` in `lint.ts` — unknown selectors on Bank/Staking
(fully-known ABIs) are a `verified` error; on Exchange (partially seeded) they
are a low-confidence `ai-inferred` hint. Tune `FULLY_KNOWN` if the Exchange ABI
gets fully catalogued.
