import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, BarChart2, TrendingUp, Ticket, DollarSign,
  Users, Download, Crown, Lock, Calendar, MapPin,
  RefreshCw, ExternalLink, Tag
} from "lucide-react";
import { isAuthenticated } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TicketTypeSummary {
  id: string;
  name: string;
  price: number;
  quantityAvailable: number;
  groupSize: number;
  groupLabel: string | null;
  sold: number;
  remaining: number;
  revenue: number;
  pct: number;
}

interface DiscountStat {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  timesUsed: number;
  usageLimit: number | null;
  totalDiscountGiven: number;
  expiresAt: string | null;
}

interface AnalyticsData {
  tier: "free" | "pro";
  event: {
    id: string;
    title: string;
    date: string;
    location: string;
    paymentMethod: string;
    maxTickets: number;
    isActive: boolean;
  };
  totalSold: number;
  totalRevenue: number;
  totalDiscountGiven: number;
  remaining: number;
  ticketTypeSummary: TicketTypeSummary[];
  discountStats: DiscountStat[];
  // Pro only
  salesOverTime?: { date: string; count: number; revenue: number }[];
  uniqueBuyers?: number;
  repeatBuyers?: number;
  recentBuyers?: {
    name: string;
    email: string;
    phone: string;
    ticketType: string;
    quantity: number;
    amount: number;
    discountCode: string | null;
    discountAmount: number;
    attendeeDetails: { name: string; email?: string }[];
    reference: string;
    date: string;
    status: string;
  }[];
  allEventsSummary?: {
    id: string;
    title: string;
    date: string;
    isActive: boolean;
    totalSold: number;
    totalRevenue: number;
  }[];
}

declare global {
  interface Window { Chart: any; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return "₦" + new Intl.NumberFormat("en-NG", { minimumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return d; }
}

function fmtShortDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
  catch { return iso; }
}

// ─── Chart hook ───────────────────────────────────────────────────────────────

function useChartJs(cb: () => void, deps: any[]) {
  useEffect(() => {
    if (window.Chart) { cb(); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js";
    script.onload = cb;
    document.head.appendChild(script);
  }, deps);
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, sub, color = "text-amber-400" }: {
  icon: any; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-zinc-500 text-xs uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
      {sub && <p className="text-zinc-600 text-xs mt-1">{sub}</p>}
    </div>
  );
}

// ─── Pro gate banner ──────────────────────────────────────────────────────────

function ProGate() {
  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-6 text-center">
      <div className="w-12 h-12 rounded-full bg-violet-400/10 border border-violet-400/20 flex items-center justify-center mx-auto mb-4">
        <Crown className="w-6 h-6 text-violet-400" />
      </div>
      <h3 className="text-white font-bold mb-1">Pro Analytics</h3>
      <p className="text-zinc-500 text-sm mb-4">
        Upgrade to Pro to unlock revenue charts, buyer demographics, CSV export, and multi-event comparison.
      </p>
      <a href="/pricing"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-400 text-white text-sm font-bold transition-colors">
        <Crown className="w-4 h-4" /> Upgrade to Pro
      </a>
    </div>
  );
}

// ─── Revenue over time chart ──────────────────────────────────────────────────

function RevenueChart({ data }: { data: { date: string; count: number; revenue: number }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useChartJs(() => {
    if (!canvasRef.current || !data.length) return;
    if (chartRef.current) { chartRef.current.destroy(); }

    chartRef.current = new window.Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: data.map((d) => fmtShortDate(d.date)),
        datasets: [
          {
            label: "Revenue (₦)",
            data: data.map((d) => d.revenue),
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245,158,11,0.08)",
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: "#f59e0b",
            tension: 0.3,
            fill: true,
            yAxisID: "y",
          },
          {
            label: "Tickets sold",
            data: data.map((d) => d.count),
            borderColor: "#6366f1",
            backgroundColor: "rgba(99,102,241,0.06)",
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: "#6366f1",
            tension: 0.3,
            fill: true,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { color: "#a1a1aa", font: { size: 11 } } },
          tooltip: {
            backgroundColor: "#18181b",
            borderColor: "#3f3f46",
            borderWidth: 1,
            titleColor: "#fff",
            bodyColor: "#a1a1aa",
            callbacks: {
              label: (ctx: any) =>
                ctx.datasetIndex === 0
                  ? ` Revenue: ${fmtMoney(ctx.raw)}`
                  : ` Tickets: ${ctx.raw}`,
            },
          },
        },
        scales: {
          x: { ticks: { color: "#52525b", font: { size: 10 } }, grid: { color: "#27272a" } },
          y: {
            position: "left",
            ticks: { color: "#52525b", font: { size: 10 }, callback: (v: number) => "₦" + v.toLocaleString() },
            grid: { color: "#27272a" },
          },
          y1: {
            position: "right",
            ticks: { color: "#52525b", font: { size: 10 } },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
  }, [data]);

  useEffect(() => () => { chartRef.current?.destroy(); }, []);

  if (!data.length) return (
    <div className="h-48 flex items-center justify-center text-zinc-600 text-sm">
      No sales recorded yet
    </div>
  );

  return <canvas ref={canvasRef} style={{ height: 220 }} />;
}

// ─── Ticket type doughnut ─────────────────────────────────────────────────────

function TypeDoughnut({ types }: { types: TicketTypeSummary[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  const COLORS = ["#f59e0b", "#6366f1", "#22c55e", "#ef4444", "#06b6d4", "#ec4899", "#84cc16", "#f97316"];

  useChartJs(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) { chartRef.current.destroy(); }

    const withSales = types.filter((t) => t.sold > 0);
    if (!withSales.length) return;

    chartRef.current = new window.Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels: withSales.map((t) => t.name),
        datasets: [{
          data: withSales.map((t) => t.sold),
          backgroundColor: withSales.map((_, i) => COLORS[i % COLORS.length]),
          borderColor: "#18181b",
          borderWidth: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { color: "#a1a1aa", font: { size: 11 }, padding: 12 } },
          tooltip: {
            backgroundColor: "#18181b",
            borderColor: "#3f3f46",
            borderWidth: 1,
            titleColor: "#fff",
            bodyColor: "#a1a1aa",
            callbacks: {
              label: (ctx: any) => ` ${ctx.label}: ${ctx.raw} tickets`,
            },
          },
        },
        cutout: "65%",
      },
    });
  }, [types]);

  useEffect(() => () => { chartRef.current?.destroy(); }, []);

  const hasSales = types.some((t) => t.sold > 0);
  if (!hasSales) return (
    <div className="h-48 flex items-center justify-center text-zinc-600 text-sm">
      No sales yet
    </div>
  );

  return <canvas ref={canvasRef} style={{ height: 220 }} />;
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(buyers: AnalyticsData["recentBuyers"], eventTitle: string) {
  if (!buyers?.length) return;
  const header = ["Name", "Email", "Phone", "Ticket Type", "Quantity", "Amount (₦)", "Reference", "Date", "Status"];
  const rows = buyers.map((b) => [
    b.name, b.email, b.phone, b.ticketType,
    b.quantity, b.amount,
    b.reference,
    new Date(b.date).toLocaleString("en-GB"),
    b.status,
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${eventTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_buyers.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadPurchasesCSV(eventId: string) {
  const token = localStorage.getItem("authToken");
  const res = await fetch(`/api/organizer/events/${eventId}/purchases/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : "purchases.csv";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Analytics page ───────────────────────────────────────────────────────────

export default function Analytics() {
  const { eventId } = useParams<{ eventId: string }>();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAuthenticated()) navigate("/login");
  }, []);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<AnalyticsData, Error>({
    queryKey: ["/api/analytics", eventId],
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`/api/analytics/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    enabled: !!eventId,
    refetchInterval: 60000,
  });

  if (isLoading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex items-center gap-3 text-zinc-500">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-amber-400 rounded-full animate-spin" />
        Loading analytics…
      </div>
    </div>
  );

  if (isError || !data) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center">
        <p className="text-zinc-400 mb-2">Could not load analytics for this event.</p>
        {error?.message && (
          <p className="text-red-400 text-sm mb-4 font-mono bg-red-400/5 border border-red-400/20 rounded px-3 py-2">{error.message}</p>
        )}
        <a href="/dashboard" className="text-amber-400 text-sm hover:underline">← Back to dashboard</a>
      </div>
    </div>
  );

  const isPro = data.tier === "pro";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Navbar */}
      <div className="border-b border-zinc-800 bg-zinc-900 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a href="/dashboard"
              className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </a>
            <span className="text-zinc-700">/</span>
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-amber-400" />
              <span className="text-white font-semibold text-sm truncate max-w-[200px]">{data.event.title}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadPurchasesCSV(eventId!)}
              title="Download all ticket purchases as CSV"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-semibold text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download CSV</span>
            </button>
            {isPro && data.recentBuyers && data.recentBuyers.length > 0 && (
              <button
                onClick={() => exportCSV(data.recentBuyers, data.event.title)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-semibold text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-semibold text-zinc-400 hover:text-white transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <a href={`/e/${data.event.id}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-semibold text-zinc-400 hover:text-amber-400 hover:border-amber-400/30 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">View event</span>
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Event info strip */}
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">{data.event.title}</h1>
            <div className="flex items-center gap-4 mt-1">
              <span className="flex items-center gap-1.5 text-zinc-500 text-xs">
                <Calendar className="w-3.5 h-3.5" /> {fmtDate(data.event.date)}
              </span>
              <span className="flex items-center gap-1.5 text-zinc-500 text-xs">
                <MapPin className="w-3.5 h-3.5" /> {data.event.location}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                data.event.isActive
                  ? "bg-green-400/10 text-green-400 border-green-400/20"
                  : "bg-zinc-800 text-zinc-500 border-zinc-700"
              }`}>
                {data.event.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
          {isPro && (
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border bg-violet-400/10 text-violet-400 border-violet-400/20">
              Pro Analytics
            </span>
          )}
        </div>

        {/* ── Key metrics ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <MetricCard
            icon={Ticket}
            label="Tickets sold"
            value={data.totalSold.toLocaleString()}
            sub={`of ${data.event.maxTickets} max`}
            color="text-amber-400"
          />
          <MetricCard
            icon={DollarSign}
            label="Total revenue"
            value={fmtMoney(data.totalRevenue)}
            color="text-green-400"
          />
          <MetricCard
            icon={Ticket}
            label="Remaining"
            value={data.remaining.toLocaleString()}
            sub="tickets available"
            color="text-zinc-400"
          />
          {isPro && (
            <>
              <MetricCard
                icon={Users}
                label="Unique buyers"
                value={(data.uniqueBuyers ?? 0).toLocaleString()}
                color="text-blue-400"
              />
              <MetricCard
                icon={TrendingUp}
                label="Avg per buyer"
                value={data.uniqueBuyers ? fmtMoney(Math.round(data.totalRevenue / data.uniqueBuyers)) : "—"}
                color="text-violet-400"
              />
              <MetricCard
                icon={Users}
                label="Repeat buyers"
                value={(data.repeatBuyers ?? 0).toLocaleString()}
                sub="bought more than once"
                color="text-pink-400"
              />
            </>
          )}
        </div>

        {/* ── Ticket type breakdown ── */}
        <div>
          <h2 className="text-white font-bold mb-4 flex items-center gap-2">
            <Ticket className="w-4 h-4 text-amber-400" /> Sales by Ticket Type
          </h2>
          {data.ticketTypeSummary.length === 0 ? (
            <p className="text-zinc-600 text-sm">No ticket types configured.</p>
          ) : (
            <div className="space-y-3">
              {data.ticketTypeSummary.map((tt) => (
                <div key={tt.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                      <span className="text-white font-semibold text-sm">{tt.name}</span>
                      <span className="text-zinc-500 text-xs">₦{tt.price.toLocaleString()} each</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-right">
                      <span className="text-zinc-400">{tt.sold} / {tt.quantityAvailable} sold</span>
                      <span className="text-amber-400 font-bold">{fmtMoney(tt.revenue)}</span>
                      <span className="text-zinc-600 w-8">{tt.pct}%</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-500"
                      style={{ width: `${tt.quantityAvailable > 0 ? (tt.sold / tt.quantityAvailable) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Discount codes ── */}
        {data.discountStats.length > 0 && (
          <div>
            <h2 className="text-white font-bold mb-4 flex items-center gap-2">
              <Tag className="w-4 h-4 text-amber-400" /> Discount Codes
              {data.totalDiscountGiven > 0 && (
                <span className="ml-auto text-zinc-500 text-sm font-normal">
                  Total discounted: <span className="text-amber-400 font-semibold">{fmtMoney(data.totalDiscountGiven)}</span>
                </span>
              )}
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      {["Code", "Type", "Value", "Uses", "Discount Given", "Expires"].map((h) => (
                        <th key={h} className="text-left text-zinc-500 text-xs uppercase tracking-widest px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {data.discountStats.map((dc) => (
                      <tr key={dc.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-mono font-semibold">{dc.code}</td>
                        <td className="px-4 py-3 text-zinc-400 text-xs capitalize">{dc.type}</td>
                        <td className="px-4 py-3 text-amber-400 font-semibold text-xs">
                          {dc.type === "percent" ? `${dc.value}%` : `₦${dc.value.toLocaleString()}`}
                        </td>
                        <td className="px-4 py-3 text-zinc-300 text-xs">
                          {dc.timesUsed}
                          {dc.usageLimit ? <span className="text-zinc-600"> / {dc.usageLimit}</span> : ""}
                        </td>
                        <td className="px-4 py-3 text-green-400 font-semibold text-xs">{fmtMoney(dc.totalDiscountGiven)}</td>
                        <td className="px-4 py-3 text-zinc-500 text-xs">
                          {dc.expiresAt ? new Date(dc.expiresAt).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Pro: charts ── */}
        {isPro ? (
          <>
            {/* Revenue over time */}
            <div>
              <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400" /> Revenue Over Time
              </h2>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <RevenueChart data={data.salesOverTime ?? []} />
              </div>
            </div>

            {/* Sales by type doughnut */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-amber-400" /> Ticket Mix
                </h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <TypeDoughnut types={data.ticketTypeSummary} />
                </div>
              </div>

              {/* Recent buyers summary */}
              <div>
                <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" /> Recent Buyers
                </h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  {!data.recentBuyers?.length ? (
                    <div className="p-6 text-center text-zinc-600 text-sm">No purchases yet</div>
                  ) : (
                    <div className="divide-y divide-zinc-800">
                      {data.recentBuyers.slice(0, 6).map((b, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-3 gap-3">
                          <div className="min-w-0">
                            <p className="text-white text-sm font-semibold truncate">{b.name}</p>
                            <p className="text-zinc-500 text-xs truncate">{b.email}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-amber-400 text-xs font-bold">{fmtMoney(b.amount)}</p>
                            <p className="text-zinc-600 text-xs">{b.ticketType} × {b.quantity}</p>
                          </div>
                        </div>
                      ))}
                      {data.recentBuyers.length > 6 && (
                        <p className="text-zinc-600 text-xs text-center py-3">
                          +{data.recentBuyers.length - 6} more — export CSV to see all
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Full buyer table */}
            {data.recentBuyers && data.recentBuyers.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-bold flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" /> All Buyers
                    <span className="text-zinc-600 text-sm font-normal">({data.recentBuyers.length})</span>
                  </h2>
                  <button
                    onClick={() => exportCSV(data.recentBuyers, data.event.title)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-zinc-300 transition-colors">
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </button>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800">
                          {["Buyer", "Email", "Ticket", "Qty", "Amount", "Date"].map((h) => (
                            <th key={h} className="text-left text-zinc-500 text-xs uppercase tracking-widest px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {data.recentBuyers.map((b, i) => (
                          <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{b.name}</td>
                            <td className="px-4 py-3 text-zinc-400 text-xs">{b.email}</td>
                            <td className="px-4 py-3 text-zinc-300 text-xs whitespace-nowrap">{b.ticketType}</td>
                            <td className="px-4 py-3 text-zinc-400 text-center">{b.quantity}</td>
                            <td className="px-4 py-3 text-amber-400 font-bold whitespace-nowrap">{fmtMoney(b.amount)}</td>
                            <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">{fmtShortDate(b.date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Multi-event comparison */}
            {data.allEventsSummary && data.allEventsSummary.length > 1 && (
              <div>
                <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-amber-400" /> All Events Comparison
                </h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800">
                          {["Event", "Date", "Status", "Tickets Sold", "Revenue"].map((h) => (
                            <th key={h} className="text-left text-zinc-500 text-xs uppercase tracking-widest px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {data.allEventsSummary.map((ev) => (
                          <tr
                            key={ev.id}
                            className={`hover:bg-zinc-800/30 transition-colors cursor-pointer ${ev.id === eventId ? "bg-amber-400/5" : ""}`}
                            onClick={() => navigate(`/analytics/${ev.id}`)}>
                            <td className="px-4 py-3 font-medium whitespace-nowrap">
                              <span className={ev.id === eventId ? "text-amber-400" : "text-white"}>{ev.title}</span>
                              {ev.id === eventId && <span className="ml-2 text-[10px] text-amber-400/60">← current</span>}
                            </td>
                            <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{fmtDate(ev.date)}</td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                                ev.isActive
                                  ? "bg-green-400/10 text-green-400 border-green-400/20"
                                  : "bg-zinc-800 text-zinc-500 border-zinc-700"
                              }`}>
                                {ev.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-zinc-300 text-center font-mono">{ev.totalSold}</td>
                            <td className="px-4 py-3 text-amber-400 font-bold whitespace-nowrap">{fmtMoney(ev.totalRevenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <ProGate />
        )}
      </div>
    </div>
  );
}
