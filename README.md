# RevertLens

[![CI](https://github.com/PugarHuda/revertlens/actions/workflows/ci.yml/badge.svg)](https://github.com/PugarHuda/revertlens/actions/workflows/ci.yml)
&nbsp;[![Live demo](https://img.shields.io/badge/demo-revertlens.vercel.app-00d9a3)](https://revertlens.vercel.app)
&nbsp;![License: MIT](https://img.shields.io/badge/license-MIT-blue)

**The only debugger that understands Injective EVM precompiles.** It decodes the
opaque `execution reverted` errors that Tenderly, Foundry, and generic EVM tools
cannot see — because they don't know that `0x64/0x65/0x66` are precompiles with
**non-standard ABIs**.

> Generic tool: `execution reverted`
> RevertLens: *"You called the Bank precompile with standard ERC20 `balanceOf(address)`. Injective needs `balanceOf(address token, address account)`. Fix: pass the token address first."*

---

## What it does & how you use it

Paste a failed transaction hash **or** raw calldata + target address. RevertLens
tells you, in plain English, **why** it failed and **how to fix it** — with every
diagnosis labelled `✔ verified` (mechanically decoded) or `~ AI-inferred` (with a
confidence score), so you always know what is fact and what is a model's best guess.

```bash
npm install
npm run demo        # see it explain real Bank-precompile mistakes, fully offline
```

Surfaces:
- **Web playground** (hero) — `npm run dev`, paste & explain, no wallet, instant.
- **MCP server** (bonus) — `explain_revert` + `lint_calldata` callable from
  Claude Code / Cursor / iAgent. Wire it in:

```json
{
  "mcpServers": {
    "revertlens": { "command": "npx", "args": ["tsx", "src/mcp/server.ts"] }
  }
}
```

Then ask your agent: *"why did this Injective tx revert? 0x…"* — verified end to
end (`npm run mcp:smoke`).

## How AI is used

AI is **load-bearing only where it adds real value**, never as decoration:
1. **Long-tail reverts** with no known signature — the LLM reasons over the call
   context + ABI to propose the likely cause.
2. **Contextual fix synthesis** — turning a verified mismatch into a fix written
   against *your* code.
3. **Plain-language explanation** in the developer's terms.

Everything mechanically provable (precompile detection, ABI mismatch) is done
**deterministically and labelled `verified`** — so the AI never hides a guess as a
fact. (`src/types.ts` → `FindingSource`.)

The AI explainer is **optional, multi-provider, and degrades honestly**: set
`OPENROUTER_API_KEY` (free models — preferred) or `ANTHROPIC_API_KEY` (see
`.env.example`) to enable it. Without any key, RevertLens still works fully via the
deterministic linter + live on-chain decoding — it just adds no AI-inferred
findings. It never fabricates output. (`src/ai/explain.ts`; OpenRouter default
`openai/gpt-oss-120b:free`, Anthropic `claude-opus-4-7`.)

## How Injective is integrated

RevertLens is **Injective-specific by design**. Its knowledge base
(`src/precompiles/knowledge-base.ts`) is verified against
[`InjectiveLabs/solidity-contracts`](https://github.com/InjectiveLabs/solidity-contracts)
and encodes the real, non-standard precompile ABIs:

| Precompile | Address | Gotcha generic tools miss |
|---|---|---|
| Bank (MultiVM Token Standard) | `0x64` | `transfer(from,to,amount)`, `balanceOf(token,account)` — not ERC20 |
| Exchange | `0x65` | 28 struct-heavy order-book functions |
| Staking | `0x66` | validators are bech32 **strings** (`injvaloper1…`), not addresses |

The **static linter** (`src/linter/lint.ts`) needs no network and no revert data —
it works purely from calldata, so it delivers value regardless of RPC support for
deep tracing. Runtime `eth_call` revert enrichment is an optional upgrade.

## Architecture

```
src/
  types.ts                  # Finding/CallInput; verified-vs-AI labelling
  precompiles/
    knowledge-base.ts       # THE MOAT — verified precompile ABIs + ERC20 confusions
  linter/
    lint.ts                 # offline static linter (no network)
  demo.ts                   # runnable proof
```

## Limitations (honest)
- **Exchange precompile is partially catalogued.** Bank & Staking ABIs are complete;
  the Exchange precompile's 28 functions are partially seeded, so an unknown selector
  there is a low-confidence hint, not a `verified` error. See [CONTRIBUTING](CONTRIBUTING.md).
- **The AI long-tail is best-effort.** Free OpenRouter models are rate-limited and
  bursty; on failure RevertLens stays silent rather than guessing. For reliable AI,
  use your own key. The deterministic linter — the core value — needs no key at all.
- **Nested contract→precompile reverts** depend on the chain propagating the revert
  reason (it does for direct calls on current Injective; deep traces aren't exposed on
  public RPC). The offline static linter covers this case regardless.
- **The public `/api/analyze` has no rate limiting** and runs the AI model only when
  `REVERTLENS_PUBLIC_AI=1`. Fine for a demo; add limits before heavy public use.
- **Default mainnet RPC is the public endpoint**, which Injective's own docs flag as
  heavily rate-limited / not for production. Set `INJECTIVE_MAINNET_RPC` to a dedicated
  endpoint (QuickNode / Thirdweb / your node) for reliable mainnet analysis.

## Roadmap
- Full Exchange precompile ABI coverage (community-contributable knowledge base)
- Staking bech32-vs-address mismatch detection
- A GitHub Action that runs RevertLens on a PR's failing tests
- VS Code inline revert explanations

## Status
MVP, open-source (MIT). The knowledge base is contributable — see
[CONTRIBUTING.md](CONTRIBUTING.md). PRs adding verified precompile/error mappings welcome.
