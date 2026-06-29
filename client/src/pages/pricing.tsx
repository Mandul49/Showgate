import { useState } from "react";
import { useLocation } from "wouter";
import { useTheme } from "@/lib/theme";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, X, Zap, Loader2, Ticket, ArrowLeft } from "lucide-react";
import { isAuthenticated } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import sgLogo from "../assets/showgate-logo.png";

interface UpgradeStatus {
  tier: "free" | "pro";
  proExpiresAt: string | null;
  isPro: boolean;
}

interface PublicSettings {
  feePercent: number;
  proTicketFeePercent: number;
  proMonthlyNaira: number;
  proYearlyNaira: number;
}

type BillingCycle = "monthly" | "yearly";

function fmtNGN(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

export default function Pricing() {
  const { isLight } = useTheme();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [redirecting, setRedirecting] = useState(false);

  const authed = isAuthenticated();

  const { data: settings } = useQuery<PublicSettings>({
    queryKey: ["/api/settings/public"],
    staleTime: 60_000,
  });

  const { data: status } = useQuery<UpgradeStatus>({
    queryKey: ["/api/upgrade/status"],
    enabled: authed,
  });

  const upgradeMutation = useMutation({
    mutationFn: async (plan: BillingCycle) => {
      const res = await apiRequest("POST", "/api/upgrade/checkout", { plan });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Checkout failed");
      return data as { authorization_url: string };
    },
    onSuccess: (data) => {
      setRedirecting(true);
      window.location.href = data.authorization_url;
    },
    onError: (err: any) => {
      toast({ title: "Payment error", description: err.message, variant: "destructive" });
    },
  });

  function handleUpgrade() {
    if (!authed) { navigate("/login"); return; }
    upgradeMutation.mutate(billing);
  }

  const isPro = status?.isPro;
  const isPending = upgradeMutation.isPending || redirecting;

  const freeFee = settings?.feePercent ?? 2.5;
  const proFee = settings?.proTicketFeePercent ?? 2;
  const proMonthly = settings?.proMonthlyNaira ?? 12_000;
  const proYearly = settings?.proYearlyNaira ?? 120_000;
  const proMonthlyEquiv = Math.round(proYearly / 12);
  const proSaving = proMonthly * 12 - proYearly;

  const displayMonthly = billing === "monthly" ? proMonthly : proMonthlyEquiv;

  const freeFeatures = [
    "1 active event",
    "500 tickets per month",
    "Basic analytics",
    `${freeFee}% platform fee`,
    "Direct deposit via Paystack",
  ];
  const freeExcluded = ["Custom branding", "Priority support"];

  const proFeatures = [
    "Unlimited active events",
    "Unlimited tickets",
    "All payment providers",
    "Full analytics dashboard",
    `${proFee}% platform fee`,
    "Custom branding",
    "Priority support",
  ];

  const tableRows: { label: string; free: React.ReactNode; pro: React.ReactNode }[] = [
    { label: "Active events",     free: "1",           pro: "Unlimited" },
    { label: "Tickets per month", free: "500",         pro: "Unlimited" },
    { label: "Platform fee",      free: `${freeFee}%`, pro: `${proFee}%` },
    { label: "Payment methods",   free: "Paystack direct deposit", pro: "All providers" },
    { label: "Analytics",         free: "Basic",       pro: "Full dashboard" },
    { label: "Priority support",  free: <X className="w-4 h-4 text-zinc-700 mx-auto" />, pro: <Check className="w-4 h-4 text-green-400 mx-auto" /> },
    { label: "Custom branding",   free: <X className="w-4 h-4 text-zinc-700 mx-auto" />, pro: <Check className="w-4 h-4 text-green-400 mx-auto" /> },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-page)", color: "var(--text-main)" }}>
      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <header className="border-b border-zinc-900 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/dashboard")}>
            <div className="p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
              <Ticket className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-white font-black text-base">Showgate</span>
            <img src={sgLogo} alt="" className="inline-block h-[20px] w-auto ml-1.5 align-middle" />
          </div>
          <button
            onClick={() => navigate(authed ? "/dashboard" : "/")}
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {authed ? "Dashboard" : "Back"}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-14">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div
          className="text-center mb-12 rounded-2xl py-10 px-4"
          style={{ background: isLight ? "linear-gradient(to bottom, rgba(245,158,11,0.07), rgba(245,158,11,0.18))" : "transparent" }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-bold uppercase tracking-widest mb-5">
            <Zap className="w-3.5 h-3.5" /> Simple Pricing
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-4">
            Scale your events.<br />
            <span className="text-amber-400">Keep more revenue.</span>
          </h1>
          <p className="text-zinc-500 text-lg max-w-md mx-auto">
            Start free. Upgrade when you're ready to unlock {proFee}% fees and sell without limits.
          </p>
        </div>

        {/* ── Billing toggle ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-center mb-10">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 gap-1">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                billing === "monthly" ? "bg-amber-400 text-black" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                billing === "yearly" ? "bg-amber-400 text-black" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Yearly
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                billing === "yearly" ? "bg-black/20 text-black" : "bg-green-500/15 text-green-400"
              }`}>
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* ── Cards ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">

          {/* Free card */}
          <div className="p-7 rounded-2xl border border-zinc-800 bg-zinc-900/60 flex flex-col h-full">
            <div className="mb-6">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Free</div>
              <div className="text-4xl font-black mb-1">₦0</div>
              <div className="text-zinc-500 text-sm">forever</div>
            </div>

            <ul className="space-y-3 flex-1 mb-8">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  {f === "Direct deposit via Paystack" ? (
                    <span>
                      <span className="block">Direct deposit via Paystack</span>
                      <span className="block text-zinc-500 text-xs mt-0.5">Connect your bank account once and get paid directly.</span>
                    </span>
                  ) : f}
                </li>
              ))}
              {freeExcluded.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-600">
                  <X className="w-4 h-4 text-zinc-700 shrink-0" /> {f}
                </li>
              ))}
            </ul>

            <div className="w-full py-3 rounded-xl border border-zinc-700 text-zinc-500 text-sm font-semibold text-center">
              {isPro ? "Previous Plan" : "Current Plan"}
            </div>
          </div>

          {/* Pro card */}
          <div className="relative p-7 rounded-2xl border border-amber-500/40 bg-zinc-950 flex flex-col h-full overflow-hidden"
            style={{ boxShadow: "0 0 50px rgba(245,158,11,0.08)" }}>
            {/* Gradient top strip */}
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
              style={{ background: "linear-gradient(90deg, #f59e0b, #fde68a, #f59e0b)" }} />

            {/* Most Popular badge */}
            <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
              {isPro ? "Current Plan" : "Most Popular"}
            </div>

            <div className="mb-6">
              <div className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-2">Pro</div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-4xl font-black">{fmtNGN(displayMonthly)}</span>
                <span className="text-zinc-400 text-sm mb-1.5">/month</span>
              </div>
              {billing === "yearly" ? (
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <span className="text-[1.1rem] font-[800] text-white">{fmtNGN(proYearly)}/yr</span>
                  {proSaving > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
                      Save {fmtNGN(proSaving)}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <span className="text-zinc-500 text-sm">or {fmtNGN(proYearly)}/yr</span>
                  {proSaving > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 text-xs font-bold">
                      Save {fmtNGN(proSaving)}
                    </span>
                  )}
                </div>
              )}
            </div>

            <ul className="space-y-3 flex-1 mb-8">
              {proFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-200">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" /> {f}
                </li>
              ))}
            </ul>

            {isPro ? (
              <div className="w-full py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-bold text-center">
                ✓ Active
                {status?.proExpiresAt && (
                  <span className="text-green-400/60 font-normal ml-2">
                    · renews {new Date(status.proExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
            ) : (
              <button
                onClick={handleUpgrade}
                disabled={isPending}
                className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-black font-black uppercase tracking-widest text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting to Paystack…</>
                ) : (
                  <><Zap className="w-4 h-4" /> Upgrade to Pro</>
                )}
              </button>
            )}
          </div>
        </div>

        {/* ── Comparison table (desktop only) ──────────────────────────────── */}
        <div className="hidden md:block bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-10">
          <div className="grid grid-cols-3 bg-zinc-950 border-b border-zinc-800 px-6 py-4">
            <span className="text-zinc-600 text-xs uppercase tracking-widest font-bold">Feature</span>
            <span className="text-zinc-500 text-xs uppercase tracking-widest font-bold text-center">Free</span>
            <span className="text-amber-400 text-xs uppercase tracking-widest font-bold text-center">Pro</span>
          </div>
          {tableRows.map((row, i) => (
            <div key={row.label}
              className={`grid grid-cols-3 px-6 py-4 ${i < tableRows.length - 1 ? "border-b border-zinc-800/60" : ""}`}>
              <span className="text-zinc-400 text-sm">{row.label}</span>
              <div className="flex justify-center items-center">
                {typeof row.free === "string"
                  ? <span className="text-zinc-300 font-medium text-sm">{row.free}</span>
                  : row.free}
              </div>
              <div className="flex justify-center items-center">
                {typeof row.pro === "string"
                  ? <span className="text-zinc-300 font-medium text-sm">{row.pro}</span>
                  : row.pro}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-zinc-700 text-xs">
          All payments secured by Paystack · Cancel anytime · No hidden charges
        </p>
      </div>
    </div>
  );
}
