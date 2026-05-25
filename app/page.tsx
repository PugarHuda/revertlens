"use client";

import { useEffect, useState } from "react";

type Finding = {
  severity: "error" | "warning" | "info";
  code: string;
  title: string;
  detail: string;
  suggestedFix?: string;
  source: "verified" | "ai-inferred";
  confidence: number;
};
type Analysis = {
  precompile: string | null;
  selector: string | null;
  onchainRevert: string | null;
  findings: Finding[];
};
type Mode = "call" | "tx";
type Net = "testnet" | "mainnet";

const BANK = "0x0000000000000000000000000000000000000064";
const EXCHANGE = "0x0000000000000000000000000000000000000065";
const STAKING = "0x0000000000000000000000000000000000000066";

// Real calldata for common mistakes (all hit the live chain).
const PRESETS: { label: string; to: string; data: string }[] = [
  {
    label: "Bank · ERC20 balanceOf (wrong)",
    to: BANK,
    data: "0x70a082310000000000000000000000001111111111111111111111111111111111111111",
  },
  {
    label: "Bank · ERC20 transfer (wrong)",
    to: BANK,
    data:
      "0xa9059cbb" +
      "0000000000000000000000001111111111111111111111111111111111111111" +
      "0000000000000000000000000000000000000000000000000000000000000064",
  },
  { label: "Exchange · unknown selector", to: EXCHANGE, data: "0xdeadbeef" },
  { label: "Staking · unknown selector", to: STAKING, data: "0xdeadbeef" },
];

export default function Home() {
  const [mode, setMode] = useState<Mode>("call");
  const [network, setNetwork] = useState<Net>("testnet");
  const [hash, setHash] = useState("");
  const [to, setTo] = useState(BANK);
  const [data, setData] = useState(PRESETS[0]!.data);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);

  type Payload =
    | { mode: "tx"; network: Net; hash: string }
    | { mode: "call"; network: Net; to: string; data: string };

  function syncUrl(p: Payload) {
    const params = new URLSearchParams();
    params.set("mode", p.mode);
    params.set("network", p.network);
    if (p.mode === "tx") params.set("hash", p.hash);
    else {
      params.set("to", p.to);
      params.set("data", p.data);
    }
    window.history.replaceState(null, "", `?${params.toString()}`);
  }

  async function runAnalyze(p: Payload) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(p),
      });
      const body = await res.json();
      if (!res.ok) setError(body.error ?? "Request failed");
      else {
        setResult(body as Analysis);
        syncUrl(p);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  function analyze() {
    const p: Payload =
      mode === "tx" ? { mode, network, hash } : { mode, network, to, data };
    void runAnalyze(p);
  }

  // Deep-link: prefill from query params and auto-run a shared link.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const m = q.get("mode") === "tx" ? "tx" : q.get("to") || q.get("data") ? "call" : null;
    const net: Net = q.get("network") === "mainnet" ? "mainnet" : "testnet";
    setNetwork(net);
    if (m === "tx" && q.get("hash")) {
      setMode("tx");
      setHash(q.get("hash")!);
      void runAnalyze({ mode: "tx", network: net, hash: q.get("hash")! });
    } else if (m === "call" && q.get("to") && q.get("data")) {
      setMode("call");
      setTo(q.get("to")!);
      setData(q.get("data")!);
      void runAnalyze({ mode: "call", network: net, to: q.get("to")!, data: q.get("data")! });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="wrap">
      <div className="brand">
        <h1>
          Revert<span className="dot">Lens</span>
        </h1>
      </div>
      <p className="tagline">
        The only debugger that understands Injective EVM precompiles. Generic tools say{" "}
        <b>“execution reverted”</b> — RevertLens tells you <b>exactly why</b>, and how to fix it.
        Every call below hits the <b>live Injective chain</b>.
      </p>

      <div className="card">
        <div className="row">
          <div className="seg">
            <button className={mode === "call" ? "on" : ""} onClick={() => setMode("call")}>
              Raw call
            </button>
            <button className={mode === "tx" ? "on" : ""} onClick={() => setMode("tx")}>
              Transaction hash
            </button>
          </div>
          <div className="seg">
            <button className={network === "testnet" ? "on" : ""} onClick={() => setNetwork("testnet")}>
              Testnet
            </button>
            <button className={network === "mainnet" ? "on" : ""} onClick={() => setNetwork("mainnet")}>
              Mainnet
            </button>
          </div>
        </div>

        {mode === "tx" ? (
          <>
            <label>Transaction hash</label>
            <input value={hash} onChange={(e) => setHash(e.target.value)} placeholder="0x… (64 hex)" />
          </>
        ) : (
          <>
            <label>To (contract / precompile address)</label>
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x…" />
            <label>Calldata</label>
            <textarea value={data} onChange={(e) => setData(e.target.value)} placeholder="0x…" />
            <div className="presets">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  className="chip"
                  onClick={() => {
                    setTo(p.to);
                    setData(p.data);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </>
        )}

        <button className="btn" onClick={analyze} disabled={loading}>
          {loading ? "Analyzing on-chain…" : "Analyze"}
        </button>

        {error && <p className="err">⚠ {error}</p>}

        {result && (
          <>
            {result.onchainRevert && (
              <div className="revert">
                <div className="lbl">Live on-chain revert · generic tools stop here</div>
                <code>{result.onchainRevert}</code>
              </div>
            )}
            {result.findings.length === 0 && (
              <p className="empty">
                No precompile-specific issue found for this call.
                {result.precompile === null && " (Target is not an Injective precompile.)"}
              </p>
            )}
            {result.findings.map((f, i) => (
              <div key={i} className={`finding ${f.severity}`}>
                <div className="badges">
                  <span className="badge sev">{f.severity}</span>
                  {f.source === "verified" ? (
                    <span className="badge verified">✔ VERIFIED</span>
                  ) : (
                    <span className="badge ai">~ AI · conf {f.confidence}</span>
                  )}
                </div>
                <h3>{f.title}</h3>
                <p>{f.detail}</p>
                {f.suggestedFix && (
                  <div className="fix">
                    <b>Fix:</b> {f.suggestedFix}
                  </div>
                )}
              </div>
            ))}
            {result && !loading && (
              <p className="share">🔗 Shareable link updated in your address bar.</p>
            )}
          </>
        )}
      </div>

      <footer>
        Injective precompiles: <code>0x64</code> Bank · <code>0x65</code> Exchange ·{" "}
        <code>0x66</code> Staking. Knowledge base verified against{" "}
        <code>InjectiveLabs/solidity-contracts</code>. No mock data — results come from live{" "}
        <code>eth_call</code> on Injective {network}.
      </footer>
    </main>
  );
}
