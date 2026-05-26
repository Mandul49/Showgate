import { useLocation, Link } from "wouter";
import {
  LayoutDashboard, Users, CreditCard, Calendar, BarChart2,
  Settings, ArrowLeft, ShieldCheck,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Overview",      icon: LayoutDashboard, href: "/admin" },
  { label: "Organizers",    icon: Users,            href: "/admin/organizers" },
  { label: "Subscriptions", icon: CreditCard,       href: "/admin/subscriptions" },
  { label: "Events",        icon: Calendar,         href: "/admin/events" },
  { label: "Analytics",     icon: BarChart2,        href: "/admin/analytics" },
  { label: "Settings",      icon: Settings,         href: "/admin/settings" },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  function isActive(href: string) {
    if (href === "/admin") return location === "/admin";
    return location.startsWith(href);
  }

  return (
    <div className="flex min-h-screen bg-black">
      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside className="fixed top-0 left-0 h-screen w-56 bg-zinc-950 border-r border-zinc-800 flex flex-col z-40">
        {/* Logo */}
        <div className="px-5 pt-5 pb-4 border-b border-zinc-800">
          <span className="block text-white font-extrabold text-xl tracking-tight leading-none mb-2.5">
            Show<span className="text-amber-500">gate</span>
          </span>
          <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 rounded-md px-2 py-1">
            <ShieldCheck className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest leading-none">
              Admin
            </span>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                  active
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 border-transparent"
                }`}
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${active ? "text-amber-400" : "text-zinc-500"}`}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Back to main app */}
        <div className="px-3 py-4 border-t border-zinc-800">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors border border-transparent"
          >
            <ArrowLeft className="w-4 h-4 flex-shrink-0" />
            Back to main app
          </Link>
        </div>
      </aside>

      {/* ── Content area ─────────────────────────────────────────── */}
      <div className="flex-1 ml-56 min-h-screen text-zinc-100">
        {children}
      </div>
    </div>
  );
}
