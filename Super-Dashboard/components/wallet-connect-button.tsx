"use client"

import { ConnectButton } from "@rainbow-me/rainbowkit"
import { ChevronDown, Wallet } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn, truncateAddress } from "@/lib/utils"

export function WalletConnectButton({ className }: { className?: string }) {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        openAccountModal,
        openChainModal,
        openConnectModal,
      }) => {
        const ready = mounted
        const connected = ready && account && chain

        if (!ready) {
          return (
            <div
              className={cn(
                buttonVariants({ variant: "outline" }),
                className,
                "pointer-events-none invisible",
              )}
              suppressHydrationWarning
            >
              Connect wallet
            </div>
          )
        }

        if (!connected) {
          return (
            <Button className={className} onClick={openConnectModal}>
              <Wallet className="size-4" />
              Connect Wallet
            </Button>
          )
        }

        if (chain.unsupported) {
          return (
            <Button className={className} onClick={openChainModal} variant="destructive">
              Wrong network
            </Button>
          )
        }

        return (
          <div className={cn("flex items-center gap-2", className)}>
            <Button onClick={openChainModal} variant="outline">
              {chain.name}
              <ChevronDown className="size-4" />
            </Button>
            <Button onClick={openAccountModal} variant="secondary">
              <Wallet className="size-4" />
              {truncateAddress(account.address)}
            </Button>
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
