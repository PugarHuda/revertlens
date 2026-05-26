// Real Injective EVM RPC access. No mocks — these are the live endpoints
// (verified reachable: mainnet chainId 0x6f0=1776, testnet 0x59f=1439).

export type Network = "mainnet" | "testnet";

// Public endpoints by default. Injective's own docs warn the public mainnet
// RPC is heavily rate-limited and not for production — so allow overriding with
// a dedicated endpoint (QuickNode / Thirdweb / your own node) via env.
export const RPC_URLS: Record<Network, string> = {
  mainnet: process.env.INJECTIVE_MAINNET_RPC || "https://sentry.evm-rpc.injective.network/",
  testnet: process.env.INJECTIVE_TESTNET_RPC || "https://k8s.testnet.json-rpc.injective.network/",
};

export interface RpcError {
  code: number;
  message: string;
  /** ABI-encoded revert data, when present (e.g. Error(string)). */
  data?: string;
}

export type EthCallOutcome =
  | { ok: true; result: string }
  | { ok: false; error: RpcError };

const RPC_TIMEOUT_MS = 20_000;

function isRpcError(v: unknown): v is RpcError {
  return typeof v === "object" && v !== null && "code" in v && "message" in v;
}

/**
 * Single JSON-RPC call with a hard timeout. Always resolves: HTTP errors,
 * non-JSON bodies, aborts, and network failures are returned as an RpcError
 * rather than thrown — so callers (and the serverless function) never hang or
 * crash on a flaky upstream. `T` may legitimately be `null` (e.g. a tx that
 * does not exist), which is distinct from an RpcError.
 */
async function rpc<T>(network: Network, method: string, params: unknown[]): Promise<T | RpcError> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS);
  try {
    const res = await fetch(RPC_URLS[network], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: ctrl.signal,
    });
    if (!res.ok) return { code: res.status, message: `RPC HTTP ${res.status} (${method})` };
    const json = (await res.json()) as { result?: T; error?: RpcError };
    if (json.error) return json.error;
    return json.result as T;
  } catch (e) {
    const message = e instanceof Error ? e.message : `RPC request failed (${method})`;
    return { code: -1, message };
  } finally {
    clearTimeout(timer);
  }
}

/** Simulate a call against the live chain and capture the real revert, if any. */
export async function ethCall(
  network: Network,
  to: string,
  data: string,
): Promise<EthCallOutcome> {
  const out = await rpc<string>(network, "eth_call", [{ to, data }, "latest"]);
  if (typeof out === "string") return { ok: true, result: out };
  if (isRpcError(out)) return { ok: false, error: out };
  return { ok: false, error: { code: -1, message: "Unexpected RPC response" } };
}

/** Fetch a real transaction's calldata + target by hash. `null` = not found. */
export async function getTransaction(
  network: Network,
  hash: string,
): Promise<{ to: string | null; input: string } | null | RpcError> {
  return rpc<{ to: string | null; input: string } | null>(
    network,
    "eth_getTransactionByHash",
    [hash],
  );
}
