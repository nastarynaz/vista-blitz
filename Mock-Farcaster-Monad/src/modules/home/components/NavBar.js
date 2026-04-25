import {
  Bell,
  Bookmark,
  Circle,
  House,
  Settings,
  UserRound,
} from "lucide-react";

const NAVBAR_ICONS = {
  Home: House,
  Notifications: Bell,
  Bookmarks: Bookmark,
  Settings,
  Profile: UserRound,
};

export default function NavBar({ items, isLoggedIn, onLogout }) {
  return (
    <aside className="sticky top-0 hidden h-screen border-r border-white/10 p-4 lg:block">
      <a href="#" className="mb-4 inline-flex items-center gap-3" aria-label="Farcaster Clone Home">
        <span className="grid h-7 w-7 place-items-center rounded-md text-xl font-semibold text-white">
          Mirag3
        </span>
      </a>

      <nav className="flex flex-col gap-1" aria-label="Main navigation">
        {items.map((item, index) => (
          (() => {
            const Icon = NAVBAR_ICONS[item] || Circle;

            return (
          <button
            key={item}
            type="button"
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
              index === 0
                ? "bg-white/10 text-white"
                : "text-zinc-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="text-base">{item}</span>
          </button>
            );
          })()
        ))}
      </nav>

      <div className="mt-6 px-1">
        {isLoggedIn ? (
          <button
            type="button"
            onClick={onLogout}
            className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
          >
            Logout
          </button>
        ) : (
          <a
            href="/auth"
            className="block w-full rounded-full border border-white/15 bg-white/5 px-4 py-2 text-center text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
          >
            Connect Wallet
          </a>
        )}
      </div>
    </aside>
  );
}
