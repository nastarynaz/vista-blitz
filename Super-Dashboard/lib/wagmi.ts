import { defineChain, http } from "viem"
import { cookieStorage, createConfig, createStorage } from "wagmi"
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors"

import { APP_NAME, MONAD_TESTNET } from "@/lib/constants"

const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "vista-demo-walletconnect"

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

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors: [
    injected(),
    walletConnect({ projectId: PROJECT_ID }),
    coinbaseWallet({ appName: APP_NAME }),
  ],
  transports: {
    [monadTestnet.id]: http(process.env.NEXT_PUBLIC_MONAD_RPC || MONAD_TESTNET.rpcUrl),
  },
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
})
