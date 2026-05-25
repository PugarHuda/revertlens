// Real Injective EVM RPC access. No mocks — these are the live endpoints
// (verified reachable: mainnet chainId 0x6f0=1776, testnet 0x59f=1439).

export type Network = "mainnet" | "testnet";

export const RPC_URLS: Record<Network, string> = {
  mainnet: "https://sentry.evm-rpc.injective.network/",
  testnet: "https://k8s.testnet.json-rpc.injective.network/",
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

async function rpc<T>(network: Network, method: string, params: unknown[]): Promise<T | RpcError> {
  const res = await fetch(RPC_URLS[network], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: T; error?: RpcError };
  if (json.error) return json.error;
  return json.result as T;
}

/** Simulate a call against the live chain and capture the real revert, if any. */
export async function ethCall(
  network: Network,
  to: string,
  data: string,
): Promise<EthCallOutcome> {
  const out = await rpc<string>(network, "eth_call", [{ to, data }, "latest"]);
  if (typeof out === "string") return { ok: true, result: out };
  return { ok: false, error: out };
}

/** Fetch a real transaction's calldata + target by hash. */
export async function getTransaction(
  network: Network,
  hash: string,
): Promise<{ to: string | null; input: string } | RpcError> {
  const out = await rpc<{ to: string | null; input: string }>(network, "eth_getTransactionByHash", [hash]);
  return out;
}
