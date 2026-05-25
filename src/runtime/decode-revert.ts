// Decode a real on-chain revert into something we can reason about.
// Empirically grounded: Injective precompiles revert with a standard
// Error(string) (selector 0x08c379a0), and for an unknown selector the message
// is literally "no method with id: 0x<selector>" — which we extract verbatim.

import { decodeAbiParameters } from "viem";

const ERROR_STRING_SELECTOR = "0x08c379a0";
const NO_METHOD_RE = /no method with id:\s*(0x[0-9a-fA-F]{8})/i;

export interface DecodedRevert {
  /** Human revert string, e.g. "no method with id: 0x70a08231". */
  reason: string | null;
  /** If the precompile rejected an unknown selector, the selector it named. */
  missingSelector: string | null;
}

/** Decode an Error(string) payload (the 0x08c379a0 ABI encoding). */
export function decodeErrorString(data: string | undefined): string | null {
  if (!data || !data.toLowerCase().startsWith(ERROR_STRING_SELECTOR)) return null;
  try {
    const [reason] = decodeAbiParameters([{ type: "string" }], `0x${data.slice(10)}`);
    return reason as string;
  } catch {
    return null;
  }
}

/** Turn an RPC error (message + optional data) into a structured revert. */
export function decodeRevert(message: string, data?: string): DecodedRevert {
  // Prefer the ABI-decoded data; fall back to the RPC message text.
  const reason = decodeErrorString(data) ?? stripPrefix(message);
  const missing = reason ? NO_METHOD_RE.exec(reason)?.[1] ?? null : null;
  return { reason, missingSelector: missing ? missing.toLowerCase() : null };
}

function stripPrefix(message: string): string {
  return message.replace(/^execution reverted:\s*/i, "").trim();
}
