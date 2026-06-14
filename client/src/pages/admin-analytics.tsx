import { useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  ShieldCheck, ArrowLeft, TrendingUp, Download, DollarSign,
  Ticket, Users, BarChart2, PieChartIcon, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminLayout } from "@/components/admin-layout";

interface AdminAnalyticsData {
  revenueByMonth: { month: string; subscriptionRevenue: number; ticketFeeRevenue: number }[];
  ticketsByMonth: { month: string; count: number; revenue: number }[];
  topEventsByTickets: { id: string; title: string; ticketsSold: number; revenue: number }[];
  topOrganizersByRevenue: { id: string; businessName: string; email: string; revenue: number; ticketsSold: number }[];
  subscriptionGrowth: { month: string; newSubscriptions: number; cumulative: number }[];
  tierRatio: { free: number; pro: number };
  avgTicketsPerEvent: number;
  totalTicketRevenue: number;
  totalSubscriptionRevenue: number;
}

function fmtK(kobo: number) {
  const naira = Math.round(kobo / 100);
  if (naira >= 1_000_000) return "₦" + (naira / 1_000_000).toFixed(1) + "M";
  if (naira >= 1_000) return "₦" + (naira / 1_000).toFixed(1) + "K";
  return "₦" + naira.toLocaleString("en-NG");
}

function fmtNaira(kobo: number) {
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}

function shortMonth(yyyyMM: string) {
  const [y, m] = yyyyMM.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return months[parseInt(m, 10) - 1] + " '" + y.slice(2);
}

const CHART_COLORS = {
  amber: "#f59e0b",
  sky: "#38bdf8",
  emerald: "#34d399",
  violet: "#a78bfa",
  rose: "#fb7185",
  zinc: "#71717a",
};

const tooltipStyle = {
  contentStyle: { background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#a1a1aa" },
  itemStyle: { color: "#f4f4f5" },
};

export default function AdminAnalytics() {
  const [, navigate] = useLocation();

  const { data: me, isLoading: meLoading } = useQuery<{ id: string; role: string }>({
    queryKey: ["/api/auth/me"],
  });

  useEffect(() => {
    if (!meLoading && me?.role !== "admin") navigate("/");
  }, [me, meLoading, navigate]);

  const { data, isLoading } = useQuery<AdminAnalyticsData>({
    queryKey: ["/api/admin/analytics"],
    enabled: me?.role === "admin",
  });

  const exportCSV = useCallback(() => {
    if (!data) return;
    const sections: string[] = [];

    sections.push("Revenue by Month");
    sections.push("Month,Subscription Revenue (₦),Ticket Fee Revenue (₦)");
    data.revenueByMonth.forEach(r =>
      sections.push(`${r.month},${Math.round(r.subscriptionRevenue / 100)},${Math.round(r.ticketFeeRevenue / 100)}`)
    );

    sections.push("");
    sections.push("Ticket Sales by Month");
    sections.push("Month,Tickets Sold,Gross Revenue (₦)");
    data.ticketsByMonth.forEach(r =>
      sections.push(`${r.month},${r.count},${Math.round(r.revenue / 100)}`)
    );

    sections.push("");
    sections.push("Top 5 Events by Tickets Sold");
    sections.push("Event,Tickets Sold,Revenue (₦)");
    data.topEventsByTickets.forEach(r =>
      sections.push(`"${r.title.replace(/"/g, '""')}",${r.ticketsSold},${Math.round(r.revenue / 100)}`)
    );

    sections.push("");
    sections.push("Top 5 Organizers by Revenue");
    sections.push("Business,Email,Revenue (₦),Tickets Sold");
    data.topOrganizersByRevenue.forEach(r =>
      sections.push(`"${r.businessName.replace(/"/g, '""')}","${r.email}",${Math.round(r.revenue / 100)},${r.ticketsSold}`)
    );

    sections.push("");
    sections.push("Subscription Growth");
    sections.push("Month,New Subscriptions,Cumulative");
    data.subscriptionGrowth.forEach(r =>
      sections.push(`${r.month},${r.newSubscriptions},${r.cumulative}`)
    );

    sections.push("");
    sections.push("Organizer Tier Breakdown");
    sections.push("Tier,Count");
    sections.push(`Free,${data.tierRatio.free}`);
    sections.push(`Pro,${data.tierRatio.pro}`);

    const blob = new Blob([sections.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `showgate-analytics-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  if (meLoading || isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const totalShowgateRevenue = data.totalSubscriptionRevenue + Math.round(data.totalTicketRevenue * 0.025);
  const pieData = [
    { name: "Free", value: data.tierRatio.free },
    { name: "Pro", value: data.tierRatio.pro },
  ];

  return (
    <AdminLayout>
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Title */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-50 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
              Platform Analytics
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">All-time platform performance and growth metrics</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            className="gap-1.5 text-xs bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 flex-shrink-0 mt-1"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<DollarSign className="w-4 h-4 text-amber-400" />}
            label="Showgate Revenue"
            value={fmtK(totalShowgateRevenue)}
            sub="subscriptions + 2.5% fees"
          />
          <StatCard
            icon={<TrendingUp className="w-4 h-4 text-sky-400" />}
            label="Subscription Revenue"
            value={fmtK(data.totalSubscriptionRevenue)}
            sub="all-time"
          />
          <StatCard
            icon={<Ticket className="w-4 h-4 text-emerald-400" />}
            label="Ticket Fee Revenue"
            value={fmtK(Math.round(data.totalTicketRevenue * 0.025))}
            sub="2.5% of gross ticket sales"
          />
          <StatCard
            icon={<Calendar className="w-4 h-4 text-violet-400" />}
            label="Avg Tickets / Event"
            value={data.avgTicketsPerEvent.toString()}
            sub="across all events"
          />
        </div>

        {/* Revenue breakdown charts — 2 side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Subscription Revenue" subtitle="Monthly (last 12 months)" icon={<TrendingUp className="w-4 h-4 text-sky-400" />}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.revenueByMonth.map(d => ({ ...d, label: shortMonth(d.month), sub: Math.round(d.subscriptionRevenue / 100) }))}>
                <defs>
                  <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.sky} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={CHART_COLORS.sky} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} tickFormatter={v => "₦" + (v >= 1000 ? (v/1000).toFixed(0)+"K" : v)} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => ["₦" + v.toLocaleString("en-NG"), "Revenue"]} />
                <Area type="monotone" dataKey="sub" stroke={CHART_COLORS.sky} fill="url(#subGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Ticket Fee Revenue" subtitle="Showgate's 2.5% cut, monthly" icon={<DollarSign className="w-4 h-4 text-amber-400" />}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.revenueByMonth.map(d => ({ ...d, label: shortMonth(d.month), fee: Math.round(d.ticketFeeRevenue / 100) }))}>
                <defs>
                  <linearGradient id="feeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.amber} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={CHART_COLORS.amber} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} tickFormatter={v => "₦" + (v >= 1000 ? (v/1000).toFixed(0)+"K" : v)} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => ["₦" + v.toLocaleString("en-NG"), "Fee Revenue"]} />
                <Area type="monotone" dataKey="fee" stroke={CHART_COLORS.amber} fill="url(#feeGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Ticket sales by month */}
        <ChartCard title="Ticket Sales" subtitle="Tickets sold per month — last 12 months" icon={<Ticket className="w-4 h-4 text-emerald-400" />}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.ticketsByMonth.map(d => ({ ...d, label: shortMonth(d.month) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [v, name === "count" ? "Tickets Sold" : "Revenue"]} />
              <Bar dataKey="count" fill={CHART_COLORS.emerald} radius={[3, 3, 0, 0]} maxBarSize={36} name="count" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Subscription growth */}
        <ChartCard title="Subscription Growth" subtitle="New subscriptions and cumulative total — last 12 months" icon={<TrendingUp className="w-4 h-4 text-violet-400" />}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.subscriptionGrowth.map(d => ({ ...d, label: shortMonth(d.month) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
              <Bar yAxisId="left" dataKey="newSubscriptions" name="New" fill={CHART_COLORS.violet} radius={[3, 3, 0, 0]} maxBarSize={32} />
              <Bar yAxisId="right" dataKey="cumulative" name="Cumulative" fill={CHART_COLORS.sky} radius={[3, 3, 0, 0]} maxBarSize={32} opacity={0.4} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top events + top organizers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Top 5 Events" subtitle="By tickets sold" icon={<Calendar className="w-4 h-4 text-amber-400" />}>
            {data.topEventsByTickets.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-zinc-600 text-sm">No event data yet</div>
            ) : (
              <div className="space-y-3 mt-2">
                {data.topEventsByTickets.map((ev, i) => {
                  const max = data.topEventsByTickets[0].ticketsSold || 1;
                  const pct = Math.round((ev.ticketsSold / max) * 100);
                  return (
                    <div key={ev.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300 truncate max-w-[200px] flex items-center gap-1.5">
                          <span className="text-zinc-600 font-mono w-4">{i + 1}.</span>
                          {ev.title}
                        </span>
                        <span className="text-zinc-400 tabular-nums ml-2 shrink-0">{ev.ticketsSold.toLocaleString()} tickets</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10px] text-zinc-600">{fmtNaira(ev.revenue)} gross revenue</div>
                    </div>
                  );
                })}
              </div>
            )}
          </ChartCard>

          <ChartCard title="Top 5 Organizers" subtitle="By revenue processed" icon={<Users className="w-4 h-4 text-sky-400" />}>
            {data.topOrganizersByRevenue.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-zinc-600 text-sm">No organizer data yet</div>
            ) : (
              <div className="space-y-3 mt-2">
                {data.topOrganizersByRevenue.map((org, i) => {
                  const max = data.topOrganizersByRevenue[0].revenue || 1;
                  const pct = Math.round((org.revenue / max) * 100);
                  return (
                    <div key={org.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300 truncate max-w-[200px] flex items-center gap-1.5">
                          <span className="text-zinc-600 font-mono w-4">{i + 1}.</span>
                          {org.businessName}
                        </span>
                        <span className="text-zinc-400 tabular-nums ml-2 shrink-0">{fmtK(org.revenue)}</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10px] text-zinc-600">{org.email} · {org.ticketsSold.toLocaleString()} tickets</div>
                    </div>
                  );
                })}
              </div>
            )}
          </ChartCard>
        </div>

        {/* Free vs Pro pie */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ChartCard title="Organizer Tiers" subtitle="Free vs Pro ratio" icon={<PieChartIcon className="w-4 h-4 text-rose-400" />}>
            <div className="flex items-center justify-center gap-8">
              <PieChart width={180} height={180}>
                <Pie
                  data={pieData}
                  cx={85}
                  cy={85}
                  innerRadius={52}
                  outerRadius={80}
                  dataKey="value"
                  strokeWidth={0}
                >
                  <Cell fill={CHART_COLORS.zinc} />
                  <Cell fill={CHART_COLORS.amber} />
                </Pie>
                <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [v, name]} />
              </PieChart>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-zinc-500" />
                  <span className="text-zinc-300">Free</span>
                  <span className="text-zinc-100 font-semibold tabular-nums ml-1">{data.tierRatio.free}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-zinc-300">Pro</span>
                  <span className="text-zinc-100 font-semibold tabular-nums ml-1">{data.tierRatio.pro}</span>
                </div>
                <div className="text-xs text-zinc-600 pt-1">
                  {data.tierRatio.free + data.tierRatio.pro > 0
                    ? Math.round((data.tierRatio.pro / (data.tierRatio.free + data.tierRatio.pro)) * 100)
                    : 0}% conversion
                </div>
              </div>
            </div>
          </ChartCard>

          {/* Summary numbers */}
          <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-zinc-200">All-Time Totals</span>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <SummaryRow label="Gross Ticket Revenue" value={fmtNaira(data.totalTicketRevenue)} />
              <SummaryRow label="Subscription Revenue" value={fmtNaira(data.totalSubscriptionRevenue)} />
              <SummaryRow label="Showgate Ticket Fees" value={fmtNaira(Math.round(data.totalTicketRevenue * 0.025))} highlight />
              <SummaryRow label="Total Showgate Revenue" value={fmtNaira(totalShowgateRevenue)} highlight />
              <SummaryRow label="Avg Tickets Per Event" value={data.avgTicketsPerEvent.toString()} />
              <SummaryRow label="Pro Conversion Rate"
                value={data.tierRatio.free + data.tierRatio.pro > 0
                  ? Math.round((data.tierRatio.pro / (data.tierRatio.free + data.tierRatio.pro)) * 100) + "%"
                  : "0%"} />
            </div>
          </div>
        </div>
      </main>
    </AdminLayout>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 sm:p-4 space-y-1">
      <div className="flex items-center gap-2 text-[10px] sm:text-xs text-zinc-500 mb-1 sm:mb-2">
        {icon}
        {label}
      </div>
      <div className="text-lg sm:text-2xl font-bold text-zinc-50 tabular-nums">{value}</div>
      <div className="text-[10px] text-zinc-600 leading-tight">{sub}</div>
    </div>
  );
}

function ChartCard({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-3">
      <div>
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-zinc-200">{title}</span>
        </div>
        <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${highlight ? "text-amber-400" : "text-zinc-200"}`}>{value}</span>
    </div>
  );
}
