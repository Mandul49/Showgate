import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin, Calendar, Clock, Ticket, User, Mail, Phone,
  Crown, Zap, Instagram, ChevronDown, ChevronUp, Music
} from "lucide-react";

const EVENT = {
  name: "Musick & Tea 11",
  theme: "The Name of Jesus",
  date: "Sunday, December 13, 2026",
  dateISO: "2026-12-13T15:00:00",
  time: "3:00 PM",
  venue: "Odillins Event Center",
  description: "An evening of worship, music, and fellowship centred on the Name above all names. Come and be refreshed.",
  totalTickets: 250,
};

const TICKET_TYPES = [
  {
    id: "regular",
    name: "Regular",
    price: 2000,
    description: "Entry ticket to the Musick & Tea 11 concert",
    icon: Ticket,
    colorBar: "from-blue-500 to-blue-600",
    colorIcon: "bg-blue-100 text-blue-600",
    badge: "General Admission",
    perks: ["Full concert access", "Event programme", "Welcome refreshment"],
    ticketsIncluded: 1,
    allowQuantity: true,
  },
  {
    id: "vip-support",
    name: "VIP Support",
    price: 100000,
    description: "Support the vision and enjoy an elevated experience",
    icon: Crown,
    colorBar: "from-amber-400 to-orange-500",
    colorIcon: "bg-amber-100 text-amber-600",
    badge: "Exclusive",
    perks: [
      "2 concert tickets included",
      "Reserved front-row seating",
      "Special Musick & Tea gift package",
      "Recognition in event programme",
    ],
    ticketsIncluded: 2,
    allowQuantity: false,
  },
];

const registrationSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  customerEmail: z.string().email("Please enter a valid email"),
  customerPhone: z.string().min(10, "Please enter a valid phone number"),
  instagramHandle: z.string().optional(),
  quantity: z.number().min(1).max(20),
});

type RegistrationForm = z.infer<typeof registrationSchema>;

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

function useCountdown(targetISO: string) {
  const calcRemaining = () => {
    const diff = new Date(targetISO).getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0 };
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return { days, hours, mins, secs };
  };
  const [time, setTime] = useState(calcRemaining);
  useEffect(() => {
    const id = setInterval(() => setTime(calcRemaining()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 min-w-[64px] text-center border border-white/20">
        <span className="text-3xl sm:text-4xl font-bold tabular-nums leading-none">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="text-purple-300 text-xs mt-2 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function TicketForm({ ticket, onSuccess }: { ticket: typeof TICKET_TYPES[0]; onSuccess: (orderId: string, name: string, total: number, qty: number) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const form = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      instagramHandle: "",
      quantity: 1,
    },
  });

  const quantity = form.watch("quantity");
  const subtotal = ticket.price * quantity;
  const total = subtotal;

  const mutation = useMutation({
    mutationFn: async (data: RegistrationForm) => {
      const res = await apiRequest("POST", "/api/orders", {
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        instagramHandle: data.instagramHandle || null,
        ticketType: ticket.name,
        quantity: data.quantity,
        totalAmount: ticket.price * data.quantity,
      });
      return res.json();
    },
    onSuccess: (order, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/tickets/availability"] });
      onSuccess(order.id, vars.customerName, ticket.price * vars.quantity, vars.quantity * ticket.ticketsIncluded);
    },
    onError: (err: any) => {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4 pt-4 border-t border-slate-100 mt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField control={form.control} name="customerName" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-600 text-xs font-semibold uppercase tracking-wide">Full Name *</FormLabel>
              <FormControl>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input {...field} placeholder="Your full name" className="pl-9 text-sm" />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="customerPhone" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-600 text-xs font-semibold uppercase tracking-wide">Phone Number *</FormLabel>
              <FormControl>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input {...field} placeholder="+234 xxx xxx xxxx" className="pl-9 text-sm" />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="customerEmail" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-slate-600 text-xs font-semibold uppercase tracking-wide">Email Address *</FormLabel>
            <FormControl>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input {...field} type="email" placeholder="your@email.com" className="pl-9 text-sm" />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="instagramHandle" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-slate-600 text-xs font-semibold uppercase tracking-wide">Instagram Handle <span className="text-slate-400 normal-case font-normal">(optional)</span></FormLabel>
            <FormControl>
              <div className="relative">
                <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input {...field} placeholder="@yourhandle" className="pl-9 text-sm" />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {ticket.allowQuantity && (
          <FormField control={form.control} name="quantity" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-slate-600 text-xs font-semibold uppercase tracking-wide">Number of Tickets</FormLabel>
              <FormControl>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => field.onChange(Math.max(1, field.value - 1))}
                    className="w-8 h-8 rounded-full border-2 border-purple-200 flex items-center justify-center text-purple-600 hover:bg-purple-50 transition-colors text-lg font-bold">−</button>
                  <span className="font-bold text-slate-800 text-lg w-8 text-center">{field.value}</span>
                  <button type="button" onClick={() => field.onChange(Math.min(20, field.value + 1))}
                    className="w-8 h-8 rounded-full border-2 border-purple-200 flex items-center justify-center text-purple-600 hover:bg-purple-50 transition-colors text-lg font-bold">+</button>
                </div>
              </FormControl>
            </FormItem>
          )} />
        )}

        <div className="flex items-center justify-between bg-purple-50 rounded-lg px-4 py-3">
          <span className="text-sm text-slate-600 font-medium">Total to pay at venue</span>
          <span className="font-bold text-purple-700 text-lg">{formatPrice(total)}</span>
        </div>

        <Button type="submit" disabled={mutation.isPending}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 font-semibold"
          size="lg">
          {mutation.isPending
            ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Registering...</span>
            : <span className="flex items-center gap-2"><Ticket className="w-4 h-4" /> Reserve My Seat</span>}
        </Button>
        <p className="text-center text-xs text-slate-400">Payment of {formatPrice(total)} collected at the venue gate</p>
      </form>
    </Form>
  );
}

function TicketCard({ ticket, remaining }: { ticket: typeof TICKET_TYPES[0]; remaining: number }) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const Icon = ticket.icon;

  function handleSuccess(orderId: string, name: string, total: number, qty: number) {
    navigate(`/success?orderId=${orderId}&name=${encodeURIComponent(name)}&total=${total}&tickets=${qty}`);
  }

  const soldOut = remaining <= 0;

  return (
    <Card className={`overflow-hidden border-2 transition-all duration-200 ${open ? "border-purple-400 shadow-purple-100 shadow-lg" : "border-slate-100 hover:border-purple-200 hover:shadow-md"}`}>
      <div className={`h-1.5 bg-gradient-to-r ${ticket.colorBar}`} />
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2.5 rounded-xl ${ticket.colorIcon}`}>
            <Icon className="w-6 h-6" />
          </div>
          <Badge variant="secondary" className="text-xs">{ticket.badge}</Badge>
        </div>

        <h3 className="text-xl font-bold text-slate-800">{ticket.name}</h3>
        <p className="text-slate-500 text-sm mt-1 mb-4">{ticket.description}</p>

        <ul className="space-y-2 mb-5">
          {ticket.perks.map((perk) => (
            <li key={perk} className="flex items-start gap-2 text-sm text-slate-600">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0 mt-1.5" />
              {perk}
            </li>
          ))}
        </ul>

        <div className="mb-4">
          <span className="text-3xl font-bold text-slate-800">{formatPrice(ticket.price)}</span>
          <span className="text-slate-400 text-sm ml-2">
            {ticket.ticketsIncluded > 1 ? `· ${ticket.ticketsIncluded} tickets included` : "· per ticket"}
          </span>
        </div>

        {soldOut ? (
          <Button disabled className="w-full" variant="outline">Sold Out</Button>
        ) : (
          <Button
            onClick={() => setOpen((v) => !v)}
            className={`w-full font-semibold ${open ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100" : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"}`}
            variant={open ? "outline" : "default"}
            size="lg"
          >
            {open ? (
              <span className="flex items-center gap-2"><ChevronUp className="w-4 h-4" /> Hide Form</span>
            ) : (
              <span className="flex items-center gap-2"><Ticket className="w-4 h-4" /> Register Now</span>
            )}
          </Button>
        )}

        {open && <TicketForm ticket={ticket} onSuccess={handleSuccess} />}
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const countdown = useCountdown(EVENT.dateISO);

  const { data: availability } = useQuery<{ total: number; sold: number; remaining: number }>({
    queryKey: ["/api/tickets/availability"],
    refetchInterval: 30000,
  });

  const remaining = availability?.remaining ?? EVENT.totalTickets;
  const sold = availability?.sold ?? 0;
  const pctSold = Math.min(100, Math.round((sold / EVENT.totalTickets) * 100));

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-purple-50 to-slate-100">

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 text-white">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 25% 40%, white 1px, transparent 1px), radial-gradient(circle at 75% 70%, white 1px, transparent 1px)", backgroundSize: "50px 50px" }} />
        <div className="relative max-w-4xl mx-auto px-4 pt-10 pb-12">
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <Badge className="bg-white/20 text-white border-white/30 text-xs">
              <Zap className="w-3 h-3 mr-1" /> Limited Tickets Available
            </Badge>
            <Badge className="bg-amber-400/20 text-amber-300 border-amber-400/30 text-xs">
              <Music className="w-3 h-3 mr-1" /> {EVENT.totalTickets} Total Seats
            </Badge>
          </div>
          <p className="text-amber-300 text-xs font-bold uppercase tracking-widest mb-2">Theme: {EVENT.theme}</p>
          <h1 className="text-4xl sm:text-5xl font-bold mb-3 tracking-tight">{EVENT.name}</h1>
          <p className="text-purple-200 text-base mb-6 max-w-lg">{EVENT.description}</p>
          <div className="flex flex-wrap gap-3 text-sm mb-8">
            {[
              { icon: Calendar, text: EVENT.date },
              { icon: Clock, text: EVENT.time },
              { icon: MapPin, text: EVENT.venue },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5">
                <Icon className="w-3.5 h-3.5 text-purple-300" />
                <span>{text}</span>
              </div>
            ))}
          </div>

          {/* Countdown */}
          <div>
            <p className="text-purple-300 text-xs uppercase tracking-widest mb-3 font-semibold">Event starts in</p>
            <div className="flex items-start gap-3 sm:gap-5">
              <CountdownUnit value={countdown.days} label="Days" />
              <span className="text-2xl text-purple-400 font-bold mt-3">:</span>
              <CountdownUnit value={countdown.hours} label="Hours" />
              <span className="text-2xl text-purple-400 font-bold mt-3">:</span>
              <CountdownUnit value={countdown.mins} label="Mins" />
              <span className="text-2xl text-purple-400 font-bold mt-3">:</span>
              <CountdownUnit value={countdown.secs} label="Secs" />
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Availability Banner */}
      <div className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-slate-700 text-sm font-semibold">
              {remaining} of {EVENT.totalTickets} tickets remaining
            </span>
          </div>
          <div className="flex-1 w-full sm:w-auto bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-700"
              style={{ width: `${pctSold}%` }}
            />
          </div>
          <span className="text-xs text-slate-400 flex-shrink-0">{pctSold}% sold</span>
        </div>
      </div>

      {/* Ticket Cards */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-10 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Choose Your Ticket</h2>
          <p className="text-slate-500 mb-6">Register below and pay at the venue gate</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {TICKET_TYPES.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} remaining={remaining} />
            ))}
          </div>
        </div>

        <p className="text-center text-slate-400 text-sm">
          Tickets are non-refundable · Please arrive 30 minutes early
        </p>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white">
        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-purple-300" />
            <span className="font-bold text-lg tracking-tight">{EVENT.name}</span>
          </div>
          <p className="text-amber-300 font-semibold text-sm uppercase tracking-widest italic">
            "Transforming a generation"
          </p>
          <p className="text-purple-300 text-xs">Theme: {EVENT.theme} · {EVENT.date} · {EVENT.venue}</p>
          <p className="text-purple-400 text-xs mt-1">© 2026 Musick & Tea. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
