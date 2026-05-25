#!/usr/bin/env node
// RevertLens MCP server — exposes the debugger as tools an AI coding agent
// (Claude Code, Cursor, iAgent) can call. Aligns with Injective's AI-native
// dev stack. Run: `npm run mcp` (stdio transport).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { analyzeCall, analyzeTx, type Analysis } from "../runtime/analyze.js";
import { lint } from "../linter/lint.js";

const server = new McpServer({ name: "revertlens", version: "0.1.0" });

function formatAnalysis(a: Analysis): string {
  const lines: string[] = [];
  lines.push(`precompile: ${a.precompile ?? "none"}  selector: ${a.selector ?? "n/a"}`);
  if (a.onchainRevert) lines.push(`live on-chain revert: ${a.onchainRevert}`);
  if (a.findings.length === 0) lines.push("No precompile-specific issue found.");
  for (const f of a.findings) {
    const tag = f.source === "verified" ? "VERIFIED" : `AI-inferred (conf ${f.confidence})`;
    lines.push(`\n[${f.severity.toUpperCase()}] [${tag}] ${f.title}`);
    lines.push(`  ${f.detail}`);
    if (f.suggestedFix) lines.push(`  FIX: ${f.suggestedFix}`);
  }
  return lines.join("\n");
}

server.registerTool(
  "explain_revert",
  {
    title: "Explain an Injective EVM revert",
    description:
      "Analyze a failed Injective EVM call or transaction and explain the precompile revert " +
      "in plain English with a concrete fix. Calls the LIVE Injective chain. Provide either " +
      "`txHash`, or `to` + `data`.",
    inputSchema: {
      network: z.enum(["mainnet", "testnet"]).default("testnet"),
      txHash: z.string().optional().describe("0x-prefixed transaction hash to analyze"),
      to: z.string().optional().describe("Target address (use with `data` if no txHash)"),
      data: z.string().optional().describe("Calldata hex (use with `to` if no txHash)"),
    },
  },
  async ({ network, txHash, to, data }) => {
    let analysis: Analysis;
    if (txHash) {
      analysis = await analyzeTx(network, txHash);
    } else if (to && data) {
      analysis = await analyzeCall({ network, to, data });
    } else {
      return {
        isError: true,
        content: [{ type: "text", text: "Provide either `txHash`, or both `to` and `data`." }],
      };
    }
    return { content: [{ type: "text", text: formatAnalysis(analysis) }] };
  },
);

server.registerTool(
  "lint_calldata",
  {
    title: "Lint Injective precompile calldata (offline)",
    description:
      "Statically check calldata sent to an Injective precompile (0x64 Bank / 0x65 Exchange / " +
      "0x66 Staking) for non-standard-ABI mismatches. No network required.",
    inputSchema: {
      to: z.string().describe("Target address"),
      data: z.string().describe("Calldata hex"),
    },
  },
  async ({ to, data }) => {
    const result = lint({ to, data });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
