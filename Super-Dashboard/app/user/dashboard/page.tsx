"use client"

import { Coins, Flame, Layers3, TimerReset } from "lucide-react"
import { useEffect, useState } from "react"
import { useAccount } from "wagmi"

import { LoadingScreen } from "@/components/loading-screen"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { UsdcCounter } from "@/components/usdc-counter"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { fetchJson } from "@/lib/http"
import type { UserDashboardData } from "@/lib/types"

export default function UserDashboardPage() {
  const { address } = useAccount()
  const [data, setData] = useState<UserDashboardData | null>(null)

  useEffect(() => {
    if (!address) return

    let cancelled = false

    async function load() {
      const result = await fetchJson<UserDashboardData>(`/api/dashboard/user?wallet=${address}`)
      if (!cancelled) {
        setData(result)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [address])

  if (!data || !address) {
    return <LoadingScreen description="Syncing your verified earnings, receipts, and live session counter." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="User dashboard"
        title="Your attention stream"
        description="See your live session earnings tick upward and review how much verified attention has settled to this wallet."
      />

      <UsdcCounter
        initialAmount={data.liveSession.currentAmount}
        initialRatePerSecond={data.liveSession.ratePerSecond}
        initialSessionId={data.liveSession.sessionId}
        initialSessionSeconds={data.liveSession.sessionSeconds}
        initialVerified={data.liveSession.verified}
        walletAddress={address}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Coins} title="Total USDC earned" value={data.stats.totalUsdcEarned} format="usdc" />
        <StatCard icon={Layers3} title="Sessions completed" value={data.stats.totalSessionsCompleted} />
        <StatCard icon={TimerReset} title="Total seconds verified" value={data.stats.totalSecondsVerified} />
        <StatCard icon={Flame} title="Favorite category" value={0} hint={data.stats.favoriteAdCategory} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6 text-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Verification status</p>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              The counter listens to the Oracle WebSocket and smoothly animates between ticks so session earnings
              keep climbing even during the 10-second gap between proofs.
            </p>
          </div>
          <Badge variant={data.liveSession.verified ? "default" : "outline"}>
            {data.liveSession.verified ? "Attention verified" : "Waiting for active session"}
          </Badge>
        </CardContent>
      </Card>
    </div>
  )
}
