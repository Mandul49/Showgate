import { useState } from "react";
import { useLocation, Link } from "wouter";
import {
  LayoutDashboard, Users, CreditCard, Calendar, BarChart2,
  Settings, ArrowLeft, ShieldCheck, UsersRound, Menu, X,
} from "lucide-react";
import { getUser } from "@/lib/auth";
import sgLogo from "../assets/showgate-logo.png";

type AdminRole = "super_admin" | "admin" | "support" | "finance";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  roles: AdminRole[] | null;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview",      icon: LayoutDashboard, href: "/admin",               roles: null },
  { label: "Organizers",    icon: Users,            href: "/admin/organizers",    roles: ["super_admin", "admin", "support"] },
  { label: "Subscriptions", icon: CreditCard,       href: "/admin/subscriptions", roles: ["super_admin", "finance"] },
  { label: "Events",        icon: Calendar,         href: "/admin/events",        roles: ["super_admin", "admin", "support"] },
  { label: "Analytics",     icon: BarChart2,        href: "/admin/analytics",     roles: ["super_admin", "finance"] },
  { label: "Settings",      icon: Settings,         href: "/admin/settings",      roles: ["super_admin"] },
  { label: "Team",          icon: UsersRound,       href: "/admin/team",          roles: ["super_admin"] },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentUser = getUser();
  const rawRoles = currentUser?.adminRole;
  const adminRoles: AdminRole[] = Array.isArray(rawRoles)
    ? (rawRoles as AdminRole[])
    : rawRoles ? [(rawRoles as unknown) as AdminRole] : [];

  function isActive(href: string) {
    if (href === "/admin") return location === "/admin";
    return location.startsWith(href);
  }

  const visibleItems = NAV_ITEMS.filter(item =>
    item.roles === null || adminRoles.some(r => item.roles!.includes(r))
  );

  function closeSidebar() { setSidebarOpen(false); }

  return (
    <div className="flex min-h-screen bg-black">

      {/* ── Mobile top bar ───────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 inset-x-0 h-14 bg-zinc-950 border-b border-zinc-800 flex items-center gap-3 px-4 z-50">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors -ml-1"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-white font-extrabold text-base tracking-tight leading-none">
          Show<span className="text-amber-500">gate</span>
          <img src={sgLogo} alt="" className="inline-block h-5 w-auto ml-1.5 align-middle" />
        </span>
        <div className="ml-auto inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/25 rounded-md px-2 py-1">
          <ShieldCheck className="w-3 h-3 text-amber-400" />
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest leading-none">Admin</span>
        </div>
      </div>

      {/* ── Backdrop (mobile) ─────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/70 z-40"
          onClick={closeSidebar}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside
        className={[
          "fixed top-0 left-0 h-screen w-64 md:w-56",
          "bg-zinc-950 border-r border-zinc-800",
          "flex flex-col z-50",
          "transition-transform duration-200 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0",
        ].join(" ")}
      >
        {/* Logo + role badge */}
        <div className="px-5 pt-5 pb-4 border-b border-zinc-800 flex items-start justify-between gap-2">
          <div>
            <span className="block text-white font-extrabold text-xl tracking-tight leading-none mb-2.5">
              Show<span className="text-amber-500">gate</span>
              <img src={sgLogo} alt="" className="inline-block h-[24px] w-auto ml-2 align-middle" />
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 rounded-md px-2 py-1">
                <ShieldCheck className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest leading-none">Admin</span>
              </div>
              {adminRoles.length > 0 && (
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide leading-none">
                  {adminRoles.map(r => r.replace("_", " ")).join(" · ")}
                </span>
              )}
            </div>
          </div>
          {/* Close button – mobile only */}
          <button
            onClick={closeSidebar}
            className="md:hidden p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors flex-shrink-0 mt-0.5"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleItems.map(({ label, icon: Icon, href }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={closeSidebar}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                  active
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 border-transparent"
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-amber-400" : "text-zinc-500"}`} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Back to main app */}
        <div className="px-3 py-4 border-t border-zinc-800">
          <Link
            href="/dashboard"
            onClick={closeSidebar}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors border border-transparent"
          >
            <ArrowLeft className="w-4 h-4 flex-shrink-0" />
            Back to main app
          </Link>
        </div>
      </aside>

      {/* ── Content area ─────────────────────────────────────────────── */}
      <div className="flex-1 md:ml-56 min-h-screen text-zinc-100 pt-14 md:pt-0">
        {children}
      </div>
    </div>
  );
}
