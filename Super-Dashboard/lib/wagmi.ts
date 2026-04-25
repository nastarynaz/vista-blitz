import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { defineChain, http } from "viem"
import { createStorage, noopStorage } from "wagmi"

import { APP_NAME, MONAD_TESTNET } from "@/lib/constants"

export const monadTestnet = defineChain({
  id: MONAD_TESTNET.id,
  name: MONAD_TESTNET.name,
  network: "monad-testnet",
  nativeCurrency: {
    name: "Monad",
    symbol: MONAD_TESTNET.currencySymbol,
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_MONAD_RPC || MONAD_TESTNET.rpcUrl],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_MONAD_RPC || MONAD_TESTNET.rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url: MONAD_TESTNET.explorerUrl,
    },
  },
  testnet: true,
})

export const wagmiConfig = getDefaultConfig({
  appName: APP_NAME,
  appDescription: "Real-time attention monetization dashboard for VISTA Protocol.",
  appUrl: "https://vista.protocol",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "vista-demo-walletconnect",
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http(process.env.NEXT_PUBLIC_MONAD_RPC || MONAD_TESTNET.rpcUrl),
  },
  storage: createStorage({
    storage: noopStorage,
  }),
  ssr: true,
})
