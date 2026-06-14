import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getToken } from "@/lib/auth";
import {
  Users, Calendar, Ticket, Crown, ShieldCheck, Trash2,
  Search, LayoutDashboard, ChevronDown, ArrowLeft, Shield,
  TrendingUp, DollarSign, UserPlus, Activity, Settings,
  BarChart2, CreditCard,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdminLayout } from "@/components/admin-layout";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminStats {
  totalUsers: number;
  totalOrganizers: number;
  totalEvents: number;
  activeEvents: number;
  inactiveEvents: number;
  totalTicketsSold: number;
  totalRevenue: number;
  proUsers: number;
  monthlySubscriptionRevenue: number;
  newSignupsThisWeek: number;
  newSignupsThisMonth: number;
}

interface AdminChartData {
  signupsLast30Days: { date: string; count: number }[];
  ticketSalesLast30Days: { date: string; count: number }[];
}

interface AdminUser {
  id: string;
  email: string;
  role: string;
  tier: string;
  proExpiresAt: string | null;
  createdAt: string;
  businessName: string | null;
  eventCount: number;
}

interface AdminEvent {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  location: string;
  status: string;
  isActive: boolean;
  paymentMethod: string;
  maxTickets: number;
  createdAt: string;
  organizerId: string;
  businessName: string;
  ticketsSold: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function fmtNaira(kobo: number) {
  if (kobo === 0) return "₦0";
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}

function fmtChartDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function fmtEventDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.FC<any>;
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-5 flex items-center gap-2 sm:gap-4">
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
      </div>
      <div className="min-w-0">
        <p className="text-zinc-500 text-[10px] sm:text-xs uppercase tracking-widest mb-0.5 leading-tight">{label}</p>
        <p className="text-white font-bold text-base sm:text-xl leading-none">{value.toLocaleString()}</p>
        {sub && <p className="text-zinc-600 text-[10px] sm:text-xs mt-0.5 leading-tight">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Tier badge ───────────────────────────────────────────────────────────────

function TierBadge({ tier, proExpiresAt }: { tier: string; proExpiresAt: string | null }) {
  const isLifetime = tier === "pro" && !proExpiresAt;
  const isExpired = tier === "pro" && proExpiresAt && new Date(proExpiresAt) < new Date();
  if (tier === "free") return <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-[10px]">Free</Badge>;
  if (isLifetime) return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">Pro · Lifetime</Badge>;
  if (isExpired) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">Pro · Expired</Badge>;
  return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">Pro</Badge>;
}

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") return (
    <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-[10px] gap-1">
      <ShieldCheck className="w-3 h-3" /> Admin
    </Badge>
  );
  return <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-[10px]">Organizer</Badge>;
}

function StatusBadge({ status, isActive }: { status: string; isActive: boolean }) {
  if (!isActive) return <Badge className="bg-zinc-800 text-zinc-500 border-zinc-700 text-[10px]">Inactive</Badge>;
  if (status === "active") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Active</Badge>;
  if (status === "draft") return <Badge className="bg-zinc-700 text-zinc-300 border-zinc-600 text-[10px]">Draft</Badge>;
  return <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-[10px]">{status}</Badge>;
}

// ─── Users Table ──────────────────────────────────────────────────────────────

function UsersTable({ users, currentUserId, onRefresh }: {
  users: AdminUser[];
  currentUserId: string;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.email.toLowerCase().includes(q) ||
      (u.businessName?.toLowerCase().includes(q) ?? false)
    );
  }, [users, search]);

  const tierMutation = useMutation({
    mutationFn: ({ id, tier, lifetime }: { id: string; tier: string; lifetime?: boolean }) =>
      apiRequest("PATCH", `/api/admin/users/${id}/tier`, { tier, lifetime }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Tier updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiRequest("PATCH", `/api/admin/users/${id}/role`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Role updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "User deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by email or business name…"
          className="pl-9 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/50"
        />
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950">
                <th className="text-left px-4 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">Tier</th>
                <th className="text-left px-4 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">Events</th>
                <th className="text-left px-4 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-zinc-600">No users found</td>
                </tr>
              )}
              {filtered.map(user => (
                <tr key={user.id} className="bg-zinc-900 hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">
                        {user.email[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate max-w-[180px]">{user.email}</p>
                        {user.businessName && (
                          <p className="text-zinc-500 text-xs truncate max-w-[180px]">{user.businessName}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
                  <td className="px-4 py-3"><TierBadge tier={user.tier} proExpiresAt={user.proExpiresAt} /></td>
                  <td className="px-4 py-3 text-zinc-400 text-sm">{user.eventCount}</td>
                  <td className="px-4 py-3 text-zinc-500 text-sm whitespace-nowrap">{fmtDate(user.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-zinc-500 hover:text-white hover:bg-zinc-800">
                          Actions <ChevronDown className="w-3 h-3 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-white">
                        {user.tier === "free" ? (
                          <>
                            <DropdownMenuItem
                              className="text-amber-400 hover:bg-zinc-800 cursor-pointer"
                              onClick={() => tierMutation.mutate({ id: user.id, tier: "pro", lifetime: true })}
                            >
                              <Crown className="w-3.5 h-3.5 mr-2" /> Grant Lifetime Pro
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                              onClick={() => tierMutation.mutate({ id: user.id, tier: "pro", lifetime: false })}
                            >
                              <Crown className="w-3.5 h-3.5 mr-2" /> Grant Pro (1 year)
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem
                            className="text-zinc-400 hover:bg-zinc-800 cursor-pointer"
                            onClick={() => tierMutation.mutate({ id: user.id, tier: "free" })}
                          >
                            Revoke Pro
                          </DropdownMenuItem>
                        )}
                        {user.id !== currentUserId && (
                          <>
                            <DropdownMenuSeparator className="bg-zinc-800" />
                            {user.role === "organizer" ? (
                              <DropdownMenuItem
                                className="text-violet-400 hover:bg-zinc-800 cursor-pointer"
                                onClick={() => roleMutation.mutate({ id: user.id, role: "admin" })}
                              >
                                <Shield className="w-3.5 h-3.5 mr-2" /> Make Admin
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-zinc-400 hover:bg-zinc-800 cursor-pointer"
                                onClick={() => roleMutation.mutate({ id: user.id, role: "organizer" })}
                              >
                                Remove Admin
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator className="bg-zinc-800" />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  className="text-red-400 hover:bg-zinc-800 cursor-pointer"
                                  onSelect={e => e.preventDefault()}
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete User
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-white">Delete {user.email}?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-zinc-400">
                                    This permanently deletes the account, all their events, and ticket data. This cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700">Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                    onClick={() => deleteMutation.mutate(user.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-zinc-600 text-xs mt-3 text-right">{filtered.length} of {users.length} users</p>
    </div>
  );
}

// ─── Events Table ─────────────────────────────────────────────────────────────

function EventsTable({ events }: { events: AdminEvent[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return events;
    return events.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.businessName.toLowerCase().includes(q) ||
      e.location.toLowerCase().includes(q)
    );
  }, [events, search]);

  return (
    <div>
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title, organizer or location…"
          className="pl-9 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/50"
        />
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950">
                <th className="text-left px-4 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">Event</th>
                <th className="text-left px-4 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">Organizer</th>
                <th className="text-left px-4 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">Tickets</th>
                <th className="text-left px-4 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">Payment</th>
                <th className="text-left px-4 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-zinc-600">No events found</td>
                </tr>
              )}
              {filtered.map(ev => (
                <tr key={ev.id} className="bg-zinc-900 hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate max-w-[200px]">{ev.title}</p>
                      <p className="text-zinc-600 text-xs truncate max-w-[200px]">{ev.location}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-sm whitespace-nowrap">{ev.businessName}</td>
                  <td className="px-4 py-3 text-zinc-400 text-sm whitespace-nowrap">{fmtEventDate(ev.date)}</td>
                  <td className="px-4 py-3"><StatusBadge status={ev.status} isActive={ev.isActive} /></td>
                  <td className="px-4 py-3 text-zinc-400 text-sm">
                    <span className="text-white font-medium">{ev.ticketsSold}</span>
                    <span className="text-zinc-600">/{ev.maxTickets}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-zinc-500 text-xs capitalize">{ev.paymentMethod.replace("_", " ")}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-sm whitespace-nowrap">{fmtDate(ev.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-zinc-600 text-xs mt-3 text-right">{filtered.length} of {events.length} events</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"users" | "events">("users");

  const { data: me, isLoading: meLoading } = useQuery<{ id: string; email: string; role: string; tier: string }>({
    queryKey: ["/api/auth/me"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: me?.role === "admin",
  });

  const { data: charts } = useQuery<AdminChartData>({
    queryKey: ["/api/admin/charts"],
    enabled: me?.role === "admin",
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: me?.role === "admin",
  });

  const { data: adminEvents = [], isLoading: eventsLoading } = useQuery<AdminEvent[]>({
    queryKey: ["/api/admin/events"],
    enabled: me?.role === "admin",
  });

  const qc = useQueryClient();

  useEffect(() => {
    if (!meLoading && me && me.role !== "admin") {
      navigate("/dashboard");
    }
  }, [meLoading, me, navigate]);

  if (meLoading || !me) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (me.role !== "admin") return null;

  return (
    <AdminLayout>
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">

        {/* Stats row 1 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={LayoutDashboard} label="Organizers" value={stats?.totalOrganizers ?? "—"} />
          <StatCard
            icon={Calendar}
            label="Events"
            value={stats ? `${stats.activeEvents} active` : "—"}
            sub={stats ? `${stats.inactiveEvents} inactive · ${stats.totalEvents} total` : undefined}
          />
          <StatCard icon={Ticket} label="Tickets Sold" value={stats?.totalTicketsSold ?? "—"} />
          <StatCard icon={DollarSign} label="Total Revenue" value={stats ? fmtNaira(stats.totalRevenue) : "—"} />
        </div>

        {/* Stats row 2 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Crown} label="Pro Subscribers" value={stats?.proUsers ?? "—"} />
          <StatCard icon={TrendingUp} label="Sub Revenue (Month)" value={stats ? fmtNaira(stats.monthlySubscriptionRevenue) : "—"} />
          <StatCard icon={UserPlus} label="Signups This Week" value={stats?.newSignupsThisWeek ?? "—"} />
          <StatCard icon={Activity} label="Signups This Month" value={stats?.newSignupsThisMonth ?? "—"} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-xs uppercase tracking-widest mb-4">Signups — Last 30 Days</p>
            {charts ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={charts.signupsLast30Days.map(d => ({ ...d, label: fmtChartDate(d.date) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} interval={5} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 10 }} allowDecimals={false} width={28} />
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#a1a1aa" }}
                    itemStyle={{ color: "#fbbf24" }}
                  />
                  <Line type="monotone" dataKey="count" stroke="#fbbf24" strokeWidth={2} dot={false} name="Signups" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-xs uppercase tracking-widest mb-4">Ticket Sales — Last 30 Days</p>
            {charts ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={charts.ticketSalesLast30Days.map(d => ({ ...d, label: fmtChartDate(d.date) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} interval={5} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 10 }} allowDecimals={false} width={28} />
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#a1a1aa" }}
                    itemStyle={{ color: "#34d399" }}
                  />
                  <Line type="monotone" dataKey="count" stroke="#34d399" strokeWidth={2} dot={false} name="Tickets" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div>
          <div className="flex gap-1 border-b border-zinc-800 mb-6">
            {(["users", "events"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                  tab === t
                    ? "text-amber-400 border-amber-500"
                    : "text-zinc-500 border-transparent hover:text-zinc-300"
                }`}
              >
                {t === "users" ? `Users (${users.length})` : `Events (${adminEvents.length})`}
              </button>
            ))}
          </div>

          {tab === "users" && (
            usersLoading
              ? <div className="flex justify-center py-20"><div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
              : <UsersTable
                  users={users}
                  currentUserId={me.id}
                  onRefresh={() => qc.invalidateQueries({ queryKey: ["/api/admin/users"] })}
                />
          )}

          {tab === "events" && (
            eventsLoading
              ? <div className="flex justify-center py-20"><div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
              : <EventsTable events={adminEvents} />
          )}
        </div>
      </main>
    </AdminLayout>
  );
}
