import { useState } from "react";
import { useLocation } from "wouter";
import { ShowgateLogo } from "@/components/showgate-logo";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, X, Zap, Loader2, Ticket, ArrowLeft } from "lucide-react";
import { isAuthenticated } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UpgradeStatus {
  tier: "free" | "pro";
  proExpiresAt: string | null;
  isPro: boolean;
}

type BillingCycle = "monthly" | "yearly";

const PRICES = { monthly: 12_000, yearly: 120_000 };
const MONTHLY_EQUIVALENT = { monthly: 12_000, yearly: 10_000 };

function fmtNGN(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

const FEATURES: { label: string; free: React.ReactNode; pro: React.ReactNode }[] = [
  { label: "Active events",       free: "1",             pro: "Unlimited" },
  { label: "Tickets per month",   free: "500",           pro: "Unlimited" },
  { label: "Payment methods",     free: (
    <span className="block text-left">
      <span className="text-zinc-300 font-medium text-sm block">Direct deposit via Paystack</span>
      <span className="text-zinc-500 text-xs block mt-0.5">Just connect your bank account once and get paid directly.</span>
    </span>
  ), pro: "All providers" },
  { label: "Platform fee",        free: "2.5%",          pro: "0%" },
  { label: "Paystack subaccount", free: true,            pro: true },
  { label: "Priority support",    free: false,           pro: true },
  { label: "Custom branding",     free: false,           pro: true },
];

function FeatureValue({ val }: { val: React.ReactNode }) {
  if (val === true)  return <Check className="w-4 h-4 text-green-400 mx-auto" />;
  if (val === false) return <X    className="w-4 h-4 text-zinc-700   mx-auto" />;
  if (typeof val === "string") return <span className="text-zinc-300 font-medium text-sm">{val}</span>;
  return <>{val}</>;
}

export default function Pricing() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [redirecting, setRedirecting] = useState(false);

  const authed = isAuthenticated();

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
    if (!authed) {
      navigate("/login");
      return;
    }
    upgradeMutation.mutate(billing);
  }

  const isPro = status?.isPro;
  const isPending = upgradeMutation.isPending || redirecting;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a0a", color: "#f5f5f5" }}>
      {/* Nav */}
      <header className="border-b border-zinc-900 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/dashboard")}>
            <div className="p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
              <Ticket className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-white font-black text-base">Showgate<ShowgateLogo size={18} /></span>
          </div>
          <button onClick={() => navigate(authed ? "/dashboard" : "/")}
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {authed ? "Dashboard" : "Back"}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-14">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-bold uppercase tracking-widest mb-5">
            <Zap className="w-3.5 h-3.5" /> Simple Pricing
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-4">
            Scale your events.<br />
            <span className="text-amber-400">Keep more revenue.</span>
          </h1>
          <p className="text-zinc-500 text-lg max-w-md mx-auto">
            Start free. Upgrade when you're ready to unlock 0% fees and sell without limits.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center mb-10 gap-4">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 gap-1">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                billing === "monthly"
                  ? "bg-amber-400 text-black"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                billing === "yearly"
                  ? "bg-amber-400 text-black"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Yearly
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                billing === "yearly"
                  ? "bg-black/20 text-black"
                  : "bg-green-500/15 text-green-400"
              }`}>
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Free card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col">
            <div className="mb-6">
              <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold mb-2">Free</p>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-4xl font-black text-white">₦0</span>
                <span className="text-zinc-600 text-sm mb-1">/month</span>
              </div>
              <p className="text-zinc-600 text-sm">Get started at no cost</p>
            </div>

            <div className="space-y-3 mb-8 flex-1">
              {FEATURES.map((f) => (
                <div key={f.label} className="flex items-center justify-between gap-3 py-1">
                  <span className="text-zinc-500 text-sm">{f.label}</span>
                  <div className="text-right">
                    <FeatureValue val={f.free} />
                  </div>
                </div>
              ))}
            </div>

            <div className="py-3 rounded-xl border border-zinc-700 text-zinc-500 text-sm font-semibold text-center">
              {isPro ? "Previous Plan" : "Current Plan"}
            </div>
          </div>

          {/* Pro card */}
          <div className="relative bg-zinc-900 border border-amber-400/40 rounded-2xl p-8 flex flex-col"
            style={{ boxShadow: "0 0 50px rgba(245,158,11,0.08)" }}>
            {/* Gradient top strip */}
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
              style={{ background: "linear-gradient(90deg, #f59e0b, #fde68a, #f59e0b)" }} />

            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-amber-400 text-xs uppercase tracking-widest font-bold">Pro</p>
                {isPro && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20 font-bold">
                    Current Plan
                  </span>
                )}
              </div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-4xl font-black text-white">{fmtNGN(MONTHLY_EQUIVALENT[billing])}</span>
                <span className="text-zinc-600 text-sm mb-1">/month</span>
              </div>
              {billing === "yearly" ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[1.2rem] font-[800] text-white">{fmtNGN(PRICES.yearly)}/yr</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
                    Save ₦24,000
                  </span>
                </div>
              ) : (
                <p className="text-zinc-500 text-sm">Billed monthly</p>
              )}
            </div>

            <div className="space-y-3 mb-8 flex-1">
              {FEATURES.map((f) => (
                <div key={f.label} className="flex items-center justify-between gap-3 py-1">
                  <span className="text-zinc-400 text-sm">{f.label}</span>
                  <div className="text-right">
                    <FeatureValue val={f.pro} />
                  </div>
                </div>
              ))}
            </div>

            {isPro ? (
              <div className="py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-bold text-center">
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

        {/* Feature table (desktop) */}
        <div className="hidden md:block bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-3 bg-zinc-950 border-b border-zinc-800 px-6 py-4">
            <span className="text-zinc-600 text-xs uppercase tracking-widest font-bold">Feature</span>
            <span className="text-zinc-500 text-xs uppercase tracking-widest font-bold text-center">Free</span>
            <span className="text-amber-400 text-xs uppercase tracking-widest font-bold text-center">Pro</span>
          </div>
          {FEATURES.map((f, i) => (
            <div key={f.label}
              className={`grid grid-cols-3 px-6 py-4 ${i < FEATURES.length - 1 ? "border-b border-zinc-800/60" : ""}`}>
              <span className="text-zinc-400 text-sm">{f.label}</span>
              <div className="flex justify-center items-center"><FeatureValue val={f.free} /></div>
              <div className="flex justify-center items-center"><FeatureValue val={f.pro} /></div>
            </div>
          ))}
        </div>

        {/* FAQ / note */}
        <p className="text-center text-zinc-700 text-xs mt-10">
          All payments secured by Paystack · Cancel anytime · No hidden charges
        </p>
      </div>
    </div>
  );
}
