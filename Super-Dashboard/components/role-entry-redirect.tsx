"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAccount } from "wagmi";

import { LoadingScreen } from "@/components/loading-screen";
import { roleMeta } from "@/lib/constants";
import { fetchJson } from "@/lib/http";
import type { RoleName } from "@/lib/types";

export function RoleEntryRedirect({ role }: { role: RoleName }) {
  const router = useRouter();
  const { openConnectModal } = useConnectModal();
  const { address, isConnected, status } = useAccount();

  useEffect(() => {
    let cancelled = false;

    async function resolveDestination() {
      if (status === "connecting" || status === "reconnecting") {
        return; // Wait for connection to resolve
      }

      if (!isConnected || !address) {
        router.replace("/");
        openConnectModal?.();
        return;
      }

      const statusRes = await fetchJson<{ registered: boolean }>(
        `/api/roles/status?role=${role}&wallet=${address}`,
      );

      if (cancelled) return;

      router.replace(
        statusRes.registered
          ? roleMeta[role].dashboardPath
          : roleMeta[role].onboardingPath,
      );
    }

    void resolveDestination();

    return () => {
      cancelled = true;
    };
  }, [address, isConnected, openConnectModal, role, router, status]);

  return (
    <LoadingScreen
      title={`Opening ${roleMeta[role].label} workspace`}
      description="Routing you to the correct step based on this wallet."
    />
  );
}
