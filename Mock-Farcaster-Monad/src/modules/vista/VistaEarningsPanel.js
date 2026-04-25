"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function VistaEarningsPanel({ vistaState, userWallet }) {
  const {
    earnings = 0,
    validSeconds = 0,
    score = 0,
    isActive = false,
    flagged = false,
    tickAmount = 0,
  } = vistaState ?? {};

  const [displaySeconds, setDisplaySeconds] = useState(validSeconds);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setDisplaySeconds(validSeconds);
  }, [validSeconds]);

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setDisplaySeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  useEffect(() => {
    if (tickAmount === 0) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 600);
    return () => clearTimeout(t);
  }, [tickAmount]);

  if (!userWallet) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0b0b0f] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-violet-500" />
          <p className="text-sm font-semibold text-zinc-300">VISTA Attention Mining</p>
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed">
          Earn VISTA tokens just by reading content. Connect your wallet to start mining attention.
        </p>
        <Link
          href="/auth"
          className="inline-flex w-full items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 transition"
        >
          Connect Wallet to Earn
        </Link>
      </div>
    );
  }

  const scorePercent = Math.round(score * 100);
  const isEarning = score >= 0.6;

  return (
    <div
      className={`rounded-2xl border bg-[#0b0b0f] p-4 space-y-4 transition-colors duration-300 ${
        flash ? "border-violet-500/60" : "border-white/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {isActive && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isActive ? "bg-violet-500" : "bg-zinc-600"
              }`}
            />
          </span>
          <p className="text-sm font-semibold text-zinc-300">VISTA Earnings</p>
        </div>
        {flagged && (
          <span className="text-xs text-amber-400 border border-amber-400/30 rounded-full px-2 py-0.5">
            Reviewing
          </span>
        )}
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-violet-400">Session Earnings</p>
        <p
          className={`mt-1 text-2xl font-semibold font-mono transition-colors duration-300 ${
            flash ? "text-violet-300" : "text-white"
          }`}
        >
          {earnings.toFixed(6)}{" "}
          <span className="text-sm text-zinc-400">VISTA</span>
        </p>
      </div>

      <div>
        <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
          <span>Attention Score</span>
          <span>{scorePercent}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${scorePercent}%`,
              background: isEarning
                ? "linear-gradient(to right, #7c3aed, #6366f1)"
                : "linear-gradient(to right, #f59e0b, #d97706)",
            }}
          />
        </div>
        <p className="mt-1 text-xs text-zinc-600">
          {isActive
            ? isEarning
              ? "Earning active — keep watching"
              : "Score below threshold (0.60)"
            : "Waiting to track attention…"}
        </p>
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-500 border-t border-white/5 pt-3">
        <span>Validated time</span>
        <span className="font-mono text-zinc-300">{displaySeconds}s</span>
      </div>
    </div>
  );
}
