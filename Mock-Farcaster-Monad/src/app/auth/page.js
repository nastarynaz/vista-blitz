"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
} from "wagmi";
import { MONAD_CHAIN_ID } from "@/lib/auth/monad-chain";
import { buildWalletAuthMessage } from "@/lib/auth/sign-message";

export default function AuthPage() {
  const router = useRouter();
  const { address, chainId, isConnected } = useAccount();
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync, isPending: isWaitingSignature } = useSignMessage();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();

  const [errorMessage, setErrorMessage] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [connectorAvailability, setConnectorAvailability] = useState({});

  const walletAddressLabel = useMemo(() => {
    if (!address) {
      return "";
    }

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, [address]);

  const displayedConnectors = useMemo(() => {
    const hasSpecificInjected = connectors.some((connector) => connector.name !== "Injected");
    const baseConnectors = hasSpecificInjected
      ? connectors.filter((connector) => connector.name !== "Injected")
      : connectors;

    const unique = [];
    const seenNames = new Set();

    for (const connector of baseConnectors) {
      const normalizedName = connector.name.trim().toLowerCase();

      if (seenNames.has(normalizedName)) {
        continue;
      }

      seenNames.add(normalizedName);
      unique.push(connector);
    }

    return unique;
  }, [connectors]);

  useEffect(() => {
    let isActive = true;

    async function resolveAvailability() {
      const pairs = await Promise.all(
        displayedConnectors.map(async (connector) => {
          try {
            const provider = await connector.getProvider();

            if (
              connector.name === "Brave Wallet" &&
              typeof navigator !== "undefined" &&
              typeof navigator.brave !== "undefined"
            ) {
              return [connector.uid, Boolean(provider || window.ethereum)];
            }

            return [connector.uid, Boolean(provider)];
          } catch {
            if (
              connector.name === "Brave Wallet" &&
              typeof navigator !== "undefined" &&
              typeof navigator.brave !== "undefined"
            ) {
              return [connector.uid, Boolean(window.ethereum)];
            }

            return [connector.uid, false];
          }
        }),
      );

      if (!isActive) {
        return;
      }

      setConnectorAvailability(Object.fromEntries(pairs));
    }

    resolveAvailability();

    return () => {
      isActive = false;
    };
  }, [displayedConnectors]);

  function getInstallUrl(connectorName) {
    if (connectorName === "Brave Wallet") {
      return "https://brave.com/wallet/";
    }

    if (connectorName === "MetaMask") {
      return "https://metamask.io/download/";
    }

    return null;
  }

  async function handleConnect(connector) {
    setErrorMessage("");

    const isAvailable = connectorAvailability[connector.uid];
    const installUrl = getInstallUrl(connector.name);

    if (isAvailable === false && installUrl) {
      window.open(installUrl, "_blank", "noopener,noreferrer");
      setErrorMessage(`${connector.name} belum terdeteksi. Silakan install extension wallet terlebih dulu.`);
      return;
    }

    try {
      await connectAsync({ connector });
    } catch (error) {
      const detail =
        (typeof error?.shortMessage === "string" && error.shortMessage) ||
        (typeof error?.message === "string" && error.message) ||
        "Koneksi wallet dibatalkan atau gagal.";

      setErrorMessage(`Gagal connect ${connector.name}: ${detail}`);
    }
  }

  async function handleSignIn() {
    if (!address) {
      setErrorMessage("Connect wallet dulu sebelum sign-in.");
      return;
    }

    setErrorMessage("");
    setIsSigningIn(true);

    try {
      let activeChainId = chainId;

      if (activeChainId !== MONAD_CHAIN_ID && switchChainAsync) {
        const switched = await switchChainAsync({ chainId: MONAD_CHAIN_ID });
        activeChainId = switched.id;
      }

      if (activeChainId !== MONAD_CHAIN_ID) {
        throw new Error("Wrong chain");
      }

      const nonceResponse = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address }),
      });

      const noncePayload = await nonceResponse.json();
      if (!nonceResponse.ok || !noncePayload?.nonce) {
        throw new Error(noncePayload?.error || "Failed nonce");
      }

      const issuedAt = new Date().toISOString();
      const message = buildWalletAuthMessage({
        domain: window.location.host,
        uri: window.location.origin,
        address,
        nonce: noncePayload.nonce,
        chainId: activeChainId,
        issuedAt,
      });

      const signature = await signMessageAsync({ message });

      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address,
          nonce: noncePayload.nonce,
          chainId: activeChainId,
          message,
          signature,
        }),
      });

      const verifyPayload = await verifyResponse.json();
      if (!verifyResponse.ok) {
        throw new Error(verifyPayload?.error || "Verify failed");
      }

      router.push("/");
      router.refresh();
    } catch {
      setErrorMessage("Sign-in wallet gagal. Pastikan kamu approve signature dan pakai Monad chain.");
    } finally {
      setIsSigningIn(false);
    }
  }

  function handleDisconnect() {
    disconnect();
    setErrorMessage("");
  }

  return (
    <main className="min-h-screen bg-[#06070a] px-4 py-8 text-zinc-100">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/80 p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Wallet Authentication</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Connect to Monad</h1>
        <p className="mt-2 text-sm text-zinc-400">Connect wallet, sign challenge, lalu session backend aktif otomatis.</p>

        <div className="mt-6 grid gap-3">
          {displayedConnectors.map((connector) => (
            (() => {
              const isAvailable = connectorAvailability[connector.uid] ?? true;
              const installUrl = getInstallUrl(connector.name);
              const shouldShowInstall = !isAvailable && Boolean(installUrl);

              return (
            <button
              key={connector.uid}
              type="button"
              onClick={() => handleConnect(connector)}
              disabled={isConnecting || isConnected}
              className="rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConnecting
                ? "Connecting..."
                : shouldShowInstall
                  ? `Install ${connector.name}`
                  : `Connect ${connector.name}`}
            </button>
              );
            })()
          ))}

          <p className="text-xs text-zinc-500">Monad diprioritaskan: setelah connect, app akan meminta switch ke chain Monad otomatis.</p>

          {isConnected ? (
            <div className="grid gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-xs uppercase tracking-wider text-emerald-200">Connected Wallet</p>
              <p className="font-mono text-sm text-emerald-100">{walletAddressLabel}</p>
              <p className="text-xs text-zinc-300">Chain ID: {chainId ?? "-"} (target: {MONAD_CHAIN_ID})</p>

              <button
                type="button"
                onClick={handleSignIn}
                disabled={isSigningIn || isWaitingSignature || isSwitchingChain}
                className="rounded-xl bg-linear-to-br from-violet-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSigningIn || isWaitingSignature || isSwitchingChain ? "Signing in..." : "Sign In with Wallet"}
              </button>

              <button
                type="button"
                onClick={handleDisconnect}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
              >
                Disconnect Wallet
              </button>
            </div>
          ) : null}

          {errorMessage ? <p className="text-sm text-rose-400">{errorMessage}</p> : null}
        </div>

        <Link href="/" className="mt-5 inline-flex text-sm font-semibold text-emerald-400 hover:text-emerald-300">
          Back to home
        </Link>
      </section>
    </main>
  );
}
