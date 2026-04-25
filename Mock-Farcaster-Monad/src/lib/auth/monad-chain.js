import { defineChain } from "viem";
import {
  DEFAULT_MONAD_CHAIN_ID,
  DEFAULT_MONAD_EXPLORER_URL,
  DEFAULT_MONAD_RPC_URL,
} from "@/lib/auth/constants";

function parseChainId(value) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_MONAD_CHAIN_ID;
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
      http: [process.env.NEXT_PUBLIC_MONAD_RPC_URL || DEFAULT_MONAD_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url: process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL || DEFAULT_MONAD_EXPLORER_URL,
    },
  },
  testnet: true,
});
