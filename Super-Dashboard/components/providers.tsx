"use client"

import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider, useTheme } from "next-themes"
import { useMemo, useState } from "react"
import { type State, WagmiProvider } from "wagmi"

import { Toaster } from "@/components/ui/sonner"
import { monadTestnet, wagmiConfig } from "@/lib/wagmi"

function RainbowShell({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme()
  const theme = useMemo(
    () =>
      resolvedTheme === "dark"
        ? darkTheme({
            accentColor: "#39b976",
            borderRadius: "small",
          })
        : lightTheme({
            accentColor: "#39b976",
            borderRadius: "small",
          }),
    [resolvedTheme]
  )

  return (
    <RainbowKitProvider
      appInfo={{
        appName: "VISTA Protocol",
        learnMoreUrl: "https://testnet.monadexplorer.com",
      }}
      initialChain={monadTestnet}
      modalSize="compact"
      theme={theme}
    >
      {children}
      <Toaster position="top-right" richColors />
    </RainbowKitProvider>
  )
}

export function Providers({ children, initialState }: { children: React.ReactNode; initialState?: State }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <WagmiProvider config={wagmiConfig} initialState={initialState}>
        <QueryClientProvider client={queryClient}>
          <RainbowShell>{children}</RainbowShell>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  )
}
