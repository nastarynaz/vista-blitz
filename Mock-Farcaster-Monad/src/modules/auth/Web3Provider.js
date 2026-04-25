"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { monadChain } from "@/lib/auth/monad-chain";

function getInjectedProviders() {
  if (typeof window === "undefined") {
    return [];
  }

  const ethereum = window.ethereum;
  if (!ethereum) {
    return [];
  }

  if (Array.isArray(ethereum.providers) && ethereum.providers.length > 0) {
    return ethereum.providers;
  }

  return [ethereum];
}

function pickProvider(predicate) {
  return () => {
    const providers = getInjectedProviders();
    const exact = providers.find(predicate);
    if (exact) {
      return exact;
    }

    return undefined;
  };
}

function isBraveBrowser() {
  return typeof navigator !== "undefined" && typeof navigator.brave !== "undefined";
}

function isBraveProvider(provider) {
  if (!provider) {
    return false;
  }

  if (provider.isBraveWallet || provider.isBraveWalletProvider) {
    return true;
  }

  const providerName = provider.providerInfo?.name;
  if (typeof providerName === "string" && providerName.toLowerCase().includes("brave")) {
    return true;
  }

  return false;
}

const wagmiConfig = createConfig({
  chains: [monadChain],
  connectors: [
    injected({
      target: {
        id: "brave",
        name: "Brave Wallet",
        provider: () => {
          const providers = getInjectedProviders();
          const brave = providers.find(isBraveProvider);
          if (brave) {
            return brave;
          }

          // In some Brave setups the provider does not expose a brave-specific marker.
          // If we're in Brave and at least one injected provider exists, use it as fallback.
          if (isBraveBrowser() && providers.length > 0) {
            return providers[0];
          }

          return undefined;
        },
      },
      shimDisconnect: true,
    }),
    injected({
      target: {
        id: "metamask",
        name: "MetaMask",
        provider: pickProvider((provider) => provider?.isMetaMask && !provider?.isBraveWallet),
      },
      shimDisconnect: true,
    }),
    injected({
      shimDisconnect: true,
    }),
  ],
  transports: {
    [monadChain.id]: http(monadChain.rpcUrls.default.http[0]),
  },
});

export default function Web3Provider({ children }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
