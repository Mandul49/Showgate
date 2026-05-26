import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, Users, CreditCard, CalendarDays, BarChart2,
  AlertTriangle, Globe, LogOut, Search, Copy, Check, ChevronRight,
  TrendingUp, Crown, Ticket, DollarSign, ShieldOff, ShieldCheck,
  ArrowUpRight, X, ExternalLink, Zap, MoreHorizontal
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type AdminPage = "overview" | "organizers" | "subscriptions" | "events" | "analytics" | "support";

interface OrganizerRow {
  id: string; userId: string; businessName: string; email: string;
  subaccountCode: string | null; tier: string; createdAt: string;
  suspended: boolean; activeEventCount: number; ticketsSold: number; revenueProcessed: number;
}

interface SubscriptionRow {
  userId: string; email: string; businessName: string | null;
  plan: string; startedAt: string | null; expiresAt: string | null;
  amountKobo: number; status: "active" | "cancelled" | "expired";
}

interface EventRow {
  id: string; title: string; date: string; status: string; isActive: boolean;
  maxTickets: number; organizerId: string; organizerName: string;
  ticketsSold: number; revenue: number;
}

interface SupportFlag {
  key: string; type: string; description: string; entityId: string;
  createdAt: string; note: string | null; resolved: boolean;
}

interface MonthlyPoint {
  month: string; label: string;
  ticketFees?: number; subRevenue?: number; total?: number;
  signups?: number; sales?: number; revenue?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtMoney = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;

const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const fmtNum = (n: number) => n.toLocaleString("en-NG");

function TierBadge({ tier }: { tier: string }) {
  return tier === "pro" ? (
    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/30 whitespace-nowrap">Pro</span>
  ) : (
    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700 whitespace-nowrap">Free</span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    cancelled: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    expired: "bg-zinc-800 text-zinc-500 border-zinc-700",
  };
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${map[status] ?? map.expired}`}>
      {status}
    </span>
  );
}

function StatCard({ label, value, sub, icon: Icon, accent }: { label: string; value: string; sub?: string; icon: any; accent?: boolean }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-zinc-500 text-xs uppercase tracking-widest">{label}</p>
        <div className={`p-2 rounded-lg ${accent ? "bg-amber-400/10" : "bg-zinc-800"}`}>
          <Icon className={`w-4 h-4 ${accent ? "text-amber-400" : "text-zinc-500"}`} />
        </div>
      </div>
      <p className="text-white text-2xl font-black">{value}</p>
      {sub && <p className="text-zinc-600 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function BarChart({ data, getVal, getLabel, color = "#f59e0b", height = 80 }: {
  data: any[]; getVal: (d: any) => number; getLabel: (d: any) => string; color?: string; height?: number;
}) {
  const max = Math.max(...data.map(getVal), 1);
  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {data.map((item, i) => {
        const pct = (getVal(item) / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
            <div className="w-full rounded-sm" style={{ height: `${pct}%`, backgroundColor: color, minHeight: getVal(item) > 0 ? 2 : 0 }} />
            <span className="text-zinc-700 text-[7px] truncate w-full text-center">{getLabel(item)}</span>
          </div>
        );
      })}
    </div>
  );
}

function StackedBarChart({ data, height = 100 }: { data: MonthlyPoint[]; height?: number }) {
  const max = Math.max(...data.map((d) => d.total ?? 0), 1);
  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {data.map((item, i) => {
        const totalPct = ((item.total ?? 0) / max) * 100;
        const feePct = (item.total ?? 0) > 0 ? ((item.ticketFees ?? 0) / (item.total ?? 1)) * 100 : 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5" title={`${item.label}: ${fmtMoney(item.total ?? 0)}`}>
            <div className="w-full flex flex-col justify-end rounded-sm overflow-hidden" style={{ height: `${totalPct}%`, minHeight: (item.total ?? 0) > 0 ? 4 : 0 }}>
              <div style={{ height: `${feePct}%`, backgroundColor: "#f59e0b", minHeight: (item.ticketFees ?? 0) > 0 ? 1 : 0 }} />
              <div style={{ height: `${100 - feePct}%`, backgroundColor: "#6366f1", minHeight: (item.subRevenue ?? 0) > 0 ? 1 : 0 }} />
            </div>
            <span className="text-zinc-700 text-[7px] truncate w-full text-center">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-1 text-zinc-600 hover:text-zinc-400 transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, path: "/admin/dashboard" },
  { id: "organizers", label: "Organizers", icon: Users, path: "/admin/organizers" },
  { id: "subscriptions", label: "Subscriptions", icon: CreditCard, path: "/admin/subscriptions" },
  { id: "events", label: "Events", icon: CalendarDays, path: "/admin/events" },
  { id: "analytics", label: "Analytics", icon: BarChart2, path: "/admin/analytics" },
  { id: "support", label: "Support", icon: AlertTriangle, path: "/admin/support" },
] as const;

function AdminSidebar({ page, onNavigate }: { page: AdminPage; onNavigate: (p: AdminPage) => void }) {
  return (
    <div className="w-52 shrink-0 bg-zinc-950 border-r border-zinc-900 flex flex-col min-h-screen sticky top-0">
      <div className="px-4 py-5 border-b border-zinc-900">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="p-1.5 bg-amber-400/10 border border-amber-400/20 rounded-lg">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <span className="text-white font-black text-sm tracking-tight">Showgate</span>
        </div>
        <p className="text-zinc-600 text-[10px] uppercase tracking-widest ml-0.5">Platform Admin</p>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = page === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id as AdminPage)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                active
                  ? "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="px-2 py-3 border-t border-zinc-900 space-y-0.5">
        <a
          href="/"
          target="_blank"
          rel="noopener"
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900 transition-all"
        >
          <Globe className="w-4 h-4 shrink-0" />
          View Live Site
          <ExternalLink className="w-3 h-3 ml-auto" />
        </a>
        <button
          onClick={() => { localStorage.clear(); window.location.href = "/login"; }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-600 hover:text-red-400 hover:bg-zinc-900 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Log out
        </button>
      </div>
    </div>
  );
}

// ── Overview Page ─────────────────────────────────────────────────────────────

function OverviewPage() {
  const { data, isLoading } = useQuery<{
    totalOrganizers: number; activeProSubscribers: number; totalEvents: number;
    totalTicketsSold: number; platformFeeRevenue: number; subscriptionRevenue: number;
    monthlyRevenue: MonthlyPoint[];
  }>({ queryKey: ["/api/admin/overview"] });

  if (isLoading) return <PageLoader />;

  const cards = [
    { label: "Total Organizers", value: fmtNum(data?.totalOrganizers ?? 0), icon: Users },
    { label: "Active Pro Subscribers", value: fmtNum(data?.activeProSubscribers ?? 0), icon: Crown, accent: true },
    { label: "All-Time Events", value: fmtNum(data?.totalEvents ?? 0), icon: CalendarDays },
    { label: "All-Time Tickets Sold", value: fmtNum(data?.totalTicketsSold ?? 0), icon: Ticket },
    { label: "Ticket Fee Revenue", value: fmtMoney(data?.platformFeeRevenue ?? 0), icon: TrendingUp, accent: true },
    { label: "Subscription Revenue", value: fmtMoney(data?.subscriptionRevenue ?? 0), icon: DollarSign, accent: true },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Overview" sub="Platform-wide stats" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-sm">Monthly Revenue — Last 12 Months</h3>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Ticket Fees</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />Subscriptions</span>
          </div>
        </div>
        <StackedBarChart data={data?.monthlyRevenue ?? []} height={120} />
      </div>
    </div>
  );
}

// ── Organizers Page ───────────────────────────────────────────────────────────

function OrganizersPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: organizers = [], isLoading } = useQuery<OrganizerRow[]>({
    queryKey: ["/api/admin/organizers"],
  });

  const { data: detail } = useQuery<any>({
    queryKey: ["/api/admin/organizers", selected],
    enabled: !!selected,
  });

  const mutation = (path: string, invalidate = "/api/admin/organizers") =>
    useMutation({
      mutationFn: () => apiRequest("POST", path, {}),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/admin/organizers"] });
        toast({ title: "Done" });
      },
      onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

  const upgradeMut = mutation(`/api/admin/organizers/${selected}/upgrade-pro`);
  const downgradeMut = mutation(`/api/admin/organizers/${selected}/downgrade-free`);
  const suspendMut = mutation(`/api/admin/organizers/${selected}/suspend`);
  const reinstateMut = mutation(`/api/admin/organizers/${selected}/reinstate`);

  const filtered = organizers.filter(
    (o) => o.businessName.toLowerCase().includes(search.toLowerCase()) ||
      o.email.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <PageLoader />;

  const selectedOrg = organizers.find((o) => o.id === selected);

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Organizers" sub={`${organizers.length} total`} />
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
        />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              {["Name / Email", "Tier", "Joined", "Events", "Tickets", "Revenue", "Subaccount", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-zinc-500 text-xs uppercase tracking-wider font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {filtered.map((org) => (
              <tr key={org.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-semibold text-white">{org.businessName}</div>
                  <div className="text-zinc-500 text-xs">{org.email}</div>
                  {org.suspended && <span className="text-[10px] text-red-400 font-bold">SUSPENDED</span>}
                </td>
                <td className="px-4 py-3"><TierBadge tier={org.tier} /></td>
                <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{fmtDate(org.createdAt)}</td>
                <td className="px-4 py-3 text-zinc-300">{org.activeEventCount}</td>
                <td className="px-4 py-3 text-zinc-300">{fmtNum(org.ticketsSold)}</td>
                <td className="px-4 py-3 text-amber-400 font-medium">{fmtMoney(org.revenueProcessed)}</td>
                <td className="px-4 py-3">
                  {org.subaccountCode ? (
                    <span className="text-zinc-500 text-xs flex items-center gap-1">
                      {org.subaccountCode.slice(0, 12)}…
                      <CopyButton text={org.subaccountCode} />
                    </span>
                  ) : (
                    <span className="text-red-400 text-xs">Missing</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => setSelected(org.id)} className="text-zinc-500 hover:text-amber-400 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-600">No organizers found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && selectedOrg && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/70" onClick={() => setSelected(null)} />
          <div className="w-[500px] bg-zinc-950 border-l border-zinc-800 overflow-y-auto flex flex-col">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-950 z-10">
              <div>
                <h3 className="text-white font-bold">{selectedOrg.businessName}</h3>
                <p className="text-zinc-500 text-xs">{selectedOrg.email}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-zinc-600 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-4 space-y-5 flex-1">
              <div className="flex flex-wrap gap-2">
                {selectedOrg.tier === "free" ? (
                  <button onClick={() => upgradeMut.mutate()} disabled={upgradeMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold rounded-lg disabled:opacity-50 transition-colors">
                    <Crown className="w-3 h-3" /> Upgrade to Pro
                  </button>
                ) : (
                  <button onClick={() => downgradeMut.mutate()} disabled={downgradeMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors">
                    Downgrade to Free
                  </button>
                )}
                {selectedOrg.suspended ? (
                  <button onClick={() => reinstateMut.mutate()} disabled={reinstateMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/30 disabled:opacity-50 transition-colors">
                    <ShieldCheck className="w-3 h-3" /> Reinstate
                  </button>
                ) : (
                  <button onClick={() => suspendMut.mutate()} disabled={suspendMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-bold rounded-lg border border-red-500/30 disabled:opacity-50 transition-colors">
                    <ShieldOff className="w-3 h-3" /> Suspend
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Tier", <TierBadge tier={selectedOrg.tier} />],
                  ["Status", selectedOrg.suspended ? <span className="text-red-400 text-xs font-bold">Suspended</span> : <span className="text-emerald-400 text-xs">Active</span>],
                  ["Joined", fmtDate(selectedOrg.createdAt)],
                  ["Subaccount", selectedOrg.subaccountCode ? (
                    <span className="flex items-center gap-1 text-xs text-zinc-400">{selectedOrg.subaccountCode.slice(0, 16)}…<CopyButton text={selectedOrg.subaccountCode} /></span>
                  ) : <span className="text-red-400 text-xs">Not set</span>],
                ].map(([label, val], i) => (
                  <div key={i} className="bg-zinc-900 rounded-lg p-3">
                    <p className="text-zinc-600 text-[10px] uppercase tracking-wider mb-1">{label}</p>
                    <div className="text-white">{val}</div>
                  </div>
                ))}
              </div>

              {detail && (
                <>
                  <div>
                    <h4 className="text-zinc-400 text-xs uppercase tracking-wider mb-2">Events ({detail.events?.length ?? 0})</h4>
                    <div className="space-y-1.5">
                      {(detail.events ?? []).slice(0, 5).map((ev: any) => (
                        <div key={ev.id} className="flex items-center justify-between bg-zinc-900 rounded-lg px-3 py-2">
                          <span className="text-zinc-300 text-xs truncate">{ev.title}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-zinc-600 text-xs">{fmtDate(ev.date)}</span>
                            <a href={`/e/${ev.id}`} target="_blank" rel="noopener" className="text-zinc-600 hover:text-amber-400"><ExternalLink className="w-3 h-3" /></a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-zinc-400 text-xs uppercase tracking-wider mb-2">Recent Sales</h4>
                    <div className="space-y-1.5">
                      {(detail.recentSales ?? []).slice(0, 5).map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between bg-zinc-900 rounded-lg px-3 py-2">
                          <span className="text-zinc-300 text-xs">{s.customerName}</span>
                          <span className="text-amber-400 text-xs font-medium">{fmtMoney(s.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subscriptions Page ────────────────────────────────────────────────────────

function SubscriptionsPage() {
  const [tab, setTab] = useState<"all" | "active" | "cancelled" | "expired">("all");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{
    summary: { activeCount: number; mrrKobo: number; arrKobo: number; churnThisMonth: number };
    subscriptions: SubscriptionRow[];
  }>({ queryKey: ["/api/admin/subscriptions"] });

  const cancelMut = useMutation({
    mutationFn: (userId: string) => apiRequest("POST", `/api/admin/subscriptions/${userId}/cancel`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] }); toast({ title: "Subscription cancelled" }); },
  });

  const extendMut = useMutation({
    mutationFn: (userId: string) => apiRequest("POST", `/api/admin/subscriptions/${userId}/extend`, { days: 30 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] }); toast({ title: "Extended by 30 days" }); },
  });

  if (isLoading) return <PageLoader />;

  const subs = (data?.subscriptions ?? []).filter((s) => tab === "all" || s.status === tab);
  const s = data?.summary;

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Subscriptions" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Subscribers" value={fmtNum(s?.activeCount ?? 0)} icon={Crown} accent />
        <StatCard label="MRR" value={fmtMoney(s?.mrrKobo ?? 0)} icon={TrendingUp} accent />
        <StatCard label="ARR" value={fmtMoney(s?.arrKobo ?? 0)} icon={DollarSign} accent />
        <StatCard label="Churned This Month" value={fmtNum(s?.churnThisMonth ?? 0)} icon={AlertTriangle} />
      </div>

      <div className="flex gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl w-fit">
        {(["all", "active", "cancelled", "expired"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${tab === t ? "bg-amber-400 text-black" : "text-zinc-500 hover:text-zinc-300"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              {["Organizer", "Plan", "Started", "Expires", "Amount", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-zinc-500 text-xs uppercase tracking-wider font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {subs.map((s, i) => (
              <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{s.businessName ?? "—"}</div>
                  <div className="text-zinc-500 text-xs">{s.email}</div>
                </td>
                <td className="px-4 py-3 text-zinc-300 capitalize">{s.plan}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{fmtDate(s.startedAt)}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{s.expiresAt ? fmtDate(s.expiresAt) : <span className="text-amber-400 text-xs">Lifetime</span>}</td>
                <td className="px-4 py-3 text-amber-400 font-medium">{fmtMoney(s.amountKobo)}</td>
                <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => extendMut.mutate(s.userId)} disabled={extendMut.isPending}
                      className="text-xs text-zinc-400 hover:text-amber-400 transition-colors disabled:opacity-50">+30d</button>
                    {s.status === "active" && (
                      <button onClick={() => cancelMut.mutate(s.userId)} disabled={cancelMut.isPending}
                        className="text-xs text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-50">Cancel</button>
                    )}
                    <button onClick={() => { toast({ title: "Refund flagged", description: "This is a manual flag only — process the refund directly in Paystack." }); }}
                      className="text-xs text-zinc-600 hover:text-orange-400 transition-colors">Refund</button>
                  </div>
                </td>
              </tr>
            ))}
            {subs.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-600">No subscriptions found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Events Page ───────────────────────────────────────────────────────────────

function EventsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const { data: evts = [], isLoading } = useQuery<EventRow[]>({ queryKey: ["/api/admin/events"] });

  const suspendMut = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/events/${id}/suspend`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/events"] }); toast({ title: "Event suspended" }); },
  });

  const filtered = evts.filter(
    (e) => e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.organizerName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <PageLoader />;

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Events" sub={`${evts.length} total`} />
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events..."
          className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600" />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              {["Event", "Organizer", "Date", "Tickets Sold / Cap", "Revenue", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-zinc-500 text-xs uppercase tracking-wider font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {filtered.map((ev) => (
              <tr key={ev.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-3 text-white font-medium max-w-[200px] truncate">{ev.title}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{ev.organizerName}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{fmtDate(ev.date)}</td>
                <td className="px-4 py-3 text-zinc-300">{fmtNum(ev.ticketsSold)} / {fmtNum(ev.maxTickets)}</td>
                <td className="px-4 py-3 text-amber-400 font-medium">{fmtMoney(ev.revenue)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${
                    ev.isActive && ev.status === "active"
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : ev.status === "draft"
                        ? "bg-zinc-800 text-zinc-500 border-zinc-700"
                        : "bg-red-500/15 text-red-400 border-red-500/30"
                  }`}>
                    {ev.isActive ? ev.status : "inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <a href={`/e/${ev.id}`} target="_blank" rel="noopener" className="text-zinc-600 hover:text-amber-400 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    {ev.isActive && (
                      <button onClick={() => suspendMut.mutate(ev.id)} disabled={suspendMut.isPending}
                        className="text-xs text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-50">Suspend</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-600">No events found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Analytics Page ────────────────────────────────────────────────────────────

function AnalyticsPage() {
  const { data, isLoading } = useQuery<{
    monthlyData: (MonthlyPoint & { signups: number; sales: number; revenue: number })[];
    revenueBreakdown: { ticketFees: number; subscriptions: number };
    topEvents: { id: string; title: string; ticketsSold: number; revenue: number }[];
    topOrganizers: { id: string; businessName: string; revenue: number; tickets: number }[];
    avgTicketsPerEvent: number;
    conversionRate: number;
  }>({ queryKey: ["/api/admin/analytics"] });

  if (isLoading) return <PageLoader />;

  const breakdown = data?.revenueBreakdown ?? { ticketFees: 0, subscriptions: 0 };
  const totalRevenue = breakdown.ticketFees + breakdown.subscriptions;
  const feePct = totalRevenue > 0 ? (breakdown.ticketFees / totalRevenue) * 100 : 0;
  const subPct = 100 - feePct;
  const r = 36;
  const circ = 2 * Math.PI * r;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Analytics" />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Avg Tickets / Event" value={fmtNum(data?.avgTicketsPerEvent ?? 0)} icon={Ticket} />
        <StatCard label="Free → Pro Conversion" value={`${data?.conversionRate ?? 0}%`} icon={ArrowUpRight} accent />
        <StatCard label="Total Revenue" value={fmtMoney(totalRevenue)} icon={DollarSign} accent />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-bold text-sm mb-4">New Organizer Signups — Monthly</h3>
          <BarChart data={data?.monthlyData ?? []} getVal={(d) => d.signups} getLabel={(d) => d.label} color="#6366f1" height={100} />
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-bold text-sm mb-4">Ticket Sales Volume — Monthly</h3>
          <BarChart data={data?.monthlyData ?? []} getVal={(d) => d.sales} getLabel={(d) => d.label} color="#f59e0b" height={100} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col items-center justify-center">
          <h3 className="text-white font-bold text-sm mb-5 self-start">Revenue Breakdown</h3>
          <svg width="90" height="90" viewBox="0 0 90 90" className="mb-4">
            <circle cx="45" cy="45" r={r} fill="none" stroke="#27272a" strokeWidth="14" />
            {totalRevenue > 0 && <>
              <circle cx="45" cy="45" r={r} fill="none" stroke="#f59e0b" strokeWidth="14"
                strokeDasharray={`${(feePct / 100) * circ} ${circ}`}
                strokeDashoffset={circ / 4} />
              <circle cx="45" cy="45" r={r} fill="none" stroke="#6366f1" strokeWidth="14"
                strokeDasharray={`${(subPct / 100) * circ} ${circ}`}
                strokeDashoffset={circ / 4 - (feePct / 100) * circ} />
            </>}
          </svg>
          <div className="space-y-2 self-start w-full">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-zinc-400"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" />Ticket Fees</span>
              <span className="text-white font-medium">{feePct.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-zinc-400"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />Subscriptions</span>
              <span className="text-white font-medium">{subPct.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-bold text-sm mb-4">Top 5 Events by Tickets Sold</h3>
          <div className="space-y-2.5">
            {(data?.topEvents ?? []).map((ev, i) => (
              <div key={ev.id} className="flex items-center gap-3">
                <span className="text-zinc-700 text-xs w-3">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-300 text-xs truncate">{ev.title}</p>
                  <p className="text-zinc-600 text-[10px]">{fmtNum(ev.ticketsSold)} tickets</p>
                </div>
                <span className="text-amber-400 text-xs font-medium shrink-0">{fmtMoney(ev.revenue)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-bold text-sm mb-4">Top 5 Organizers by Revenue</h3>
          <div className="space-y-2.5">
            {(data?.topOrganizers ?? []).map((org, i) => (
              <div key={org.id} className="flex items-center gap-3">
                <span className="text-zinc-700 text-xs w-3">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-300 text-xs truncate">{org.businessName}</p>
                  <p className="text-zinc-600 text-[10px]">{fmtNum(org.tickets)} tickets</p>
                </div>
                <span className="text-amber-400 text-xs font-medium shrink-0">{fmtMoney(org.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Support Page ──────────────────────────────────────────────────────────────

function SupportPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: flags = [], isLoading } = useQuery<SupportFlag[]>({ queryKey: ["/api/admin/support"] });

  const noteMut = useMutation({
    mutationFn: ({ key, note, resolved }: { key: string; note: string; resolved: boolean }) =>
      apiRequest("POST", "/api/admin/support/note", { key, note, resolved }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/support"] }),
  });

  const typeLabel: Record<string, string> = {
    failed_subaccount: "Missing Subaccount",
    unverified_email: "Unverified Email",
    empty_active_event: "Empty Active Event",
    incomplete_onboarding: "Incomplete Onboarding",
  };

  const typeColor: Record<string, string> = {
    failed_subaccount: "text-red-400 bg-red-500/10 border-red-500/20",
    unverified_email: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    empty_active_event: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    incomplete_onboarding: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  };

  if (isLoading) return <PageLoader />;

  const open = flags.filter((f) => !f.resolved);
  const resolved = flags.filter((f) => f.resolved);

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Support & Flags" sub={`${open.length} open, ${resolved.length} resolved`} />
      {flags.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
          <p className="text-zinc-500 text-sm">No flags. All clear!</p>
        </div>
      )}
      {[...open, ...resolved].map((flag) => {
        const currentNote = notes[flag.key] ?? flag.note ?? "";
        return (
          <div key={flag.key} className={`bg-zinc-900 border border-zinc-800 rounded-xl p-4 ${flag.resolved ? "opacity-50" : ""}`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${typeColor[flag.type] ?? "text-zinc-400 bg-zinc-800 border-zinc-700"}`}>
                    {typeLabel[flag.type] ?? flag.type}
                  </span>
                  <span className="text-zinc-400 text-sm">{flag.description}</span>
                  <span className="text-zinc-700 text-xs ml-auto">{fmtDate(flag.createdAt)}</span>
                </div>
                <textarea
                  rows={2}
                  placeholder="Add a note..."
                  value={currentNote}
                  onChange={(e) => setNotes((p) => ({ ...p, [flag.key]: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 text-xs placeholder:text-zinc-700 focus:outline-none focus:border-zinc-700 resize-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => noteMut.mutate({ key: flag.key, note: currentNote, resolved: flag.resolved })}
                    disabled={noteMut.isPending}
                    className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors disabled:opacity-50"
                  >
                    Save Note
                  </button>
                  <button
                    onClick={() => noteMut.mutate({ key: flag.key, note: currentNote, resolved: !flag.resolved })}
                    disabled={noteMut.isPending}
                    className={`px-3 py-1 text-xs rounded-lg border transition-colors disabled:opacity-50 ${
                      flag.resolved
                        ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border-zinc-700"
                        : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/30"
                    }`}
                  >
                    {flag.resolved ? "Reopen" : "Mark Resolved"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────────

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center p-20">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-amber-400 rounded-full animate-spin" />
    </div>
  );
}

function PageHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h2 className="text-2xl font-black text-white">{title}</h2>
      {sub && <p className="text-zinc-600 text-sm mt-0.5">{sub}</p>}
    </div>
  );
}

function pageFromPath(path: string): AdminPage {
  if (path.startsWith("/admin/organizers")) return "organizers";
  if (path.startsWith("/admin/subscriptions")) return "subscriptions";
  if (path.startsWith("/admin/events")) return "events";
  if (path.startsWith("/admin/analytics")) return "analytics";
  if (path.startsWith("/admin/support")) return "support";
  return "overview";
}

// ── Main Export ───────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const [location, navigate] = useLocation();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.role !== "admin") { navigate("/login"); return; }
    } catch {
      navigate("/login"); return;
    }
    setAuthChecked(true);
  }, []);

  const page = pageFromPath(location);

  const handleNavigate = (p: AdminPage) => {
    const paths: Record<AdminPage, string> = {
      overview: "/admin/dashboard",
      organizers: "/admin/organizers",
      subscriptions: "/admin/subscriptions",
      events: "/admin/events",
      analytics: "/admin/analytics",
      support: "/admin/support",
    };
    navigate(paths[p]);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <AdminSidebar page={page} onNavigate={handleNavigate} />
      <main className="flex-1 overflow-y-auto min-h-screen">
        {page === "overview" && <OverviewPage />}
        {page === "organizers" && <OrganizersPage />}
        {page === "subscriptions" && <SubscriptionsPage />}
        {page === "events" && <EventsPage />}
        {page === "analytics" && <AnalyticsPage />}
        {page === "support" && <SupportPage />}
      </main>
    </div>
  );
}
