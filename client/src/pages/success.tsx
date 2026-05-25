import { useLocation } from "wouter";
import { CheckCircle, Calendar, Clock, MapPin, Ticket, Download, Building2, Clock3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { EventConfig } from "@shared/schema";

function formatPrice(amount: number, currency = "NGN") {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

type PublicConfig = Omit<EventConfig, "paystackSecretKey" | "stripeSecretKey" | "paypalSecretKey">;

export default function Success() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("orderId") || "";
  const name = params.get("name") || "Guest";
  const total = parseInt(params.get("total") || "0");
  const tickets = parseInt(params.get("tickets") || "1");
  const status = params.get("status") || "confirmed";
  const isBankTransfer = status === "awaiting_transfer";
  const eventTitleParam = params.get("eventTitle") || "";

  const { data: config } = useQuery<PublicConfig>({ queryKey: ["/api/config"] });

  const primary = config?.primaryColor || "#F59E0B";
  const highlight = config?.highlightColor || "#FDE68A";
  const bg = config?.bgColor || "#0d0d0d";
  const currency = config?.currency || "NGN";
  const eventName = eventTitleParam || config?.eventName || "Event";
  const eventTheme = config?.eventTheme || "";
  const venueParam = params.get("venue") || "";
  const dateParam = params.get("date") || "";
  const timeParam = params.get("time") || "";
  const eventVenue = venueParam || config?.eventVenue || "";
  const eventTime = timeParam || config?.eventTime || "";
  const rawDate = dateParam || config?.eventDate || "";
  const formattedDate = rawDate
    ? new Date(rawDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: bg, color: "#f5f5f5" }}>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-5">
              {isBankTransfer
                ? <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "#22c55e26", border: "1px solid #22c55e66" }}>
                    <Building2 className="w-8 h-8 text-green-400" />
                  </div>
                : <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: primary + "26", border: `1px solid ${primary}66` }}>
                    <CheckCircle className="w-8 h-8" style={{ color: primary }} />
                  </div>
              }
            </div>
            {isBankTransfer
              ? <>
                  <h1 className="text-3xl font-black uppercase tracking-wide text-white">Spot Reserved!</h1>
                  <p className="text-zinc-400 mt-2 text-sm max-w-sm mx-auto">
                    Hey <span className="font-semibold text-green-400">{name.split(" ")[0]}</span>! Your spot is held. Please complete the bank transfer below to confirm your ticket.
                  </p>
                </>
              : <>
                  <h1 className="text-3xl font-black uppercase tracking-wide text-white">You're In!</h1>
                  <p className="text-zinc-500 mt-2">Seat reserved for <span className="font-semibold" style={{ color: primary }}>{name.split(" ")[0]}</span>. See you there.</p>
                </>
            }
          </div>

          {/* Bank Transfer Details */}
          {isBankTransfer && config && (
            <div className="bg-zinc-900 border border-green-500/20 rounded-xl p-5 mb-5">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-4 h-4 text-green-400" />
                <span className="text-white font-bold text-sm">Complete Your Transfer</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Bank", value: config.bankName },
                  { label: "Account Name", value: config.bankAccountName },
                  { label: "Account Number", value: config.bankAccountNumber },
                  config.bankRoutingCode ? { label: "Sort Code / SWIFT", value: config.bankRoutingCode } : null,
                ].filter(Boolean).map((row: any) => (
                  <div key={row.label} className="flex items-start justify-between gap-4">
                    <span className="text-zinc-500 text-xs uppercase tracking-widest flex-shrink-0">{row.label}</span>
                    <span className="text-white font-mono font-bold text-sm text-right">{row.value || "—"}</span>
                  </div>
                ))}
                <div className="flex items-start justify-between gap-4 border-t border-zinc-700 pt-3">
                  <span className="text-zinc-500 text-xs uppercase tracking-widest">Amount</span>
                  <span className="font-black text-lg" style={{ color: primary }}>{formatPrice(total, currency)}</span>
                </div>
                {config.bankTransferInstructions && (
                  <div className="border-t border-zinc-700 pt-3">
                    <p className="text-zinc-600 text-[10px] uppercase tracking-widest mb-1">Note</p>
                    <p className="text-zinc-400 text-xs">{config.bankTransferInstructions}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ticket */}
          <div className="rounded-xl overflow-hidden shadow-2xl mb-6"
            style={{ border: `1px solid ${primary}4d`, boxShadow: `0 0 40px ${primary}14` }}>
            <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${primary}, ${highlight}, ${primary})` }} />
            <div className="px-6 py-5 bg-zinc-900">
              <p className="text-xs uppercase tracking-[0.3em] mb-1" style={{ color: primary + "99" }}>Event Ticket</p>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-white font-black text-xl uppercase leading-tight">{eventName}</p>
                  {eventTheme && <p className="text-zinc-500 text-xs mt-0.5 italic">{eventTheme}</p>}
                </div>
                <Ticket className="w-8 h-8 flex-shrink-0 mt-0.5" style={{ color: primary + "33" }} />
              </div>
            </div>
            <div className="relative flex items-center bg-zinc-950 border-y border-dashed border-zinc-700">
              <div className="w-4 h-4 rounded-full -ml-2 flex-shrink-0 border border-zinc-700" style={{ backgroundColor: bg }} />
              <div className="flex-1" />
              <div className="w-4 h-4 rounded-full -mr-2 flex-shrink-0 border border-zinc-700" style={{ backgroundColor: bg }} />
            </div>
            <div className="px-6 py-5 bg-zinc-900 space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {formattedDate && (
                  <div>
                    <p className="text-zinc-600 text-xs uppercase tracking-widest mb-1">Date</p>
                    <div className="flex items-center gap-2 text-zinc-200 font-medium">
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: primary }} />
                      {formattedDate}
                    </div>
                  </div>
                )}
                {eventTime && (
                  <div>
                    <p className="text-zinc-600 text-xs uppercase tracking-widest mb-1">Time</p>
                    <div className="flex items-center gap-2 text-zinc-200 font-medium">
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: primary }} />
                      {eventTime}
                    </div>
                  </div>
                )}
                {eventVenue && (
                  <div className="col-span-2">
                    <p className="text-zinc-600 text-xs uppercase tracking-widest mb-1">Venue</p>
                    <div className="flex items-center gap-2 text-zinc-200 font-medium">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: primary }} />
                      {eventVenue}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-zinc-600 text-xs uppercase tracking-widest mb-1">Seats Reserved</p>
                  <p className="font-black text-3xl" style={{ color: primary }}>{tickets}</p>
                </div>
                <div className="text-right">
                  <p className="text-zinc-600 text-xs uppercase tracking-widest mb-1">Amount</p>
                  <p className="font-black text-2xl" style={{ color: primary }}>{formatPrice(total, currency)}</p>
                </div>
              </div>

              <div className="border border-zinc-800 rounded-lg p-4">
                <p className="text-zinc-600 text-xs uppercase tracking-widest mb-1">Order Reference</p>
                <p className="font-mono text-sm font-bold text-white break-all">{orderId.toUpperCase().slice(0, 16)}</p>
                <span className={`inline-flex items-center gap-1.5 mt-2 text-xs px-2.5 py-1 rounded-full font-semibold border ${isBankTransfer
                  ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                  : "bg-green-500/10 text-green-400 border-green-500/20"}`}>
                  {isBankTransfer ? <><Clock3 className="w-3 h-3" /> Awaiting Transfer</> : <><CheckCircle className="w-3 h-3" /> Confirmed</>}
                </span>
              </div>

              <p className="text-center text-zinc-600 text-xs">
                {isBankTransfer ? "Show this reference when you contact the organiser" : "Show this reference at the gate · Arrive 30 minutes early"}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => window.print()}
              className="flex-1 py-3 rounded-lg border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white transition-colors flex items-center justify-center gap-2 text-sm font-semibold">
              <Download className="w-4 h-4" /> Save
            </button>
            <button onClick={() => navigate("/")}
              className="flex-1 py-3 rounded-lg font-bold uppercase tracking-widest text-sm transition-colors flex items-center justify-center gap-2"
              style={{ backgroundColor: primary, color: "#000" }}>
              <Ticket className="w-4 h-4" /> More Tickets
            </button>
          </div>
        </div>
      </div>

      <footer className="border-t border-zinc-800 bg-zinc-950">
        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col items-center gap-3">
          {config?.logoDataUrl
            ? <img src={config.logoDataUrl} alt={eventName} className="max-h-10 w-auto opacity-60 object-contain" style={{ mixBlendMode: "screen" }} />
            : <p className="font-black text-white text-base">{eventName}</p>
          }
          <p className="text-zinc-700 text-xs">© {new Date().getFullYear()} {eventName}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
