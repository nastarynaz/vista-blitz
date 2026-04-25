"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEMO_ACCOUNT } from "@/modules/home/components/constants";

export default function AuthPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState(DEMO_ACCOUNT.identifier);
  const [password, setPassword] = useState(DEMO_ACCOUNT.password);
  const [errorMessage, setErrorMessage] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (
      identifier.trim() === DEMO_ACCOUNT.identifier &&
      password === DEMO_ACCOUNT.password
    ) {
      const sessionPayload = {
        identifier: DEMO_ACCOUNT.identifier,
        signedInAt: new Date().toISOString(),
      };

      window.localStorage.setItem("fc-demo-session", JSON.stringify(sessionPayload));
      router.push("/");
      return;
    }

    setErrorMessage("Credential tidak cocok. Gunakan akun demo.");
  }

  return (
    <main className="min-h-screen bg-[#06070a] px-4 py-8 text-zinc-100">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/80 p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Demo Authentication</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Login to Continue</h1>
        <p className="mt-2 text-sm text-zinc-400">Ini halaman auth demo. Tidak terhubung wallet asli.</p>

        <form className="mt-6 grid gap-3" onSubmit={handleSubmit}>
          <label htmlFor="identifier" className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Email
          </label>
          <input
            id="identifier"
            name="identifier"
            type="email"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="email"
            required
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none ring-violet-300/40 placeholder:text-zinc-500 focus:ring-2"
          />

          <label htmlFor="password" className="mt-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none ring-violet-300/40 placeholder:text-zinc-500 focus:ring-2"
          />

          {errorMessage ? <p className="text-sm text-rose-400">{errorMessage}</p> : null}

          <button
            type="submit"
            className="mt-2 rounded-xl bg-linear-to-br from-violet-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Login Demo
          </button>
        </form>

        <p className="mt-4 text-xs leading-relaxed text-zinc-400">
          Demo account:
          <br />
          <span className="font-mono text-[0.78rem] text-zinc-300">demo@farcaster.local / 12345678</span>
        </p>

        <Link href="/" className="mt-5 inline-flex text-sm font-semibold text-emerald-400 hover:text-emerald-300">
          Back to home
        </Link>
      </section>
    </main>
  );
}
