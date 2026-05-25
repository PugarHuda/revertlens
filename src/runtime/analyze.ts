// End-to-end analysis: static lint (offline) + a REAL eth_call against the live
// chain to capture the actual revert. No mocks — if the chain reverts, we read
// its real reason and explain it.

import type { Finding, LintResult } from "../types.js";
import { lint } from "../linter/lint.js";
import { ethCall, getTransaction, type Network } from "../rpc/injective.js";
import { decodeRevert } from "./decode-revert.js";
import { BANK_ERC20_CONFUSIONS, PRECOMPILE_ADDRESSES } from "../precompiles/knowledge-base.js";
import { explainRevertWithAI, isAIEnabled } from "../ai/explain.js";

export interface AnalysisInput {
  network: Network;
  to: string;
  data: string;
  /** Use the AI long-tail explainer when no verified answer is found. Default true. */
  useAI?: boolean;
}

export interface Analysis extends LintResult {
  /** The real revert reason returned by the chain, if the call reverted. */
  onchainRevert: string | null;
}

/** Analyse a raw call: static findings + a live simulation of the same call. */
export async function analyzeCall(input: AnalysisInput): Promise<Analysis> {
  const staticResult = lint({ to: input.to, data: input.data });
  const findings: Finding[] = [...staticResult.findings];
  let onchainRevert: string | null = null;

  const outcome = await ethCall(input.network, input.to, input.data);
  if (!outcome.ok) {
    const decoded = decodeRevert(outcome.error.message, outcome.error.data);
    onchainRevert = decoded.reason;

    // The chain named a missing selector. This is a VERIFIED fact (it came from
    // the live node), and if we recognise the selector we can also explain it.
    if (decoded.missingSelector) {
      const precompile = PRECOMPILE_ADDRESSES[input.to.toLowerCase()];
      const confusion =
        precompile === "bank" ? BANK_ERC20_CONFUSIONS[decoded.missingSelector] : undefined;

      findings.push({
        severity: "error",
        code: "ONCHAIN_NO_METHOD",
        title: `Chain confirmed: no method ${decoded.missingSelector} on this precompile`,
        detail: confusion
          ? `The live chain reverted with "${decoded.reason}". That selector is standard ERC20 \`${confusion.standardSig}\`, which the Injective precompile does not implement.`
          : `The live chain reverted with "${decoded.reason}".`,
        suggestedFix: confusion?.fix,
        source: "verified",
        confidence: 1,
      });
    }
  }

  // AI long-tail: only when we have NO verified explanation and there is
  // something to explain. The deterministic path always wins when it fires.
  const hasVerifiedExplanation = findings.some(
    (f) => f.source === "verified" && f.suggestedFix,
  );
  const shouldAskAI = (input.useAI ?? true) && isAIEnabled() && !hasVerifiedExplanation;
  if (shouldAskAI && (onchainRevert || staticResult.precompile)) {
    const ai = await explainRevertWithAI({
      to: input.to,
      data: input.data,
      precompile: staticResult.precompile,
      selector: staticResult.selector,
      onchainRevert,
    });
    if (ai) findings.push(ai);
  }

  return { ...staticResult, findings: dedupe(findings), onchainRevert };
}

/** Analyse an existing transaction by hash (fetches its real calldata first). */
export async function analyzeTx(
  network: Network,
  hash: string,
  useAI = true,
): Promise<Analysis> {
  const tx = await getTransaction(network, hash);
  if (tx === null) throw new Error("Transaction not found on this network.");
  if ("code" in tx) throw new Error(`RPC error fetching tx: ${tx.message}`);
  if (!tx.to) throw new Error("Transaction has no `to` (contract creation) — unsupported.");
  return analyzeCall({ network, to: tx.to, data: tx.input, useAI });
}

function dedupe(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    if (seen.has(f.code)) return false;
    seen.add(f.code);
    return true;
  });
}
