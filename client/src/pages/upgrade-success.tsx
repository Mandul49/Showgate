import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Zap, Loader2, ArrowRight, Ticket, AlertTriangle } from "lucide-react";
import { isAuthenticated, getUser, saveUser } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

interface UpgradeStatus {
  tier: "free" | "pro";
  proExpiresAt: string | null;
  isPro: boolean;
}

interface VerifyResult {
  success: boolean;
  tier: "free" | "pro";
  proExpiresAt: string | null;
}

function fmtDate(d: string | null) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch { return d; }
}

export default function UpgradeSuccess() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const params = new URLSearchParams(window.location.search);
  const reference = params.get("reference") || params.get("trxref") || "";
  const authed = isAuthenticated();
  const verifyAttempted = useRef(false);

  const { data: status, isLoading } = useQuery<UpgradeStatus>({
    queryKey: ["/api/upgrade/status"],
    enabled: authed,
  });

  const verifyMutation = useMutation({
    mutationFn: async (ref: string) => {
      const res = await apiRequest("POST", "/api/upgrade/verify", { reference: ref });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Verification failed");
      return data as VerifyResult;
    },
    onSuccess: () => {
      // Refresh tier status and events (limits change)
      qc.invalidateQueries({ queryKey: ["/api/upgrade/status"] });
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      // Update cached user so navbar badge shows Pro immediately
      const user = getUser();
      if (user) saveUser({ ...user, tier: "pro" });
    },
  });

  // Trigger verification once on load when we have a reference
  useEffect(() => {
    if (!authed || !reference || verifyAttempted.current) return;
    verifyAttempted.current = true;
    verifyMutation.mutate(reference);
  }, [authed, reference]);

  if (!authed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" style={{ backgroundColor: "#0a0a0a" }}>
        <Ticket className="w-10 h-10 text-zinc-700" />
        <p className="text-zinc-500 text-sm">Please log in to view your subscription.</p>
        <button onClick={() => navigate("/login")}
          className="px-6 py-3 rounded-xl bg-amber-400 text-black font-bold text-sm">
          Log In
        </button>
      </div>
    );
  }

  const isPending = verifyMutation.isPending || isLoading;
  const isPro = status?.isPro || verifyMutation.data?.tier === "pro";
  const proExpiresAt = status?.proExpiresAt || verifyMutation.data?.proExpiresAt || null;
  const expiryDate = fmtDate(proExpiresAt);
  const verifyError = verifyMutation.error as Error | null;

  if (isPending) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5" style={{ backgroundColor: "#0a0a0a" }}>
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        <p className="text-zinc-500 text-sm">Confirming your payment…</p>
        {reference && (
          <p className="text-zinc-700 font-mono text-xs">Ref: {reference.toUpperCase()}</p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16" style={{ backgroundColor: "#0a0a0a" }}>
      <div className="w-full max-w-sm text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: isPro ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.10)",
              border: isPro ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(239,68,68,0.25)",
            }}>
            {isPro
              ? <Zap className="w-9 h-9 text-amber-400" />
              : <AlertTriangle className="w-9 h-9 text-red-400" />
            }
          </div>
        </div>

        {isPro ? (
          <>
            <h1 className="text-3xl font-black text-white mb-3">You're now Pro!</h1>
            <p className="text-zinc-500 text-sm mb-8">
              Your subscription is active. Enjoy 0% platform fees and unlimited events.
            </p>

            {/* Pro badge card */}
            <div className="bg-zinc-900 border border-amber-400/30 rounded-2xl p-6 mb-8 text-left"
              style={{ boxShadow: "0 0 40px rgba(245,158,11,0.06)" }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-zinc-500 text-xs uppercase tracking-widest">Plan</span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-violet-400/10 text-violet-400 border border-violet-400/20 font-bold uppercase">
                  Pro
                </span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Platform fee</span>
                  <span className="text-green-400 font-bold">0%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Active events</span>
                  <span className="text-white font-semibold">Unlimited</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Tickets per event</span>
                  <span className="text-white font-semibold">Unlimited</span>
                </div>
                {expiryDate && (
                  <div className="flex justify-between border-t border-zinc-800 pt-3">
                    <span className="text-zinc-500">Renews</span>
                    <span className="text-white font-semibold">{expiryDate}</span>
                  </div>
                )}
                {reference && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Reference</span>
                    <span className="text-zinc-300 font-mono text-xs">{reference.toUpperCase().slice(0, 16)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => navigate("/dashboard")}
                className="flex-1 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-black text-white mb-3">
              {verifyError ? "Payment verification failed" : "Payment processing…"}
            </h1>
            <p className="text-zinc-500 text-sm mb-6">
              {verifyError
                ? verifyError.message
                : "Your upgrade is being confirmed. This usually takes a few seconds."
              }
              {reference && (
                <span className="block mt-2 text-zinc-600 font-mono text-xs">
                  Ref: {reference.toUpperCase()}
                </span>
              )}
            </p>

            {verifyError && (
              <button
                onClick={() => { verifyAttempted.current = false; verifyMutation.mutate(reference); }}
                className="mb-3 w-full px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm transition-colors">
                Retry Verification
              </button>
            )}

            <button onClick={() => navigate("/dashboard")}
              className="px-6 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-sm font-semibold transition-colors w-full">
              Back to Dashboard
            </button>
          </>
        )}
      </div>

      <p className="mt-10 text-zinc-800 text-xs flex items-center gap-2">
        <Ticket className="w-3.5 h-3.5" /> Powered by Showgate
      </p>
    </div>
  );
}
