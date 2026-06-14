import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isAuthenticated } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  Crown, ArrowLeft, Calendar, CreditCard, AlertTriangle,
  CheckCircle2, Clock, Zap, Receipt, RefreshCw, X, Download,
} from "lucide-react";
import { getToken } from "@/lib/auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryItem {
  reference: string;
  plan: string;
  amountKobo: number;
  fulfilledAt: string;
}

interface SubscriptionData {
  tier: "free" | "pro";
  billingCycle: "monthly" | "yearly" | null;
  proExpiresAt: string | null;
  cancelledAt: string | null;
  amountKobo: number;
  history: HistoryItem[];
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function fmtDate(d: string | null, long = false) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "numeric", month: long ? "long" : "short", year: "numeric",
    });
  } catch { return d; }
}

function fmtAmount(kobo: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN", minimumFractionDigits: 0,
  }).format(kobo / 100);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [downloadingRef, setDownloadingRef] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login");
    }
  }, []);

  const { data, isLoading } = useQuery<SubscriptionData>({
    queryKey: ["/api/subscription"],
    enabled: isAuthenticated(),
  });

  // Redirect free users to pricing
  useEffect(() => {
    if (data && data.tier !== "pro") {
      navigate("/pricing");
    }
  }, [data]);

  const cancelMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/subscription/cancel", { reason: cancelReason || null }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/subscription"] });
      await qc.invalidateQueries({ queryKey: ["/api/upgrade/status"] });
      toast({ title: "Subscription cancelled", description: "You'll keep Pro access until your renewal date." });
      setShowCancelDialog(false);
      setCancelReason("");
    },
    onError: (err: any) => {
      toast({ title: "Cancellation failed", description: err.message, variant: "destructive" });
      setShowCancelDialog(false);
    },
  });

  const reinstateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/subscription/reinstate", {}),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/subscription"] });
      await qc.invalidateQueries({ queryKey: ["/api/upgrade/status"] });
      toast({ title: "Subscription reinstated", description: "Your Pro plan will auto-renew as normal." });
    },
    onError: (err: any) => {
      toast({ title: "Reinstatement failed", description: err.message, variant: "destructive" });
    },
  });

  const isCancelled = !!data?.cancelledAt;
  const expiryLabel = fmtDate(data?.proExpiresAt ?? null, true);
  const billingLabel = data?.billingCycle === "yearly" ? "Yearly" : "Monthly";
  const billingAmount = data ? fmtAmount(data.amountKobo) : "—";
  const perLabel = data?.billingCycle === "yearly" ? "/year" : "/month";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0a0a0a" }}>
        <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.tier !== "pro") return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a0a" }}>
      {/* Navbar */}
      <div className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 rounded-xl bg-violet-400/10 border border-violet-400/20">
            <Crown className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl">Subscription</h1>
            <p className="text-zinc-500 text-sm">Manage your Pro plan</p>
          </div>
        </div>

        {/* Cancellation notice */}
        {isCancelled && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-5 py-4">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-amber-300 font-semibold text-sm">Subscription cancelled</p>
              <p className="text-zinc-400 text-xs mt-0.5">
                You'll keep full Pro access until <strong className="text-zinc-200">{expiryLabel}</strong>, then revert to Free.
              </p>
            </div>
            <button
              onClick={() => reinstateMutation.mutate()}
              disabled={reinstateMutation.isPending}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-300 hover:bg-amber-400/20 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {reinstateMutation.isPending
                ? <><RefreshCw className="w-3 h-3 animate-spin" /> Reinstating…</>
                : <><RefreshCw className="w-3 h-3" /> Reinstate</>
              }
            </button>
          </div>
        )}

        {/* Plan card */}
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-1">Current Plan</p>
              <p className="text-white font-bold text-2xl">Pro</p>
            </div>
            <span className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase border bg-violet-400/10 text-violet-400 border-violet-400/20">
              {isCancelled ? "Cancelling" : "Active"}
            </span>
          </div>

          <div className="h-px bg-zinc-800" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-zinc-500 text-xs flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Billing cycle
              </span>
              <span className="text-white font-semibold text-sm">{billingLabel}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-zinc-500 text-xs flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {isCancelled ? "Expires on" : "Next renewal"}
              </span>
              <span className="text-white font-semibold text-sm">{expiryLabel}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-zinc-500 text-xs flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" /> Amount
              </span>
              <span className="text-white font-semibold text-sm">{billingAmount}<span className="text-zinc-500 text-xs font-normal">{perLabel}</span></span>
            </div>
          </div>

          <div className="h-px bg-zinc-800" />

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Upgrade to Yearly — only visible if on monthly */}
            {data.billingCycle !== "yearly" && !isCancelled && (
              <a
                href="/pricing"
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-400 text-white text-sm font-bold transition-colors flex-1"
              >
                <Zap className="w-4 h-4" /> Upgrade to Yearly — save 17%
              </a>
            )}

            {/* Cancel / already cancelled */}
            {isCancelled ? (
              <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-800 text-zinc-600 text-sm font-semibold flex-1 cursor-not-allowed select-none">
                <X className="w-4 h-4" /> Subscription cancelled
              </div>
            ) : (
              <button
                onClick={() => setShowCancelDialog(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-semibold transition-colors flex-1"
              >
                <X className="w-4 h-4" /> Cancel Subscription
              </button>
            )}
          </div>
        </div>

        {/* Billing History */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <p className="text-white font-semibold text-sm">Billing History</p>
          </div>

          {data.history.length === 0 ? (
            <div className="px-5 py-8 text-center text-zinc-600 text-sm">
              No payment history yet.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {data.history.map((item) => (
                <div key={item.reference} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 rounded-lg bg-green-400/10 border border-green-400/20 flex-shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        Pro {item.plan === "yearly" ? "Yearly" : "Monthly"}
                      </p>
                      <p className="text-zinc-500 text-xs flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {fmtDate(item.fulfilledAt, true)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-white font-semibold text-sm">{fmtAmount(item.amountKobo)}</p>
                      <p className="text-zinc-600 text-xs font-mono truncate max-w-[100px]">{item.reference.slice(-8)}</p>
                    </div>
                    <button
                      onClick={() => {
                        setDownloadingRef(item.reference);
                        const token = getToken();
                        const url = `/api/upgrade/receipt/${encodeURIComponent(item.reference)}`;
                        fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
                          .then((r) => { if (!r.ok) throw new Error("Failed"); return r.blob(); })
                          .then((blob) => {
                            const blobUrl = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = blobUrl;
                            a.download = `receipt-${item.reference.slice(-8)}.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
                          })
                          .catch(() => toast({ title: "Download failed", description: "Could not generate receipt", variant: "destructive" }))
                          .finally(() => setDownloadingRef(null));
                      }}
                      disabled={downloadingRef === item.reference}
                      title="Download receipt"
                      className="p-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors disabled:opacity-40"
                    >
                      {downloadingRef === item.reference
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : <Download className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={(open) => { setShowCancelDialog(open); if (!open) setCancelReason(""); }}>
        <AlertDialogContent className="bg-zinc-900 border border-zinc-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Cancel Pro plan?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              You will keep Pro access until{" "}
              <strong className="text-zinc-200">{expiryLabel}</strong>, then revert to Free.
              Your events and data will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 pb-2">
            <p className="text-zinc-500 text-xs uppercase tracking-widest mb-2">Why are you cancelling? <span className="normal-case text-zinc-600">(optional)</span></p>
            <div className="flex flex-col gap-1.5">
              {["Too expensive", "Not using it enough", "Missing features", "Switching to another tool", "Other"].map((reason) => (
                <label key={reason} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="radio"
                    name="cancelReasonSub"
                    value={reason}
                    checked={cancelReason === reason}
                    onChange={() => setCancelReason(reason)}
                    className="accent-red-500"
                  />
                  <span className={`text-sm transition-colors ${cancelReason === reason ? "text-white" : "text-zinc-400 group-hover:text-zinc-300"}`}>{reason}</span>
                </label>
              ))}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white">
              Keep Plan
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="bg-red-600 hover:bg-red-500 text-white border-0"
            >
              {cancelMutation.isPending ? "Cancelling…" : "Confirm Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
