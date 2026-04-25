"use client";

import { Clock3, Radar, Wallet2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { LoadingScreen } from "@/components/loading-screen";
import { MetricChartCard } from "@/components/metric-chart-card";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchJson } from "@/lib/http";
import type { PublisherAnalyticsData } from "@/lib/types";
import { formatUsdc, truncateHash } from "@/lib/utils";

export default function PublisherAnalyticsPage() {
  const { address } = useAccount();
  const [data, setData] = useState<PublisherAnalyticsData | null>(null);

  useEffect(() => {
    if (!address) return;

    let cancelled = false;

    async function load() {
      const result = await fetchJson<PublisherAnalyticsData>(
        `/api/publishers/${address}/analytics`,
      );
      if (!cancelled) {
        setData(result);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [address]);

  if (!data) {
    return (
      <LoadingScreen description="Crunching publisher campaign breakdowns and time-slot revenue." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Publisher analytics"
        title="Deeper ad inventory analytics"
        description="Break down revenue by campaign, uncover peak time slots, and understand average session quality."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={Wallet2}
          title="Campaigns tracked"
          value={data.breakdownByCampaign.length}
        />
        <StatCard
          icon={Clock3}
          title="Average session duration"
          value={data.averageSessionDuration}
        />
        <StatCard
          icon={Radar}
          title="Top time slots"
          value={data.topTimeSlots.length}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <MetricChartCard
          data={data.topTimeSlots.map((slot) => ({
            date: String(slot.hour),
            label: slot.label,
            value: slot.revenue,
          }))}
          description="Highest revenue windows based on `stream_ticks` grouped by hour."
          kind="bar"
          title="Top performing time slots"
          valueFormatter={(value) => `${formatUsdc(value)} USDC`}
        />

        <div className="rounded-[28px] border border-border/70 bg-card/90 p-4 sm:p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold tracking-tight">
              Revenue by campaign
            </h2>
            <p className="text-sm text-muted-foreground">
              Campaign-level earnings attributed to this publisher.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Impressions</TableHead>
                <TableHead>Viewer-seconds</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.breakdownByCampaign.map((campaign) => (
                <TableRow key={campaign.campaignIdOnchain}>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium">{campaign.campaignTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {truncateHash(campaign.campaignIdOnchain)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{formatUsdc(campaign.revenue)}</TableCell>
                  <TableCell>{campaign.impressions}</TableCell>
                  <TableCell>{campaign.viewerSeconds}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
