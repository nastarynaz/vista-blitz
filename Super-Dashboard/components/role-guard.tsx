"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";

import { LoadingScreen } from "@/components/loading-screen";
import { fetchJson } from "@/lib/http";
import type { RoleName } from "@/lib/types";

export function RoleGuard({
  role,
  requireRegistration,
  redirectIfRegisteredTo,
  children,
}: {
  role: RoleName;
  requireRegistration?: boolean;
  redirectIfRegisteredTo?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { openConnectModal } = useConnectModal();
  const openConnectModalRef = useRef(openConnectModal);
  openConnectModalRef.current = openConnectModal;

  const { address, isConnected, status } = useAccount();
  const [checking, setChecking] = useState(true);
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveAccess() {
      if (status === "connecting" || status === "reconnecting") {
        return; // Wait for connection to resolve
      }

      if (!isConnected || !address) {
        router.replace("/");
        openConnectModalRef.current?.();
        return;
      }

      if (!requireRegistration && !redirectIfRegisteredTo) {
        if (!cancelled) {
          setCanRender(true);
          setChecking(false);
        }
        return;
      }

      try {
        const result = await fetchJson<{ registered: boolean }>(
          `/api/roles/status?role=${role}&wallet=${address}`,
        );

        if (cancelled) return;

        if (requireRegistration && !result.registered) {
          router.replace(`/${role}/onboarding`);
          return;
        }

        if (redirectIfRegisteredTo && result.registered) {
          router.replace(redirectIfRegisteredTo);
          return;
        }

        setCanRender(true);
      } catch {
        router.replace("/");
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    setChecking(true);
    setCanRender(false);
    void resolveAccess();

    return () => {
      cancelled = true;
    };
  }, [
    address,
    isConnected,
    redirectIfRegisteredTo,
    requireRegistration,
    role,
    router,
    status,
  ]);

  if (checking || !canRender) {
    return (
      <LoadingScreen description="Checking wallet connection and role access." />
    );
  }

  return <>{children}</>;
}
