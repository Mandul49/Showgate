import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Calendar, Clock, MapPin, Ticket, Download, Share2 } from "lucide-react";

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-200">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">You're In!</h1>
          <p className="text-slate-500">Your reservation is confirmed, {name.split(" ")[0]}.</p>
        </div>

        {/* Ticket Card */}
        <Card className="border-0 shadow-xl overflow-hidden mb-4">
          {/* Top gradient bar */}
          <div className="h-3 bg-gradient-to-r from-purple-600 to-indigo-600" />

          {/* Ticket perforations */}
          <div className="flex items-center px-6 py-4 bg-gradient-to-r from-purple-700 to-indigo-700 text-white">
            <div>
              <p className="text-purple-200 text-xs uppercase tracking-widest font-medium">Event Ticket</p>
              <p className="text-xl font-bold mt-0.5">{EVENT.name}</p>
            </div>
            <Ticket className="w-10 h-10 text-white/30 ml-auto" />
          </div>

          {/* Dashed divider */}
          <div className="relative flex items-center">
            <div className="w-5 h-5 rounded-full bg-slate-100 -ml-2.5 border border-slate-200" />
            <div className="flex-1 border-t-2 border-dashed border-slate-200 mx-1" />
            <div className="w-5 h-5 rounded-full bg-slate-100 -mr-2.5 border border-slate-200" />
          </div>

          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Date</p>
                <div className="flex items-center gap-1.5 text-slate-700 font-medium text-sm">
                  <Calendar className="w-3.5 h-3.5 text-purple-500" />
                  Dec 13, 2026
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Time</p>
                <div className="flex items-center gap-1.5 text-slate-700 font-medium text-sm">
                  <Clock className="w-3.5 h-3.5 text-purple-500" />
                  {EVENT.time}
                </div>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Venue</p>
                <div className="flex items-center gap-1.5 text-slate-700 font-medium text-sm">
                  <MapPin className="w-3.5 h-3.5 text-purple-500" />
                  {EVENT.venue}
                </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-400 uppercase tracking-wide">Tickets</p>
                <p className="text-2xl font-bold text-purple-800">{tickets}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-purple-400 uppercase tracking-wide">Amount Due</p>
                <p className="text-2xl font-bold text-purple-800">{formatPrice(total)}</p>
                <p className="text-xs text-purple-400">Pay at venue</p>
              </div>
            </div>

            <div className="border border-slate-100 rounded-xl p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Order Reference</p>
              <p className="font-mono text-sm font-semibold text-slate-700 break-all">{orderId.toUpperCase().slice(0, 16)}</p>
              <Badge className="mt-2 bg-green-100 text-green-700 border-0 text-xs">Confirmed</Badge>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2 mb-6">
          <p className="text-center text-slate-500 text-sm">
            A confirmation has been sent to your email. Show your order reference at the gate.
          </p>
        </div>

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
  );
}
