"use client";

import { useEffect, useState } from "react";
import HeroSection from "@/modules/home/components/HeroSection";
import NavBar from "@/modules/home/components/NavBar";
import TrendingSection from "@/modules/home/components/TrendingSection";
import { CHANNELS, FEED_POSTS, RIGHT_LINKS, SIDEBAR_ITEMS } from "@/modules/home/components/constants";
import { useVista } from "@/modules/vista/useVista";

function toWalletUser(address) {
  return {
    displayName: "Wallet User",
    handle: `${address.slice(0, 6)}...${address.slice(-4)}`,
    address,
  };
}

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState(null);
  const vistaState = useVista({ userWallet: currentUser?.address, zoneId: "vista-content-zone" });

  useEffect(() => {
    let isActive = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          if (isActive) {
            setCurrentUser(null);
          }
          return;
        }

        const payload = await response.json();
        const address = payload?.user?.address;

        if (!address || !isActive) {
          return;
        }

        setCurrentUser(toWalletUser(address));
      } catch {
        if (isActive) {
          setCurrentUser(null);
        }
      }
    }

    loadSession();

    return () => {
      isActive = false;
    };
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    setCurrentUser(null);
  }

  return (
    <div className="min-h-screen bg-[#06070a] text-zinc-100">
      <main className="mx-auto grid w-full max-w-340 grid-cols-1 px-3 pb-3 lg:grid-cols-[250px_1fr_420px]">
        <NavBar items={SIDEBAR_ITEMS} isLoggedIn={Boolean(currentUser)} onLogout={handleLogout} />

        <section id="discover" className="min-w-0">
          <HeroSection posts={FEED_POSTS} />
        </section>

        <section className="min-w-0">
          <TrendingSection
            channels={CHANNELS}
            links={RIGHT_LINKS}
            currentUser={currentUser}
            vistaState={vistaState}
          />
        </section>
      </main>
    </div>
  );
}
