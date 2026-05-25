// Core types shared across RevertLens.
//
// Design note (fixes QA issue #5 — hallucination kills trust):
// every Finding carries a `source` so the UI can label what is mechanically
// proven (decoded from a known ABI) versus what an LLM merely inferred.
// We never let an AI guess masquerade as a verified fact.

export type PrecompileName = "bank" | "exchange" | "staking";

export type FindingSource =
  | "verified" // mechanically derived from a known precompile ABI — not a guess
  | "ai-inferred"; // produced by the LLM long-tail path; show with confidence

export type Severity = "error" | "warning" | "info";

/** A single diagnosis about one call. */
export interface Finding {
  severity: Severity;
  /** Stable machine code, e.g. "BANK_ERC20_SIGNATURE_MISMATCH". */
  code: string;
  title: string;
  /** Plain-English explanation of what went wrong and why. */
  detail: string;
  /** Concrete corrected usage, when we know it. */
  suggestedFix?: string;
  source: FindingSource;
  /** 0..1. Verified findings are 1; AI-inferred are whatever the model reports. */
  confidence: number;
}

/** A raw call we are asked to analyse. Only `to` + `data` are required for the
 *  offline static path (fixes QA issue #1 — no network / no revert data needed). */
export interface CallInput {
  /** Destination address (hex). */
  to: string;
  /** Calldata (hex, 0x-prefixed). */
  data: string;
  /** Optional: the on-chain revert reason, if a runtime decode produced one. */
  revertReason?: string;
}

export interface LintResult {
  /** Which precompile the call targets, if any. */
  precompile: PrecompileName | null;
  /** 4-byte selector parsed from calldata. */
  selector: string | null;
  findings: Finding[];
}
