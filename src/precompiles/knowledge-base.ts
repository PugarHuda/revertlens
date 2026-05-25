// Injective EVM precompile knowledge base.
//
// THIS FILE IS THE MOAT. Every signature here is verified against
// github.com/InjectiveLabs/solidity-contracts (src/Bank.sol, Staking.sol,
// Exchange.sol). Generic EVM tools (Tenderly, Foundry, evm-mcp) are blind to
// these because Injective precompiles use NON-STANDARD ABIs and live at the
// reserved addresses 0x64/0x65/0x66.
//
// Honesty note (QA issue #6): the "MultiVM Token Standard" is not a separate
// product — it IS the Bank precompile (docs/erc20_multivm_token_standard.md).

import type { PrecompileName } from "../types.js";

export const PRECOMPILE_ADDRESSES: Record<string, PrecompileName> = {
  "0x0000000000000000000000000000000000000064": "bank",
  "0x0000000000000000000000000000000000000065": "exchange",
  "0x0000000000000000000000000000000000000066": "staking",
};

/** The REAL function signatures each precompile actually implements. */
export const PRECOMPILE_ABI: Record<PrecompileName, readonly string[]> = {
  bank: [
    "mint(address,uint256)",
    "burn(address,uint256)",
    "transfer(address,address,uint256)", // (from, to, amount) — NOT standard ERC20
    "balanceOf(address,address)", // (token, account) — NOT standard ERC20
    "totalSupply(address)", // (token) — NOT standard ERC20
    "metadata(address)",
    "setMetadata(string,string,uint8)",
  ],
  staking: [
    "delegate(string,uint256)", // validator is a bech32 STRING (injvaloper1...), not address
    "undelegate(string,uint256)",
    "redelegate(string,string,uint256)",
    "delegation(address,string)",
    "withdrawDelegatorRewards(string)",
  ],
  // Exchange has 28 functions; the value-type entrypoints below were each
  // VERIFIED against the live chain (their selectors are recognised). The
  // remaining struct-heavy functions (order create/cancel batches) are left to
  // the AI long-tail path rather than guessing tuple layouts (see lint.ts).
  exchange: [
    "deposit(address,string,string,uint256)",
    "withdraw(address,string,string,uint256)",
    "subaccountDeposit(string,string)",
    "subaccountDeposits(string,string,uint32)",
    "subaccountPositions(string)",
    "subaccountTransfer(address,string,string,string,uint256)",
    "externalTransfer(address,string,string,string,uint256)",
    "cancelDerivativeOrder(address,string,string,string,int32,string)",
    "cancelSpotOrder(address,string,string,string,string)",
  ],
};

/**
 * Canonical standard-ERC20 selectors that developers WRONGLY send to the Bank
 * precompile (0x64) because they wired it up with a normal ERC20 ABI / ethers
 * / OpenZeppelin. Each maps to the correct Injective Bank usage. This is the
 * single highest-value diagnosis RevertLens makes — it is the #1 cause of the
 * opaque "execution reverted" that no generic tool explains.
 */
export interface ConfusionEntry {
  /** What the dev sent. */
  standardSig: string;
  /** What Injective Bank actually needs (undefined = not supported at all). */
  injectiveSig?: string;
  fix: string;
}

export const BANK_ERC20_CONFUSIONS: Record<string, ConfusionEntry> = {
  "0xa9059cbb": {
    standardSig: "transfer(address,uint256)",
    injectiveSig: "transfer(address,address,uint256)",
    fix: "Bank precompile transfer takes (from, to, amount) — three args. Pass the sender explicitly: transfer(msg.sender, to, amount).",
  },
  "0x70a08231": {
    standardSig: "balanceOf(address)",
    injectiveSig: "balanceOf(address,address)",
    fix: "Bank precompile balanceOf takes (tokenAddress, account). Pass the token's ERC20 address first: balanceOf(token, holder).",
  },
  "0x18160ddd": {
    standardSig: "totalSupply()",
    injectiveSig: "totalSupply(address)",
    fix: "Bank precompile totalSupply takes the token address: totalSupply(token).",
  },
  "0x06fdde03": {
    standardSig: "name()",
    injectiveSig: "metadata(address)",
    fix: "Bank precompile has no name()/symbol()/decimals(). Use metadata(token) which returns (name, symbol, decimals).",
  },
  "0x95d89b41": {
    standardSig: "symbol()",
    injectiveSig: "metadata(address)",
    fix: "Bank precompile has no symbol(). Use metadata(token) -> (name, symbol, decimals).",
  },
  "0x313ce567": {
    standardSig: "decimals()",
    injectiveSig: "metadata(address)",
    fix: "Bank precompile has no decimals(). Use metadata(token) -> (name, symbol, decimals).",
  },
  "0x095ea7b3": {
    standardSig: "approve(address,uint256)",
    injectiveSig: undefined,
    fix: "The Bank precompile is not allowance-based and has no approve(). For delegated access use the Exchange precompile's authorization flow instead.",
  },
  "0x23b872dd": {
    standardSig: "transferFrom(address,address,uint256)",
    injectiveSig: "transfer(address,address,uint256)",
    fix: "There is no transferFrom on the Bank precompile. Its transfer(from, to, amount) already takes an explicit sender.",
  },
  "0xdd62ed3e": {
    standardSig: "allowance(address,address)",
    injectiveSig: undefined,
    fix: "The Bank precompile has no allowance model. Remove the allowance check; native balances are queried via balanceOf(token, account).",
  },
};
