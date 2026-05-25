# Contributing to RevertLens

The most valuable contribution is **growing the precompile knowledge base** — the
verified ABI data that lets RevertLens decode Injective reverts no generic tool can.

## Add a precompile ABI mapping

Everything lives in [`src/precompiles/knowledge-base.ts`](src/precompiles/knowledge-base.ts).

1. **Verify against the source.** Every signature must be confirmed against
   [`InjectiveLabs/solidity-contracts`](https://github.com/InjectiveLabs/solidity-contracts)
   (`src/Bank.sol`, `Staking.sol`, `Exchange.sol`). Do **not** add unverified ABIs —
   a wrong signature would make a `verified` finding lie, which defeats the point.

2. **Add the real function signature** to `PRECOMPILE_ABI` for the relevant precompile
   (`bank` `0x64`, `exchange` `0x65`, `staking` `0x66`). The selector is computed
   automatically with `viem`'s `toFunctionSelector`.

3. **For a common "wrong ABI" mistake** (e.g. a standard-ERC20 selector devs send to
   the Bank precompile), add a `ConfusionEntry` to `BANK_ERC20_CONFUSIONS` with the
   `standardSig`, the correct `injectiveSig` (or `undefined` if unsupported), and a `fix`.

4. **Run the checks:**
   ```bash
   npm run typecheck && npm test
   ```
   Then confirm against the live chain (optional, needs no key):
   ```bash
   npm run live
   ```

## Good first issues

- **Catalogue the Exchange precompile** — it has 28 functions; only the most common are
  seeded. Each verified signature added moves an `ai-inferred` hint to a `verified` answer.
- **Staking bech32 detection** — flag when a hex address is passed where a `injvaloper1…`
  string validator is expected.

## Principles

- **Never fabricate.** Deterministic findings are labelled `verified`; only the LLM
  long-tail is `ai-inferred`. Keep that boundary honest.
- **No mock data.** Tests use real revert payloads captured from the chain.
