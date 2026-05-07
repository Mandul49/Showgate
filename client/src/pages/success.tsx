import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Calendar, Clock, MapPin, Ticket, Download, Music } from "lucide-react";

const EVENT = {
  name: "Musick & Tea 11",
  theme: "The Name of Jesus",
  date: "Sunday, December 13, 2026",
  time: "3:00 PM",
  venue: "Odillins Event Center",
};

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function Success() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("orderId") || "";
  const name = params.get("name") || "Guest";
  const total = parseInt(params.get("total") || "0");
  const tickets = parseInt(params.get("tickets") || "1");

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-purple-50 to-slate-100">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-200">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
          </div>

          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">You're Registered!</h1>
            <p className="text-slate-500">Your seat is reserved, {name.split(" ")[0]}. We can't wait to see you there.</p>
          </div>

          {/* Ticket Card */}
          <Card className="border-0 shadow-xl overflow-hidden mb-4">
            <div className="h-2 bg-gradient-to-r from-purple-600 to-indigo-600" />

            <div className="px-6 py-4 bg-gradient-to-r from-purple-800 to-indigo-800 text-white">
              <p className="text-purple-300 text-xs uppercase tracking-widest mb-0.5">Event Ticket · {EVENT.theme}</p>
              <div className="flex items-center justify-between">
                <p className="text-xl font-bold">{EVENT.name}</p>
                <Ticket className="w-8 h-8 text-white/25" />
              </div>
            </div>

            {/* Perforation */}
            <div className="relative flex items-center bg-white">
              <div className="w-5 h-5 rounded-full bg-slate-100 -ml-2.5 border border-slate-200 flex-shrink-0" />
              <div className="flex-1 border-t-2 border-dashed border-slate-200 mx-1" />
              <div className="w-5 h-5 rounded-full bg-slate-100 -mr-2.5 border border-slate-200 flex-shrink-0" />
            </div>

            <CardContent className="p-6 space-y-4 bg-white">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Date</p>
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                    Dec 13, 2026
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Time</p>
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Clock className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                    {EVENT.time}
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Venue</p>
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                    {EVENT.venue}
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-400 uppercase tracking-wide">Seats Reserved</p>
                  <p className="text-3xl font-bold text-purple-800">{tickets}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-purple-400 uppercase tracking-wide">Amount Due at Gate</p>
                  <p className="text-2xl font-bold text-purple-800">{formatPrice(total)}</p>
                </div>
              </div>

              <div className="border border-slate-100 rounded-xl p-4">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Order Reference</p>
                <p className="font-mono text-sm font-semibold text-slate-700 break-all">{orderId.toUpperCase().slice(0, 16)}</p>
                <Badge className="mt-2 bg-green-100 text-green-700 border-0 text-xs">Confirmed</Badge>
              </div>

              <p className="text-center text-slate-500 text-xs">
                Show this reference at the gate · Arrive 30 minutes early
              </p>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => window.print()}>
              <Download className="w-4 h-4 mr-2" /> Save
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              onClick={() => navigate("/")}
            >
              <Ticket className="w-4 h-4 mr-2" /> Get More Tickets
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white">
        <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-purple-300" />
            <span className="font-bold">{EVENT.name}</span>
          </div>
          <p className="text-amber-300 font-semibold text-sm uppercase tracking-widest italic">"Transforming a generation"</p>
          <p className="text-purple-400 text-xs">© 2026 Musick & Tea. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
