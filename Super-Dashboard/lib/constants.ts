import type { RoleName } from "@/lib/types";

export const APP_NAME = "VISTA Protocol";
export const APP_TAGLINE =
  "A real-time oracle protocol that turns ad attention into a provable, streaming USDC payout.";

export const MONAD_TESTNET = {
  id: 10143,
  name: "Monad Testnet",
  rpcUrl: "https://rpc.ankr.com/monad_testnet",
  currencySymbol: "MON",
  explorerUrl: "https://testnet.monadexplorer.com",
} as const;

export const preferenceOptions = [
  "fashion",
  "sport",
  "food",
  "healthy",
  "tech",
  "gaming",
] as const;

export const preferenceLabels: Record<
  (typeof preferenceOptions)[number],
  string
> = {
  fashion: "Fashion",
  sport: "Sport",
  food: "Food",
  healthy: "Healthy",
  tech: "Tech",
  gaming: "Gaming",
};

export const roleMeta: Record<
  RoleName,
  {
    label: string;
    dashboardPath: string;
    onboardingPath: string;
    description: string;
    accent: string;
  }
> = {
  advertiser: {
    label: "Advertiser",
    dashboardPath: "/advertiser/dashboard",
    onboardingPath: "/advertiser/onboarding",
    description: "Launch attention-based USDC campaigns across Web3 surfaces.",
    accent: "from-primary/20 via-primary/5 to-transparent",
  },
  publisher: {
    label: "Publisher",
    dashboardPath: "/publisher/dashboard",
    onboardingPath: "/publisher/onboarding",
    description:
      "Monetize placements and split verified attention in real time.",
    accent: "from-chart-2/20 via-chart-2/5 to-transparent",
  },
  user: {
    label: "End User",
    dashboardPath: "/user/dashboard",
    onboardingPath: "/user/onboarding",
    description:
      "Earn USDC while your attention is verified and streamed live.",
    accent: "from-chart-3/20 via-chart-3/5 to-transparent",
  },
};

export const roleNavigation: Record<
  RoleName,
  Array<{ label: string; href: string }>
> = {
  advertiser: [
    { label: "Dashboard", href: "/advertiser/dashboard" },
    { label: "Campaigns", href: "/advertiser/campaigns" },
    { label: "Launch", href: "/advertiser/campaigns/new" },
  ],
  publisher: [
    { label: "Dashboard", href: "/publisher/dashboard" },
    { label: "Analytics", href: "/publisher/analytics" },
  ],
  user: [
    { label: "Dashboard", href: "/user/dashboard" },
    { label: "History", href: "/user/history" },
  ],
};
