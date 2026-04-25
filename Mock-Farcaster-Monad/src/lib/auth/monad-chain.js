import { defineChain } from "viem";
import {
  MONAD_CHAIN_ID as SDK_MONAD_CHAIN_ID,
  MONAD_RPC_URL as SDK_MONAD_RPC_URL,
  MONAD_EXPLORER_URL as SDK_MONAD_EXPLORER_URL,
} from "vista-protocol";

function parseChainId(value) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : SDK_MONAD_CHAIN_ID;
}

export const MONAD_CHAIN_ID = parseChainId(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID);

export const monadChain = defineChain({
  id: MONAD_CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: {
    name: "MON",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_MONAD_RPC_URL || SDK_MONAD_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url: process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL || SDK_MONAD_EXPLORER_URL,
    },
  },
  testnet: true,
});
