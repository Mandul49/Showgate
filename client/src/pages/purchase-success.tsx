import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, Ticket, Download, CheckCircle2, Loader2, X, ArrowLeft } from "lucide-react";

interface PurchaseData {
  id: string;
  customerName: string;
  customerEmail: string;
  quantity: number;
  amount: number;
  reference: string;
  status: string;
  createdAt: string;
  eventTitle: string;
  eventDate: string | null;
  eventLocation: string | null;
  ticketTypeName: string;
}

function fmtDate(d: string | null) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      weekday: "short", day: "numeric", month: "long", year: "numeric",
    });
  } catch { return d; }
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(n);
}

export default function PurchaseSuccess() {
  const params = new URLSearchParams(window.location.search);
  const reference = params.get("reference") || params.get("trxref") || "";

  const { data: purchase, isLoading, isError } = useQuery<PurchaseData>({
    queryKey: [`/api/purchase/${reference}`],
    enabled: !!reference,
    retry: 3,
    retryDelay: 1500,
  });

  if (!reference) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" style={{ backgroundColor: "#0a0a0a" }}>
        <X className="w-12 h-12 text-zinc-700" />
        <p className="text-zinc-500 text-sm">No payment reference found.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5" style={{ backgroundColor: "#0a0a0a" }}>
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        <p className="text-zinc-500 text-sm">Confirming your payment…</p>
      </div>
    );
  }

  if (isError || !purchase) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" style={{ backgroundColor: "#0a0a0a" }}>
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
          <X className="w-8 h-8 text-zinc-600" />
        </div>
        <h2 className="text-white font-bold text-lg text-center">Payment processing</h2>
        <p className="text-zinc-500 text-sm text-center max-w-xs">
          Your payment may still be processing. Check your email for a confirmation, or contact the organizer with reference: <strong className="text-white font-mono">{reference}</strong>
        </p>
      </div>
    );
  }

  const formattedDate = fmtDate(purchase.eventDate);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a0a", color: "#f5f5f5" }}>
      <div className="flex-1 flex items-center justify-center px-4 py-12 min-h-screen">
        <div className="w-full max-w-md">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>
                <CheckCircle2 className="w-8 h-8 text-amber-400" />
              </div>
            </div>
            <h1 className="text-3xl font-black uppercase tracking-wide text-white">You're In!</h1>
            <p className="text-zinc-500 mt-2 text-sm">
              Seat confirmed for{" "}
              <span className="font-semibold text-amber-400">{purchase.customerName.split(" ")[0]}</span>.
              Check your email for details.
            </p>
          </div>

          {/* Ticket card */}
          <div className="rounded-2xl overflow-hidden shadow-2xl mb-6"
            style={{ border: "1px solid rgba(245,158,11,0.3)", boxShadow: "0 0 50px rgba(245,158,11,0.07)" }}>
            {/* Top gradient strip */}
            <div className="h-1" style={{ background: "linear-gradient(90deg, #f59e0b, #fde68a, #f59e0b)" }} />

            {/* Event header */}
            <div className="px-6 py-5 bg-zinc-900">
              <p className="text-amber-400/60 text-xs uppercase tracking-[0.25em] mb-1">Event Ticket</p>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-white font-black text-xl uppercase leading-tight">{purchase.eventTitle}</p>
                  <p className="text-amber-400/70 text-sm font-semibold mt-0.5">{purchase.ticketTypeName}</p>
                </div>
                <Ticket className="w-7 h-7 flex-shrink-0 text-amber-400/20 mt-0.5" />
              </div>
            </div>

            {/* Divider perforation */}
            <div className="relative flex items-center bg-zinc-950 border-y border-dashed border-zinc-700/60">
              <div className="w-4 h-4 rounded-full -ml-2 border border-zinc-700" style={{ backgroundColor: "#0a0a0a" }} />
              <div className="flex-1" />
              <div className="w-4 h-4 rounded-full -mr-2 border border-zinc-700" style={{ backgroundColor: "#0a0a0a" }} />
            </div>

            {/* Ticket body */}
            <div className="px-6 py-5 bg-zinc-900 space-y-5">
              {/* Date / Location */}
              {(formattedDate || purchase.eventLocation) && (
                <div className="grid grid-cols-1 gap-3">
                  {formattedDate && (
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <div>
                        <p className="text-zinc-600 text-[10px] uppercase tracking-widest">Date</p>
                        <p className="text-zinc-200 text-sm font-semibold">{formattedDate}</p>
                      </div>
                    </div>
                  )}
                  {purchase.eventLocation && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <div>
                        <p className="text-zinc-600 text-[10px] uppercase tracking-widest">Venue</p>
                        <p className="text-zinc-200 text-sm font-semibold">{purchase.eventLocation}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Stats */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-zinc-600 text-[10px] uppercase tracking-widest mb-1">Tickets</p>
                  <p className="text-amber-400 font-black text-3xl">{purchase.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="text-zinc-600 text-[10px] uppercase tracking-widest mb-1">Amount Paid</p>
                  <p className="text-amber-400 font-black text-2xl">{fmtCurrency(purchase.amount)}</p>
                </div>
              </div>

              {/* Reference */}
              <div className="border border-zinc-800 rounded-xl p-4">
                <p className="text-zinc-600 text-[10px] uppercase tracking-widest mb-1">Order Reference</p>
                <p className="font-mono text-sm font-bold text-white break-all">{purchase.reference.toUpperCase()}</p>
                <span className="inline-flex items-center gap-1.5 mt-2 text-xs px-2.5 py-1 rounded-full font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
                  <CheckCircle2 className="w-3 h-3" /> Confirmed
                </span>
              </div>

              <p className="text-zinc-700 text-xs text-center">
                Show this reference at the gate · Arrive 30 minutes early
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={() => window.print()}
              className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white transition-colors flex items-center justify-center gap-2 text-sm font-semibold">
              <Download className="w-4 h-4" /> Save
            </button>
            <button onClick={() => window.history.back()}
              className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm transition-colors flex items-center justify-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Event
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
