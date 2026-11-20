import { CalendarDays, House, Search, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink } from "react-router";

const NAV_ITEMS = [
  { to: "/", label: "ホーム", icon: House },
  { to: "/search", label: "地域検索", icon: Search },
  { to: "/calendar", label: "カレンダー", icon: CalendarDays },
  { to: "/settings", label: "設定", icon: Settings },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-blue-50 to-green-50 text-slate-800">
      <header className="sticky top-0 z-10 border-slate-200 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="font-bold text-lg text-slate-900">
            ツーリング日和指数
          </Link>
          <nav aria-label="メイン" className="flex gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                <Icon aria-hidden className="size-4" />
                <span className="max-sm:sr-only">{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>

      <footer className="border-slate-200 border-t bg-white/70">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-slate-600 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            天気情報は参考用です。ツーリング前には必ず公式の気象情報をご確認ください。
          </p>
          <ul className="flex flex-wrap gap-4">
            <li>
              <Link to="/terms" className="hover:underline">
                利用規約
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:underline">
                プライバシーポリシー
              </Link>
            </li>
            <li>
              <a
                href="https://open-meteo.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                Open-Meteo
              </a>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
