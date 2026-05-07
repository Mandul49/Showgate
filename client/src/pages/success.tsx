import { useLocation } from "wouter";
import { CheckCircle, Calendar, Clock, MapPin, Ticket, Download } from "lucide-react";

const EVENT = {
  name: "Musick & Tea 11",
  theme: "The Name of Jesus",
  date: "Sunday, December 13, 2026",
  time: "3:00 PM",
  venue: "Odillins Event Center",
};

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount);
}

export default function Success() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("orderId") || "";
  const name = params.get("name") || "Guest";
  const total = parseInt(params.get("total") || "0");
  const tickets = parseInt(params.get("tickets") || "1");

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d0d", color: "#f5f5f5" }}>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-full bg-amber-400/15 border border-amber-400/40 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-amber-400" />
              </div>
            </div>
            <h1 className="text-3xl font-black uppercase tracking-wide text-white">You're In!</h1>
            <p className="text-zinc-500 mt-2">Seat reserved for <span className="text-amber-400 font-semibold">{name.split(" ")[0]}</span>. See you there.</p>
          </div>

          {/* Ticket */}
          <div className="rounded-xl border border-amber-400/30 overflow-hidden shadow-[0_0_40px_rgba(234,179,8,0.08)] mb-6">
            {/* Gold top bar */}
            <div className="h-0.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />

            {/* Ticket header */}
            <div className="px-6 py-5 bg-zinc-900">
              <p className="text-amber-400/60 text-xs uppercase tracking-[0.3em] mb-1">Event Ticket</p>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-white font-black text-xl uppercase leading-tight">{EVENT.name}</p>
                  <p className="text-zinc-500 text-xs mt-0.5 italic">{EVENT.theme}</p>
                </div>
                <Ticket className="w-8 h-8 text-amber-400/20 flex-shrink-0 mt-0.5" />
              </div>
            </div>

            {/* Dashed perforation */}
            <div className="relative flex items-center bg-zinc-950 border-y border-dashed border-zinc-700">
              <div className="w-4 h-4 rounded-full bg-[#0d0d0d] -ml-2 flex-shrink-0 border border-zinc-700" />
              <div className="flex-1" />
              <div className="w-4 h-4 rounded-full bg-[#0d0d0d] -mr-2 flex-shrink-0 border border-zinc-700" />
            </div>

            {/* Ticket body */}
            <div className="px-6 py-5 bg-zinc-900 space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-zinc-600 text-xs uppercase tracking-widest mb-1">Date</p>
                  <div className="flex items-center gap-2 text-zinc-200 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    Dec 13, 2026
                  </div>
                </div>
                <div>
                  <p className="text-zinc-600 text-xs uppercase tracking-widest mb-1">Time</p>
                  <div className="flex items-center gap-2 text-zinc-200 font-medium">
                    <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    {EVENT.time}
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-zinc-600 text-xs uppercase tracking-widest mb-1">Venue</p>
                  <div className="flex items-center gap-2 text-zinc-200 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    {EVENT.venue}
                  </div>
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-zinc-600 text-xs uppercase tracking-widest mb-1">Seats Reserved</p>
                  <p className="text-amber-400 font-black text-3xl">{tickets}</p>
                </div>
                <div className="text-right">
                  <p className="text-zinc-600 text-xs uppercase tracking-widest mb-1">Due at Gate</p>
                  <p className="text-amber-400 font-black text-2xl">{formatPrice(total)}</p>
                </div>
              </div>

              <div className="border border-zinc-800 rounded-lg p-4">
                <p className="text-zinc-600 text-xs uppercase tracking-widest mb-1">Order Reference</p>
                <p className="font-mono text-sm font-bold text-white break-all">{orderId.toUpperCase().slice(0, 16)}</p>
                <span className="inline-block mt-2 text-xs px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-semibold">
                  Confirmed
                </span>
              </div>

              <p className="text-center text-zinc-600 text-xs">Show this reference at the gate · Arrive 30 minutes early</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={() => window.print()}
              className="flex-1 py-3 rounded-lg border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white transition-colors flex items-center justify-center gap-2 text-sm font-semibold">
              <Download className="w-4 h-4" /> Save
            </button>
            <button onClick={() => navigate("/")}
              className="flex-1 py-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold uppercase tracking-widest text-sm transition-colors flex items-center justify-center gap-2">
              <Ticket className="w-4 h-4" /> More Tickets
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-950">
        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col items-center gap-3">
          <div className="flex items-baseline gap-1">
            <span className="text-amber-400 font-black text-xl italic">M</span>
            <span className="text-white font-black">&</span>
            <span className="text-amber-400 font-black text-xl italic">T</span>
          </div>
          <p className="text-zinc-400 font-semibold text-sm italic tracking-widest">"transforming a generation"</p>
          <p className="text-zinc-700 text-xs">© 2026 Musick & Tea Creative Ministry. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
