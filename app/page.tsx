"use client";

import { useState } from "react";

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

const BANK = "0x0000000000000000000000000000000000000064";
// Real calldata: standard ERC20 balanceOf(address) — the #1 mistake against Bank.
const PRESET_DATA =
  "0x70a082310000000000000000000000001111111111111111111111111111111111111111";

export default function Home() {
  const [mode, setMode] = useState<"tx" | "call">("call");
  const [network, setNetwork] = useState<"testnet" | "mainnet">("testnet");
  const [hash, setHash] = useState("");
  const [to, setTo] = useState(BANK);
  const [data, setData] = useState(PRESET_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);

  async function analyze() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          mode === "tx" ? { mode, network, hash } : { mode, network, to, data },
        ),
      });
      const body = await res.json();
      if (!res.ok) setError(body.error ?? "Request failed");
      else setResult(body as Analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

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
            <input
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              placeholder="0x… (64 hex)"
            />
          </>
        ) : (
          <>
            <label>To (contract / precompile address)</label>
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x…" />
            <label>Calldata</label>
            <textarea value={data} onChange={(e) => setData(e.target.value)} placeholder="0x…" />
            <button
              className="preset"
              onClick={() => {
                setTo(BANK);
                setData(PRESET_DATA);
              }}
            >
              ↺ Load example: standard ERC20 balanceOf() against the Bank precompile
            </button>
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
                <div className="lbl">Live on-chain revert</div>
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
