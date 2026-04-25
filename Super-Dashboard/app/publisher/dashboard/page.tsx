"use client";

import {
  Activity,
  ArrowDownToLine,
  Coins,
  Eye,
  TimerReset,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useReadContracts,
} from "wagmi";

import { LoadingScreen } from "@/components/loading-screen";
import { MetricChartCard } from "@/components/metric-chart-card";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  contractAddresses,
  vistaVaultAbi,
  vistaStreamAbi,
} from "@/lib/contracts";
import type { OnChainEarningRecord } from "@/lib/on-chain-helpers";
import {
  computePublisherStats,
  computeRevenuePerDay,
  extractUniqueSessionIds,
  computeSessionStats,
  buildRecentSessions,
} from "@/lib/on-chain-helpers";
import { formatUsdc, truncateAddress, truncateHash } from "@/lib/utils";

export default function PublisherDashboardPage() {
  const { address } = useAccount();

  const {
    writeContract,
    data: withdrawTxHash,
    isPending: isWithdrawPending,
    error: withdrawError,
    reset: resetWithdraw,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isWithdrawn } =
    useWaitForTransactionReceipt({ hash: withdrawTxHash });

  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const withdrawalAmountRef = useRef(0);

  const fetchTotalWithdrawn = useCallback(async () => {
    if (!address) return;
    const res = await fetch(`/api/publisher/withdrawal?wallet=${address}`);
    if (res.ok) {
      const data = (await res.json()) as { totalWithdrawn: number };
      setTotalWithdrawn(data.totalWithdrawn ?? 0);
    }
  }, [address]);

  useEffect(() => {
    void fetchTotalWithdrawn();
  }, [fetchTotalWithdrawn]);

  // ─── On-chain reads ────────────────────────────────────────────

  const { data: onChainBalance, refetch: refetchBalance } = useReadContract({
    address: contractAddresses.vistaVault ?? undefined,
    abi: vistaVaultAbi,
    functionName: "getBalance",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && contractAddresses.vistaVault) },
  });

  const { data: earningRecords, isLoading: isLoadingRecords } = useReadContract(
    {
      address: contractAddresses.vistaVault ?? undefined,
      abi: vistaVaultAbi,
      functionName: "getEarningRecords",
      args: address ? [address] : undefined,
      query: { enabled: Boolean(address && contractAddresses.vistaVault) },
    },
  );

  // Step 1: derive unique session IDs from earning records
  const sessionIds = useMemo(
    () =>
      extractUniqueSessionIds(
        earningRecords as readonly OnChainEarningRecord[] | undefined,
      ),
    [earningRecords],
  );

  // Step 2: multicall VistaStream.sessions(id) for each session
  const sessionContracts = useMemo(
    () =>
      sessionIds.map((id) => ({
        address: contractAddresses.vistaStream!,
        abi: vistaStreamAbi,
        functionName: "sessions" as const,
        args: [id] as const,
      })),
    [sessionIds],
  );

  const { data: sessionResults, isLoading: isLoadingSessions } =
    useReadContracts({
      contracts: sessionContracts,
      query: {
        enabled:
          sessionIds.length > 0 && Boolean(contractAddresses.vistaStream),
      },
    });

  // ─── Computed values ───────────────────────────────────────────

  const typedEarningRecords = earningRecords as
    | readonly OnChainEarningRecord[]
    | undefined;

  const onChainStats = useMemo(
    () => computePublisherStats(typedEarningRecords),
    [typedEarningRecords],
  );
  const onChainRevenuePerDay = useMemo(
    () => computeRevenuePerDay(typedEarningRecords),
    [typedEarningRecords],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedSessionResults = sessionResults as any;

  const sessionStats = useMemo(
    () => computeSessionStats(typedSessionResults),
    [typedSessionResults],
  );
  const recentSessions = useMemo(
    () => buildRecentSessions(typedSessionResults, typedEarningRecords),
    [typedSessionResults, typedEarningRecords],
  );

  // ─── Withdraw ──────────────────────────────────────────────────

  useEffect(() => {
    if (!isWithdrawn) return;
    void refetchBalance();
    if (address && withdrawalAmountRef.current > 0) {
      void fetch("/api/publisher/withdrawal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          amount: withdrawalAmountRef.current,
          withdrawnAt: new Date().toISOString(),
        }),
      }).then(() => void fetchTotalWithdrawn());
      withdrawalAmountRef.current = 0;
    }
  }, [isWithdrawn, refetchBalance, address, fetchTotalWithdrawn]);

  function handleWithdraw() {
    if (!contractAddresses.vistaVault) return;
    withdrawalAmountRef.current = Number(onChainBalance ?? 0) / 1_000_000;
    resetWithdraw();
    writeContract({
      address: contractAddresses.vistaVault,
      abi: vistaVaultAbi,
      functionName: "withdraw",
    });
  }

  // ─── Loading ───────────────────────────────────────────────────

  const isLoading =
    isLoadingRecords || (sessionIds.length > 0 && isLoadingSessions);

  if (isLoading) {
    return (
      <LoadingScreen description="Loading publisher revenue, active sessions, and daily trend lines." />
    );
  }

  // on-chain balance is in USDC base units (6 decimals)
  const vaultBalanceRaw = Number(onChainBalance ?? 0);
  const hasVaultBalance = vaultBalanceRaw > 0;
  const isWithdrawing = isWithdrawPending || isConfirming;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Publisher dashboard"
        title="Monetization Performance"
        description="Track every impression, live session, and USDC split flowing back to your inventory."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Coins}
          title="Total USDC Withdrawn"
          value={totalWithdrawn}
          format="usdc"
        />
        <StatCard
          icon={Eye}
          title="Total ad impressions"
          value={onChainStats.totalAdImpressions}
        />
        <StatCard
          icon={TimerReset}
          title="Total viewer-seconds"
          value={sessionStats.totalViewerSeconds}
        />
        <StatCard
          icon={Activity}
          title="Active sessions now"
          value={sessionStats.activeSessions}
        />
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Vault balance
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">
                  {formatUsdc(vaultBalanceRaw / 1_000_000)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    USDC
                  </span>
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                Accumulated revenue share from ad sessions — withdraw any time.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <Button
                onClick={handleWithdraw}
                disabled={
                  !hasVaultBalance ||
                  isWithdrawing ||
                  !contractAddresses.vistaVault
                }
                size="lg"
              >
                {isWithdrawing ? (
                  <>
                    <ArrowDownToLine className="animate-pulse" />
                    {isConfirming ? "Confirming…" : "Withdrawing…"}
                  </>
                ) : (
                  <>
                    <Wallet />
                    Withdraw to wallet
                  </>
                )}
              </Button>
              {isWithdrawn && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  Withdrawal confirmed!
                </p>
              )}
              {withdrawError && (
                <p className="max-w-xs text-right text-xs text-destructive">
                  {withdrawError.message.split("\n")[0]}
                </p>
              )}
              {!hasVaultBalance && !isWithdrawn && (
                <p className="text-xs text-muted-foreground">
                  No balance to withdraw
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <MetricChartCard
        data={onChainRevenuePerDay}
        description="Daily publisher revenue from on-chain VistaVault earning records."
        title="Revenue per day"
        valueFormatter={(value) => `${formatUsdc(value)} USDC`}
      />

      <div className="rounded-[28px] border border-border/70 bg-card/90 p-4 sm:p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold tracking-tight">
            Recent sessions
          </h2>
          <p className="text-sm text-muted-foreground">
            Latest sessions attributed to this publisher wallet.
          </p>
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
            {recentSessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell className="font-medium">
                  {truncateHash(session.sessionIdOnchain)}
                </TableCell>
                <TableCell>{truncateAddress(session.userWallet)}</TableCell>
                <TableCell>{session.secondsVerified}s</TableCell>
                <TableCell>
                  {formatUsdc(session.publisherAmount ?? 0)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      session.status === "active" ? "default" : "outline"
                    }
                  >
                    {session.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
