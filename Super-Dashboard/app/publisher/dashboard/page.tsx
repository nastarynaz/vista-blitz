"use client"

import { Activity, Coins, Eye, TimerReset } from "lucide-react"
import { useEffect, useState } from "react"
import { useAccount } from "wagmi"

import { LoadingScreen } from "@/components/loading-screen"
import { MetricChartCard } from "@/components/metric-chart-card"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { fetchJson } from "@/lib/http"
import type { PublisherDashboardData } from "@/lib/types"
import { formatUsdc, truncateAddress, truncateHash } from "@/lib/utils"

export default function PublisherDashboardPage() {
  const { address } = useAccount()
  const [data, setData] = useState<PublisherDashboardData | null>(null)

  useEffect(() => {
    if (!address) return

    let cancelled = false

    async function load() {
      const result = await fetchJson<PublisherDashboardData>(`/api/dashboard/publisher?wallet=${address}`)
      if (!cancelled) {
        setData(result)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [address])

  if (!data) {
    return <LoadingScreen description="Loading publisher revenue, active sessions, and daily trend lines." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Publisher dashboard"
        title="Monetization performance"
        description="Track every impression, live session, and USDC split flowing back to your inventory."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Coins} title="Total USDC earned" value={data.stats.totalUsdcEarned} format="usdc" />
        <StatCard icon={Eye} title="Total ad impressions" value={data.stats.totalAdImpressions} />
        <StatCard icon={TimerReset} title="Total viewer-seconds" value={data.stats.totalViewerSeconds} />
        <StatCard icon={Activity} title="Active sessions now" value={data.stats.activeSessions} />
      </div>

      <MetricChartCard
        data={data.revenuePerDay}
        description="Daily publisher revenue pulled from `stream_ticks`."
        title="Revenue per day"
        valueFormatter={(value) => `${formatUsdc(value)} USDC`}
      />

      <div className="rounded-[28px] border border-border/70 bg-card/90 p-4 sm:p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Recent sessions</h2>
          <p className="text-sm text-muted-foreground">Latest sessions attributed to this publisher wallet.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session ID</TableHead>
              <TableHead>User wallet</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Earned</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.recentSessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell className="font-medium">{truncateHash(session.sessionIdOnchain)}</TableCell>
                <TableCell>{truncateAddress(session.userWallet)}</TableCell>
                <TableCell>{session.secondsVerified}s</TableCell>
                <TableCell>{formatUsdc(session.publisherAmount ?? 0)}</TableCell>
                <TableCell>
                  <Badge variant={session.status === "active" ? "default" : "outline"}>{session.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
