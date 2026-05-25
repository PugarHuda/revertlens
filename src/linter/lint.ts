// Static calldata linter — the core that makes RevertLens robust.
//
// QA issue #1 (CRITICAL): runtime precompile-revert decoding is version-
// dependent (cosmos/evm PR#224). This path needs NO network and NO revert
// data — it reasons purely from the calldata + the verified precompile ABI.
// So RevertLens delivers value even if eth_call returns an opaque revert.

import { toFunctionSelector } from "viem";
import type { CallInput, Finding, LintResult, PrecompileName } from "../types.js";
import {
  BANK_ERC20_CONFUSIONS,
  PRECOMPILE_ABI,
  PRECOMPILE_ADDRESSES,
} from "../precompiles/knowledge-base.js";

function normalizeAddress(addr: string): string {
  return addr.trim().toLowerCase();
}

/** Precompute the valid selector set for each precompile from its real ABI. */
const VALID_SELECTORS: Record<PrecompileName, Set<string>> = Object.fromEntries(
  (Object.keys(PRECOMPILE_ABI) as PrecompileName[]).map((name) => [
    name,
    new Set(
      PRECOMPILE_ABI[name].map((sig) =>
        toFunctionSelector(`function ${sig}`).toLowerCase(),
      ),
    ),
  ]),
) as Record<PrecompileName, Set<string>>;

export function lint(call: CallInput): LintResult {
  const to = normalizeAddress(call.to);
  const precompile = PRECOMPILE_ADDRESSES[to] ?? null;
  const selector =
    call.data && call.data.length >= 10 ? call.data.slice(0, 10).toLowerCase() : null;

  const findings: Finding[] = [];

  // Not a precompile call -> RevertLens has no special insight here; the AI
  // long-tail path (separate module) handles generic reverts.
  if (!precompile || !selector) {
    return { precompile, selector, findings };
  }

  // Case A: selector is a real function on this precompile -> all good.
  if (VALID_SELECTORS[precompile].has(selector)) {
    findings.push({
      severity: "info",
      code: "PRECOMPILE_CALL_OK",
      title: `Valid ${precompile} precompile call`,
      detail: `Selector ${selector} matches a known ${precompile} precompile function.`,
      source: "verified",
      confidence: 1,
    });
    return { precompile, selector, findings };
  }

  // Case B (THE MOAT): a standard-ERC20 selector aimed at the Bank precompile.
  // This is the #1 cause of opaque reverts that no generic tool explains.
  if (precompile === "bank" && selector in BANK_ERC20_CONFUSIONS) {
    const c = BANK_ERC20_CONFUSIONS[selector]!;
    findings.push({
      severity: "error",
      code: "BANK_ERC20_SIGNATURE_MISMATCH",
      title: `Standard ERC20 \`${c.standardSig}\` is not the Bank precompile ABI`,
      detail:
        `You called the Bank precompile (0x64) with the standard ERC20 selector ` +
        `for \`${c.standardSig}\`. Injective's Bank precompile uses a different, ` +
        `non-standard signature` +
        (c.injectiveSig ? ` (\`${c.injectiveSig}\`)` : ` and does not implement this at all`) +
        `, so the EVM reverts with an opaque "execution reverted".`,
      suggestedFix: c.fix,
      source: "verified",
      confidence: 1,
    });
    return { precompile, selector, findings };
  }

  // Case C (long-tail): unknown selector on a precompile. We don't have a
  // verified answer. How aggressively we flag this is a real product decision
  // — see classifyUnknownSelector below.
  findings.push(classifyUnknownSelector(precompile, selector, call));
  return { precompile, selector, findings };
}

/**
 * Precompiles whose ABI we have enumerated COMPLETELY from
 * InjectiveLabs/solidity-contracts (Bank.sol, Staking.sol). For these, "not a
 * known selector" is a verifiable fact: the precompile genuinely has no such
 * method. The Exchange precompile (28 struct-heavy functions) is only partially
 * seeded, so an unknown selector there is not conclusive.
 */
const FULLY_KNOWN: ReadonlySet<PrecompileName> = new Set(["bank", "staking"]);

/**
 * Decide what to say when a call hits a precompile with a selector we don't
 * recognise. Trade-off: flag too eagerly → false positives; too cautiously →
 * missed bugs. We resolve it by precompile completeness:
 *
 *   - Bank/Staking (ABI fully known) → a verifiable "no such method" error.
 *   - Exchange (ABI partially seeded) → a low-confidence hint we defer to the
 *     AI long-tail / human, since the selector may be a real function we
 *     haven't catalogued yet.
 */
export function classifyUnknownSelector(
  precompile: PrecompileName,
  selector: string,
  _call: CallInput,
): Finding {
  if (FULLY_KNOWN.has(precompile)) {
    return {
      severity: "error",
      code: "PRECOMPILE_UNKNOWN_SELECTOR",
      title: `Selector ${selector} is not a function on the ${precompile} precompile`,
      detail:
        `The ${precompile} precompile's ABI is fully known, and ${selector} is ` +
        `not one of its functions. A call with this selector will revert with ` +
        `"no method with id: ${selector}".`,
      suggestedFix: `Check the ${precompile} precompile ABI — you are likely using a wrong or standard-ERC20 signature.`,
      source: "verified",
      confidence: 1,
    };
  }

  // Exchange: only partially catalogued — don't over-claim.
  return {
    severity: "warning",
    code: "PRECOMPILE_UNKNOWN_SELECTOR",
    title: `Unrecognised selector ${selector} on the ${precompile} precompile`,
    detail:
      `${selector} is not in RevertLens's (partial) ${precompile} ABI. It may be ` +
      `a valid function we haven't catalogued yet, or a genuine mismatch. ` +
      `If your call reverted, this is the likely cause.`,
    source: "ai-inferred",
    confidence: 0.4,
  };
}
