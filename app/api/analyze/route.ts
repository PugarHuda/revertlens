// Real analysis endpoint. Runs our core against the LIVE Injective RPC.
// No mock data: every result here comes from an actual eth_call / tx fetch.

import { analyzeCall, analyzeTx, type Analysis } from "../../../src/runtime/analyze.js";
import type { Network } from "../../../src/rpc/injective.js";

export const runtime = "nodejs";

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const network: Network = body.network === "mainnet" ? "mainnet" : "testnet";

    let analysis: Analysis;
    if (body.mode === "tx") {
      const hash = String(body.hash ?? "").trim();
      if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
        return json({ error: "Invalid transaction hash (expected 0x + 64 hex)." }, 400);
      }
      analysis = await analyzeTx(network, hash);
    } else {
      const to = String(body.to ?? "").trim();
      const data = String(body.data ?? "").trim();
      if (!/^0x[0-9a-fA-F]{40}$/.test(to)) {
        return json({ error: "Invalid `to` address (expected 0x + 40 hex)." }, 400);
      }
      if (!/^0x[0-9a-fA-F]{8,}$/.test(data)) {
        return json({ error: "Invalid calldata (need at least a 4-byte selector)." }, 400);
      }
      analysis = await analyzeCall({ network, to, data });
    }

    return json(analysis, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
}
