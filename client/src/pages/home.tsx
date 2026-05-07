import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Calendar, Clock, Ticket, User, Mail, Phone, Crown, Instagram, ChevronUp, ShieldCheck } from "lucide-react";
import mntLogo from "@assets/02._MnT_White_1778142804399.png";

declare global {
  interface Window {
    PaystackPop: {
      setup(options: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref: string;
        metadata?: Record<string, any>;
        callback: (response: { reference: string }) => void;
        onClose: () => void;
      }): { openIframe(): void };
    };
  }
}

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;

const EVENT = {
  name: "Musick & Tea 11",
  theme: "The Name of Jesus",
  date: "Sunday, December 13, 2026",
  dateISO: "2026-12-13T15:00:00",
  time: "3:00 PM",
  venue: "Odillins Event Center",
  description: "A faith-driven evening of worship, music, and community — centred on the Name above all names.",
  totalTickets: 250,
};

const TICKET_TYPES = [
  {
    id: "regular",
    name: "Regular",
    price: 2000,
    description: "Your entry into the Musick & Tea 11 concert experience.",
    icon: Ticket,
    gold: false,
    perks: ["Full concert access", "Event programme", "Welcome refreshment"],
    ticketsIncluded: 1,
    allowQuantity: true,
  },
  {
    id: "vip-support",
    name: "VIP Support",
    price: 100000,
    description: "Support the vision and enjoy an elevated experience.",
    icon: Crown,
    gold: true,
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

function formatPrice(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(n);
}

function useCountdown(targetISO: string) {
  const calc = () => {
    const diff = new Date(targetISO).getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0 };
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      mins: Math.floor((diff % 3600000) / 60000),
      secs: Math.floor((diff % 60000) / 1000),
    };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => { const id = setInterval(() => setTime(calc()), 1000); return () => clearInterval(id); }, []);
  return time;
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
        <span className="text-2xl sm:text-3xl font-black text-amber-400 tabular-nums">{String(value).padStart(2, "0")}</span>
      </div>
      <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-semibold">{label}</span>
    </div>
  );
}

function DarkInput({ icon: Icon, field, placeholder, type = "text" }: any) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 z-10" />
      <Input {...field} type={type} placeholder={placeholder}
        className="pl-10 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-amber-400 focus:ring-amber-400/20 h-11" />
    </div>
  );
}

function TicketForm({ ticket, onSuccess }: {
  ticket: typeof TICKET_TYPES[0];
  onSuccess: (orderId: string, name: string, total: number, qty: number) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [paying, setPaying] = useState(false);

  const form = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { customerName: "", customerEmail: "", customerPhone: "", instagramHandle: "", quantity: 1 },
  });

  const quantity = form.watch("quantity");
  const total = ticket.price * quantity;

  const verifyMutation = useMutation({
    mutationFn: async ({ reference, data }: { reference: string; data: RegistrationForm }) => {
      const orderData = {
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        instagramHandle: data.instagramHandle || null,
        ticketType: ticket.name,
        quantity: data.quantity,
        totalAmount: ticket.price * data.quantity,
      };
      const res = await apiRequest("POST", "/api/payments/verify", { reference, orderData });
      return res.json();
    },
    onSuccess: (order, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/tickets/availability"] });
      onSuccess(order.id, vars.data.customerName, ticket.price * vars.data.quantity, vars.data.quantity * ticket.ticketsIncluded);
    },
    onError: (err: any) => {
      setPaying(false);
      toast({ title: "Payment verification failed", description: err.message, variant: "destructive" });
    },
  });

  function onSubmit(data: RegistrationForm) {
    if (!PAYSTACK_PUBLIC_KEY) {
      toast({
        title: "Payment not configured",
        description: "Paystack public key is missing. Please add VITE_PAYSTACK_PUBLIC_KEY.",
        variant: "destructive",
      });
      return;
    }

    if (!window.PaystackPop) {
      toast({ title: "Payment system unavailable", description: "Please refresh and try again.", variant: "destructive" });
      return;
    }

    setPaying(true);

    const ref = `MNT11-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const handler = window.PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: data.customerEmail,
      amount: total * 100,
      currency: "NGN",
      ref,
      metadata: {
        custom_fields: [
          { display_name: "Name", variable_name: "name", value: data.customerName },
          { display_name: "Phone", variable_name: "phone", value: data.customerPhone },
          { display_name: "Ticket Type", variable_name: "ticket_type", value: ticket.name },
          { display_name: "Quantity", variable_name: "quantity", value: String(data.quantity) },
        ],
      },
      callback: (response) => {
        verifyMutation.mutate({ reference: response.reference, data });
      },
      onClose: () => {
        setPaying(false);
        toast({ title: "Payment cancelled", description: "You closed the payment window.", variant: "destructive" });
      },
    });

    handler.openIframe();
  }

  const isLoading = paying || verifyMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 pt-5 mt-5 border-t border-zinc-700">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField control={form.control} name="customerName" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Full Name *</FormLabel>
              <FormControl><DarkInput icon={User} field={field} placeholder="Your full name" /></FormControl>
              <FormMessage className="text-red-400 text-xs" />
            </FormItem>
          )} />
          <FormField control={form.control} name="customerPhone" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Phone *</FormLabel>
              <FormControl><DarkInput icon={Phone} field={field} placeholder="+234 xxx xxx xxxx" /></FormControl>
              <FormMessage className="text-red-400 text-xs" />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="customerEmail" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Email *</FormLabel>
            <FormControl><DarkInput icon={Mail} field={field} placeholder="your@email.com" type="email" /></FormControl>
            <FormMessage className="text-red-400 text-xs" />
          </FormItem>
        )} />

        <FormField control={form.control} name="instagramHandle" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">
              Instagram <span className="normal-case text-zinc-600">(optional)</span>
            </FormLabel>
            <FormControl><DarkInput icon={Instagram} field={field} placeholder="@yourhandle" /></FormControl>
          </FormItem>
        )} />

        {ticket.allowQuantity && (
          <FormField control={form.control} name="quantity" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Number of Tickets</FormLabel>
              <FormControl>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => field.onChange(Math.max(1, field.value - 1))}
                    className="w-9 h-9 rounded-full border border-zinc-600 text-zinc-300 hover:border-amber-400 hover:text-amber-400 transition-colors flex items-center justify-center text-xl font-bold">−</button>
                  <span className="text-white font-bold text-xl w-8 text-center">{field.value}</span>
                  <button type="button" onClick={() => field.onChange(Math.min(20, field.value + 1))}
                    className="w-9 h-9 rounded-full border border-zinc-600 text-zinc-300 hover:border-amber-400 hover:text-amber-400 transition-colors flex items-center justify-center text-xl font-bold">+</button>
                </div>
              </FormControl>
            </FormItem>
          )} />
        )}

        <div className="flex items-center justify-between bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3">
          <span className="text-zinc-400 text-sm">Total</span>
          <span className="text-amber-400 font-black text-xl">{formatPrice(total)}</span>
        </div>

        <button type="submit" disabled={isLoading}
          className={`w-full py-4 rounded-lg font-black uppercase tracking-widest text-sm transition-all duration-200 flex items-center justify-center gap-2
            ${ticket.gold
              ? "bg-amber-400 hover:bg-amber-300 text-black"
              : "border-2 border-amber-400 text-amber-400 hover:bg-amber-400 hover:text-black"
            } disabled:opacity-50 disabled:cursor-not-allowed`}>
          {isLoading ? (
            <><span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              {verifyMutation.isPending ? "Confirming payment..." : "Opening payment..."}</>
          ) : (
            <><ShieldCheck className="w-4 h-4" /> Pay {formatPrice(total)} with Paystack</>
          )}
        </button>

        <p className="text-center text-zinc-600 text-xs flex items-center justify-center gap-1">
          <ShieldCheck className="w-3 h-3" /> Secured by Paystack · Your card details are never stored
        </p>
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

  return (
    <div className={`rounded-xl border transition-all duration-300 overflow-hidden
      ${ticket.gold
        ? "border-amber-400/60 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-[0_0_30px_rgba(234,179,8,0.12)]"
        : "border-zinc-700 bg-zinc-900"
      } ${open ? "shadow-2xl" : "hover:border-zinc-500"}`}>

      {ticket.gold && <div className="h-0.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />}

      <div className="p-6">
        <div className="flex items-start justify-between mb-5">
          <div className={`p-2.5 rounded-lg ${ticket.gold ? "bg-amber-400/15 text-amber-400" : "bg-zinc-800 text-zinc-300"}`}>
            <Icon className="w-6 h-6" />
          </div>
          <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full
            ${ticket.gold ? "bg-amber-400/15 text-amber-400 border border-amber-400/30" : "bg-zinc-800 text-zinc-400 border border-zinc-700"}`}>
            {ticket.gold ? "Exclusive" : "General"}
          </span>
        </div>

        <h3 className={`text-2xl font-black uppercase tracking-wide mb-1 ${ticket.gold ? "text-amber-400" : "text-white"}`}>
          {ticket.name}
        </h3>
        <p className="text-zinc-500 text-sm mb-5">{ticket.description}</p>

        <ul className="space-y-2.5 mb-6">
          {ticket.perks.map((perk) => (
            <li key={perk} className="flex items-start gap-3 text-sm text-zinc-300">
              <span className={`text-lg leading-none mt-0.5 flex-shrink-0 ${ticket.gold ? "text-amber-400" : "text-zinc-500"}`}>✦</span>
              {perk}
            </li>
          ))}
        </ul>

        <div className="mb-5">
          <span className={`text-4xl font-black ${ticket.gold ? "text-amber-400" : "text-white"}`}>{formatPrice(ticket.price)}</span>
          <span className="text-zinc-600 text-sm ml-2">
            {ticket.ticketsIncluded > 1 ? `· ${ticket.ticketsIncluded} tickets` : "· per ticket"}
          </span>
        </div>

        {remaining <= 0 ? (
          <div className="w-full py-3 rounded-lg border border-zinc-700 text-center text-zinc-600 text-sm font-bold uppercase tracking-widest">
            Sold Out
          </div>
        ) : (
          <button onClick={() => setOpen((v) => !v)}
            className={`w-full py-3.5 rounded-lg font-bold uppercase tracking-widest text-sm transition-all duration-200 flex items-center justify-center gap-2
              ${ticket.gold
                ? open ? "bg-amber-400/10 text-amber-400 border border-amber-400/40" : "bg-amber-400 hover:bg-amber-300 text-black"
                : open ? "bg-zinc-800 text-white border border-zinc-600" : "border-2 border-amber-400 text-amber-400 hover:bg-amber-400 hover:text-black"
              }`}>
            {open
              ? <><ChevronUp className="w-4 h-4" /> Close Form</>
              : <><Ticket className="w-4 h-4" /> Get Ticket</>}
          </button>
        )}

        {open && <TicketForm ticket={ticket} onSuccess={handleSuccess} />}
      </div>
    </div>
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d0d", color: "#f5f5f5" }}>

      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(180deg, #111 0%, #0d0d0d 100%)" }}>
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: "radial-gradient(circle, #EAB308 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0d0d0d]" />

        <div className="relative max-w-4xl mx-auto px-4 pt-12 pb-16">
          <div className="flex flex-col items-center text-center mb-10">
            <img src={mntLogo} alt="Musick & Tea Creative Ministry" className="w-40 sm:w-56 mb-6" style={{ mixBlendMode: "screen" }} />

            <div className="w-16 h-px bg-amber-400/50 mb-6" />

            <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.3em] mb-1">11th Edition</p>
            <p className="text-zinc-500 text-xs uppercase tracking-[0.3em] mb-3">Theme</p>
            <h1 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tight leading-none mb-2">
              {EVENT.theme}
            </h1>
            <p className="text-zinc-400 text-base mt-3 max-w-md">{EVENT.description}</p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {[
              { icon: Calendar, text: EVENT.date },
              { icon: Clock, text: EVENT.time },
              { icon: MapPin, text: EVENT.venue },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 text-sm text-zinc-300">
                <Icon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>{text}</span>
              </div>
            ))}
          </div>

          <div className="text-center mb-6">
            <p className="text-zinc-600 text-xs uppercase tracking-[0.3em] mb-5 font-semibold">Event Starts In</p>
            <div className="flex items-start justify-center gap-3 sm:gap-6">
              <CountdownUnit value={countdown.days} label="Days" />
              <span className="text-amber-400/40 text-3xl font-thin mt-4">|</span>
              <CountdownUnit value={countdown.hours} label="Hours" />
              <span className="text-amber-400/40 text-3xl font-thin mt-4">|</span>
              <CountdownUnit value={countdown.mins} label="Mins" />
              <span className="text-amber-400/40 text-3xl font-thin mt-4">|</span>
              <CountdownUnit value={countdown.secs} label="Secs" />
            </div>
          </div>
        </div>
      </div>

      {/* Ticket availability bar */}
      <div className="border-y border-zinc-800 bg-zinc-950">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-zinc-400 text-xs font-semibold">{remaining} of {EVENT.totalTickets} tickets remaining</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-40 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div className="h-full rounded-full bg-amber-400 transition-all duration-700" style={{ width: `${pctSold}%` }} />
            </div>
            <span className="text-zinc-600 text-xs">{pctSold}% sold</span>
          </div>
        </div>
      </div>

      {/* Tickets */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-12 space-y-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-black uppercase text-white tracking-wide">Get Your Tickets</h2>
          <p className="text-zinc-500 mt-2">Fill in your details and pay securely with Paystack</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {TICKET_TYPES.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} remaining={remaining} />
          ))}
        </div>

        {!PAYSTACK_PUBLIC_KEY && (
          <div className="border border-amber-400/30 bg-amber-400/5 rounded-lg p-4 text-center">
            <p className="text-amber-400 text-sm font-semibold">⚠ Payment not yet active</p>
            <p className="text-zinc-500 text-xs mt-1">Add <code className="text-amber-300">VITE_PAYSTACK_PUBLIC_KEY</code> to your environment variables to enable payments.</p>
          </div>
        )}

        <p className="text-center text-zinc-700 text-xs pt-4">
          Tickets are non-refundable · Please arrive 30 minutes early · {EVENT.name}
        </p>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-950">
        <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col items-center gap-4">
          <img src={mntLogo} alt="Musick & Tea Creative Ministry" className="w-24 opacity-80" style={{ mixBlendMode: "screen" }} />
          <p className="text-zinc-600 text-xs text-center">
            {EVENT.name} · Theme: {EVENT.theme}<br />
            {EVENT.date} · {EVENT.venue}
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-5 text-zinc-500 text-xs">
            <a href="mailto:contactus@musickntea.com" className="hover:text-amber-400 transition-colors">
              contactus@musickntea.com
            </a>
            <span className="hidden sm:inline text-zinc-700">·</span>
            <a href="tel:+2348136808888" className="hover:text-amber-400 transition-colors">
              08136808888
            </a>
          </div>
          <p className="text-zinc-800 text-xs">© 2026 Musick & Tea Creative Ministry. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
