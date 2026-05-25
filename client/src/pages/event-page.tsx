import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin, Calendar, Clock, Ticket, User, Mail, Phone, Instagram,
  ShieldCheck, ArrowLeft, Building2, CreditCard, Crown, AlertCircle, Copy, Check
} from "lucide-react";

declare global {
  interface Window {
    PaystackPop: any;
    Stripe: any;
    FlutterwaveCheckout: (config: any) => { close: () => void };
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublicTicketType {
  id: string;
  name: string;
  price: number;
  quantityAvailable: number;
  quantitySold: number;
  remaining: number;
}

interface PublicEvent {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  location: string;
  maxTickets: number;
  paymentMethod: string;
  description: string | null;
  coverImageUrl: string | null;
  ticketTypes: PublicTicketType[];
  organizer: {
    businessName: string;
    subaccountCode: string;
    testSubaccountCode: string | null;
    bankName: string;
    accountNumber: string;
  } | null;
  branding: {
    name: string;
    logoUrl: string | null;
    isPro: boolean;
    brandTheme?: {
      primary: string;
      accent: string;
      background: string;
      surface: string;
      text: string;
    } | null;
  };
  paystackPublicKey: string;
  paystackEnv?: "test" | "live";
  stripePublicKey: string;
  flutterwavePublicKey: string;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function formatPrice(n: number, currency = "NGN") {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `NGN ${n.toLocaleString()}`;
  }
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  } catch { return d; }
}

function fmtTime12h(t: string): string {
  try {
    const [hStr, mStr] = t.split(":");
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  } catch { return t; }
}

function getEventDateTime(date: string, startTime: string | null): Date {
  if (startTime) {
    return new Date(`${date}T${startTime}`);
  }
  // fallback: midnight of the event date
  return new Date(`${date}T00:00:00`);
}

function Countdown({ date, startTime, accent }: { date: string; startTime: string | null; accent: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const target = getEventDateTime(date, startTime);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
    // check if it ended (treat event as ~4h long)
    const endedMs = now.getTime() - target.getTime();
    const status = endedMs < 4 * 60 * 60 * 1000 ? "live" : "ended";
    return (
      <div className="flex justify-center mt-2 mb-1">
        <div className="px-6 py-2 rounded-full border text-sm font-black uppercase tracking-widest"
          style={{ borderColor: accent, color: accent, backgroundColor: `${accent}15` }}>
          {status === "live" ? "🔴 Event is Live" : "Event has ended"}
        </div>
      </div>
    );
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const dd = Math.floor(totalSeconds / 86400);
  const hh = Math.floor((totalSeconds % 86400) / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;

  const urgent = diffMs < 24 * 60 * 60 * 1000;

  const blocks = [
    { label: "Days", value: dd },
    { label: "Hours", value: hh },
    { label: "Minutes", value: mm },
    { label: "Seconds", value: ss },
  ];

  return (
    <div className="flex justify-center gap-2 sm:gap-4 mt-4 mb-1">
      {blocks.map(({ label, value }) => (
        <div key={label} className="flex flex-col items-center">
          <div className="flex items-center justify-center w-14 sm:w-16 h-14 sm:h-16 rounded-xl border"
            style={{
              borderColor: urgent ? accent : "#27272a",
              backgroundColor: urgent ? `${accent}10` : "#18181b",
            }}>
            <span className="text-2xl sm:text-3xl font-black tabular-nums"
              style={{ color: urgent ? accent : "#ffffff" }}>
              {String(value).padStart(2, "0")}
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-widest mt-1.5"
            style={{ color: urgent ? accent : "#52525b" }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

async function loadScript(src: string): Promise<void> {
  if (document.querySelector(`script[src="${src}"]`)) return;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(s);
  });
}

// ─── Registration schema ──────────────────────────────────────────────────────

const registrationSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  customerEmail: z.string().email("Please enter a valid email"),
  customerPhone: z.string().min(7, "Please enter a valid phone number"),
  instagramHandle: z.string().optional(),
  quantity: z.number().min(1).max(20),
});
type RegistrationForm = z.infer<typeof registrationSchema>;

// ─── Input component ──────────────────────────────────────────────────────────

function DarkInput({ icon: Icon, field, placeholder, type = "text" }: any) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 z-10" />
      <Input {...field} type={type} placeholder={placeholder}
        className="pl-10 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 h-11" />
    </div>
  );
}

// ─── Purchase form ────────────────────────────────────────────────────────────

type PaymentPhase = "form" | "stripe" | "bank";

function PurchaseForm({
  ticket, event, onSuccess,
}: {
  ticket: PublicTicketType;
  event: PublicEvent;
  onSuccess: (orderId: string, name: string, total: number, qty: number, status?: string) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [phase, setPhase] = useState<PaymentPhase>("form");
  const [formData, setFormData] = useState<RegistrationForm | null>(null);
  const [processing, setProcessing] = useState(false);
  const [stripeObj, setStripeObj] = useState<any>(null);
  const [cardElement, setCardElement] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string>("");
  const stripeCardRef = useRef<HTMLDivElement>(null);

  const paymentMethod = event.paymentMethod;
  const primary = event.branding?.brandTheme?.primary ?? "#F59E0B";

  const form = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { customerName: "", customerEmail: "", customerPhone: "", instagramHandle: "", quantity: 1 },
  });
  const quantity = form.watch("quantity");
  const total = ticket.price * quantity;

  // ── Stripe init ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "stripe" || !formData || stripeObj) return;
    let alive = true;

    async function initStripe() {
      try {
        setProcessing(true);
        const stripeKey = event.stripePublicKey;
        if (!stripeKey) throw new Error("Stripe is not configured for this event.");

        await loadScript("https://js.stripe.com/v3/");
        const stripe = window.Stripe(stripeKey);

        // Server computes the amount from DB — client only sends ticketTypeId + quantity
        const res = await apiRequest("POST", `/api/public/events/${event.id}/purchase/stripe-intent`, {
          ticketTypeId: ticket.id,
          quantity: formData!.quantity,
          customerEmail: formData!.customerEmail,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to create payment intent");

        if (!alive) return;
        setClientSecret(data.clientSecret);

        const elements = stripe.elements();
        const card = elements.create("card", {
          style: {
            base: { color: "#fff", fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: "15px", "::placeholder": { color: "#71717a" } },
            invalid: { color: "#f87171" },
          },
        });
        if (stripeCardRef.current) card.mount(stripeCardRef.current);
        setStripeObj(stripe);
        setCardElement(card);
      } catch (err: any) {
        toast({ title: "Card setup failed", description: err.message, variant: "destructive" });
        setPhase("form");
      } finally {
        if (alive) setProcessing(false);
      }
    }
    initStripe();
    return () => { alive = false; };
  }, [phase]);

  async function confirmStripePayment() {
    if (!stripeObj || !cardElement || !clientSecret) return;
    setProcessing(true);
    try {
      const { paymentIntent, error } = await stripeObj.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement, billing_details: { name: formData!.customerName, email: formData!.customerEmail } },
      });
      if (error) throw new Error(error.message);
      if (paymentIntent?.status === "succeeded") {
        // Server re-verifies intent and re-computes total — client sends customer details only
        const res = await apiRequest("POST", `/api/public/events/${event.id}/purchase/stripe`, {
          paymentIntentId: paymentIntent.id,
          ticketTypeId: ticket.id,
          quantity: formData!.quantity,
          customerName: formData!.customerName,
          customerEmail: formData!.customerEmail,
          customerPhone: formData!.customerPhone,
          instagramHandle: formData!.instagramHandle || null,
        });
        const order = await res.json();
        if (!res.ok) throw new Error(order.message);
        qc.invalidateQueries({ queryKey: [`/api/public/events/${event.id}`] });
        onSuccess(order.id, formData!.customerName, total, formData!.quantity);
      } else {
        throw new Error("Payment not completed. Please try again.");
      }
    } catch (err: any) {
      toast({ title: "Payment failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  }

  async function confirmBankTransfer() {
    if (!formData) return;
    setProcessing(true);
    try {
      const res = await apiRequest("POST", `/api/public/events/${event.id}/purchase/bank`, {
        ticketTypeId: ticket.id,
        quantity: formData.quantity,
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone,
        instagramHandle: formData.instagramHandle || null,
      });
      const order = await res.json();
      if (!res.ok) throw new Error(order.message);
      qc.invalidateQueries({ queryKey: [`/api/public/events/${event.id}`] });
      onSuccess(order.id, formData.customerName, total, formData.quantity, "awaiting_transfer");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  }

  async function onFormSubmit(data: RegistrationForm) {
    setFormData(data);

    if (paymentMethod === "paystack") {
      const pubKey = event.paystackPublicKey;
      if (!pubKey) {
        toast({ title: "Payment not configured", description: "Paystack key is missing.", variant: "destructive" });
        return;
      }

      // Ensure the Paystack inline script is loaded (may already be in <head>)
      try {
        await loadScript("https://js.paystack.co/v1/inline.js");
      } catch {
        toast({ title: "Payment system unavailable", description: "Could not load payment script. Please refresh.", variant: "destructive" });
        return;
      }
      if (!window.PaystackPop) {
        toast({ title: "Payment system unavailable", description: "Paystack did not initialise. Please refresh.", variant: "destructive" });
        return;
      }

      // Confirm key is present right before launch
      console.log("[paystack] key prefix:", pubKey.slice(0, 10), "| length:", pubKey.length);

      setProcessing(true);

      const prefix = event.title.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase() || "EVT";
      const ref = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      // 5-second safety net — reset button if popup never opens/responds
      let settled = false;
      const launchTimeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          setProcessing(false);
          toast({ title: "Payment could not launch", description: "Payment could not launch, please try again.", variant: "destructive" });
        }
      }, 5000);

      const paystackConfig: any = {
        key: pubKey,
        email: data.customerEmail,
        amount: total * 100,
        currency: "NGN",
        ref,
        callback: (response: any) => {
          settled = true;
          clearTimeout(launchTimeout);
          // Paystack v1 requires a plain (non-async) callback — run async work in an IIFE
          (async () => {
            const res = await apiRequest("POST", `/api/public/events/${event.id}/purchase/paystack`, {
              reference: response.reference,
              ticketTypeId: ticket.id,
              quantity: data.quantity,
              customerName: data.customerName,
              customerEmail: data.customerEmail,
              customerPhone: data.customerPhone,
              instagramHandle: data.instagramHandle || null,
            });
            const order = await res.json();
            if (!res.ok) {
              toast({ title: "Verification failed", description: order.message, variant: "destructive" });
              setProcessing(false);
              return;
            }
            qc.invalidateQueries({ queryKey: [`/api/public/events/${event.id}`] });
            onSuccess(order.id, data.customerName, total, data.quantity);
          })();
        },
        onClose: () => {
          settled = true;
          clearTimeout(launchTimeout);
          setProcessing(false);
          toast({ title: "Payment cancelled", description: "You closed the payment window.", variant: "destructive" });
        },
        onError: (err: any) => {
          settled = true;
          clearTimeout(launchTimeout);
          setProcessing(false);
          toast({ title: "Payment error", description: err?.message || "Paystack encountered an error. Please try again.", variant: "destructive" });
        },
      };

      if (event.organizer?.subaccountCode) {
        paystackConfig.subaccount = event.organizer.subaccountCode;
        paystackConfig.bearer = "subaccount";
      }

      try {
        window.PaystackPop.setup(paystackConfig).openIframe();
        // openIframe() is synchronous — popup is now visible, cancel timeout
        settled = true;
        clearTimeout(launchTimeout);
      } catch (err: any) {
        settled = true;
        clearTimeout(launchTimeout);
        setProcessing(false);
        toast({ title: "Payment could not launch", description: err?.message || "Could not open payment popup. Please try again.", variant: "destructive" });
      }
      return;
    }

    if (paymentMethod === "flutterwave") {
      const pubKey = event.flutterwavePublicKey;
      if (!pubKey) {
        toast({ title: "Payment not configured", description: "Flutterwave key is missing.", variant: "destructive" });
        return;
      }
      try {
        await loadScript("https://checkout.flutterwave.com/v3.js");
      } catch {
        toast({ title: "Payment system unavailable", description: "Please refresh and try again.", variant: "destructive" });
        return;
      }
      if (!window.FlutterwaveCheckout) {
        toast({ title: "Payment system unavailable", description: "Please refresh and try again.", variant: "destructive" });
        return;
      }
      setProcessing(true);
      const txRef = `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      window.FlutterwaveCheckout({
        public_key: pubKey,
        tx_ref: txRef,
        amount: total,
        currency: "NGN",
        customer: {
          email: data.customerEmail,
          phone_number: data.customerPhone,
          name: data.customerName,
        },
        payment_options: "card,banktransfer,ussd",
        customizations: {
          title: event.title,
          description: `${data.quantity} × ${ticket.name}`,
          logo: event.branding?.logoUrl || undefined,
        },
        callback: async (response: any) => {
          if (response.status === "successful" || response.status === "completed") {
            const res = await apiRequest("POST", `/api/public/events/${event.id}/purchase/flutterwave`, {
              transactionId: response.transaction_id,
              ticketTypeId: ticket.id,
              quantity: data.quantity,
              customerName: data.customerName,
              customerEmail: data.customerEmail,
              customerPhone: data.customerPhone,
              instagramHandle: data.instagramHandle || null,
            });
            const order = await res.json();
            if (!res.ok) {
              toast({ title: "Verification failed", description: order.message, variant: "destructive" });
              setProcessing(false);
              return;
            }
            qc.invalidateQueries({ queryKey: [`/api/public/events/${event.id}`] });
            onSuccess(order.id, data.customerName, total, data.quantity);
          } else {
            toast({ title: "Payment failed", description: "Transaction was not successful.", variant: "destructive" });
            setProcessing(false);
          }
        },
        onclose: () => {
          setProcessing(false);
          toast({ title: "Payment cancelled", description: "You closed the payment window.", variant: "destructive" });
        },
      });
      return;
    }

    if (paymentMethod === "stripe") { setPhase("stripe"); return; }
    if (paymentMethod === "bank_transfer") { setPhase("bank"); return; }
  }

  const BackBtn = () => (
    <button type="button"
      onClick={() => { setPhase("form"); setStripeObj(null); setCardElement(null); }}
      className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors mb-4">
      <ArrowLeft className="w-3.5 h-3.5" /> Back to form
    </button>
  );

  const Summary = () => (
    <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 mb-5">
      <div>
        <p className="text-zinc-500 text-xs">{formData?.customerName} · {ticket.name}</p>
        <p className="text-white font-bold text-sm">{formData?.quantity} × {formatPrice(ticket.price)}</p>
      </div>
      <span className="font-black text-xl" style={{ color: primary }}>{formatPrice(total)}</span>
    </div>
  );

  return (
    <div className="pt-5 mt-5 border-t border-zinc-700">
      {phase === "form" && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4">
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
            <FormField control={form.control} name="quantity" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Number of Tickets</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-4">
                    <button type="button"
                      onClick={() => field.onChange(Math.max(1, field.value - 1))}
                      className="w-9 h-9 rounded-full border border-zinc-600 text-zinc-300 hover:border-amber-400 hover:text-amber-400 transition-colors flex items-center justify-center text-xl font-bold">−</button>
                    <span className="text-white font-bold text-xl w-8 text-center">{field.value}</span>
                    <button type="button"
                      onClick={() => field.onChange(Math.min(Math.min(20, ticket.remaining), field.value + 1))}
                      className="w-9 h-9 rounded-full border border-zinc-600 text-zinc-300 hover:border-amber-400 hover:text-amber-400 transition-colors flex items-center justify-center text-xl font-bold">+</button>
                  </div>
                </FormControl>
              </FormItem>
            )} />

            <div className="flex items-center justify-between bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3">
              <span className="text-zinc-400 text-sm">Total</span>
              <span className="font-black text-xl" style={{ color: primary }}>{formatPrice(total)}</span>
            </div>

            <button type="submit" disabled={processing}
              className="w-full py-4 rounded-lg font-black uppercase tracking-widest text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={paymentMethod === "paystack" || paymentMethod === "stripe" || paymentMethod === "flutterwave"
                ? { backgroundColor: primary, color: "#000" }
                : { border: `2px solid ${primary}`, color: primary }}>
              {processing
                ? <><span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Processing...</>
                : paymentMethod === "paystack"
                  ? <><ShieldCheck className="w-4 h-4" /> Pay {formatPrice(total)} with Paystack</>
                  : paymentMethod === "flutterwave"
                    ? <><ShieldCheck className="w-4 h-4" /> Pay {formatPrice(total)} with Flutterwave</>
                    : paymentMethod === "stripe"
                      ? <><CreditCard className="w-4 h-4" /> Continue to Card Payment</>
                      : <><Building2 className="w-4 h-4" /> View Bank Details</>
              }
            </button>

            <p className="text-center text-zinc-600 text-xs flex items-center justify-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              {paymentMethod === "bank_transfer"
                ? "Your details are kept private and secure"
                : "Secured payment · Your details are never stored"}
            </p>
          </form>
        </Form>
      )}

      {phase === "stripe" && (
        <div>
          <BackBtn />
          <Summary />
          <div className="mb-4">
            <label className="text-zinc-400 text-xs uppercase tracking-widest font-semibold block mb-2">Card Details</label>
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3.5">
              {!stripeObj && (
                <div className="flex items-center gap-2 text-zinc-500 text-sm">
                  <span className="w-4 h-4 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" /> Loading secure card form...
                </div>
              )}
              <div ref={stripeCardRef} className={stripeObj ? "block" : "hidden"} />
            </div>
          </div>
          <button onClick={confirmStripePayment} disabled={processing || !stripeObj}
            className="w-full py-4 rounded-lg font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            style={{ backgroundColor: primary, color: "#000" }}>
            {processing
              ? <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Confirming...</>
              : <><ShieldCheck className="w-4 h-4" /> Confirm Payment · {formatPrice(total)}</>
            }
          </button>
        </div>
      )}

      {phase === "bank" && (
        <div>
          <BackBtn />
          <Summary />
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 mb-5 space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4" style={{ color: primary }} />
              <span className="text-white font-bold text-sm">Bank Transfer Details</span>
            </div>
            {[
              { label: "Business Name", value: event.organizer?.businessName },
              { label: "Bank Name", value: event.organizer?.bankName },
              { label: "Account Number", value: event.organizer?.accountNumber },
            ].filter((r) => r.value).map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-2 last:border-0 last:pb-0">
                <span className="text-zinc-500 text-xs uppercase tracking-widest">{row.label}</span>
                <span className="text-white font-mono font-bold text-sm text-right">{row.value || "—"}</span>
              </div>
            ))}
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-2">
              <span className="text-zinc-500 text-xs uppercase tracking-widest">Amount</span>
              <span className="font-black text-base text-right" style={{ color: primary }}>{formatPrice(total)}</span>
            </div>
          </div>
          <button onClick={confirmBankTransfer} disabled={processing}
            className="w-full py-4 rounded-lg font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            style={{ backgroundColor: primary, color: "#000" }}>
            {processing
              ? <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Reserving...</>
              : <><Ticket className="w-4 h-4" /> Reserve My Spot</>
            }
          </button>
          <p className="text-center text-zinc-600 text-xs mt-3">Click to reserve, then complete the bank transfer to confirm your spot.</p>
        </div>
      )}
    </div>
  );
}

// ─── Ticket card ──────────────────────────────────────────────────────────────

function TicketCard({ ticket, event, onSuccess }: {
  ticket: PublicTicketType;
  event: PublicEvent;
  onSuccess: (orderId: string, name: string, total: number, qty: number, status?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const soldOut = ticket.remaining <= 0;
  const primary = event.branding?.brandTheme?.primary ?? "#F59E0B";

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="p-2.5 rounded-lg bg-amber-400/10">
            <Ticket className="w-5 h-5 text-amber-400" />
          </div>
          {soldOut
            ? <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">Sold Out</span>
            : <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                {ticket.remaining} left
              </span>
          }
        </div>

        <h3 className="text-xl font-black uppercase tracking-wide text-white mb-1">{ticket.name}</h3>

        <div className="mb-4">
          <span className="text-3xl font-black text-white">{formatPrice(ticket.price)}</span>
          <span className="text-zinc-600 text-sm ml-2">· per ticket</span>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-zinc-600 text-xs">{ticket.quantitySold} of {ticket.quantityAvailable} sold</span>
            <span className="text-zinc-600 text-xs">{Math.round((ticket.quantitySold / Math.max(ticket.quantityAvailable, 1)) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (ticket.quantitySold / Math.max(ticket.quantityAvailable, 1)) * 100)}%`,
                backgroundColor: ticket.remaining === 0 ? "#ef4444" : primary,
              }} />
          </div>
        </div>

        {soldOut
          ? <div className="w-full py-3 rounded-lg border border-zinc-700 text-center text-zinc-600 text-sm font-bold uppercase tracking-widest">
              Sold Out
            </div>
          : <button onClick={() => setOpen((v) => !v)}
              className="w-full py-3.5 rounded-lg font-bold uppercase tracking-widest text-sm transition-all duration-200 flex items-center justify-center gap-2"
              style={open
                ? { backgroundColor: "#27272a", color: "#fff", border: "1px solid #52525b" }
                : { border: `2px solid ${primary}`, color: primary }
              }>
              {open
                ? <><ArrowLeft className="w-4 h-4" /> Close</>
                : <><Ticket className="w-4 h-4" /> Get Ticket</>
              }
            </button>
        }

        {open && <PurchaseForm ticket={ticket} event={event} onSuccess={onSuccess} />}
      </div>
    </div>
  );
}

// ─── Event Page ───────────────────────────────────────────────────────────────

export default function EventPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState(false);
  const eventId = params.id;

  const { data: event, isLoading, isError } = useQuery<PublicEvent>({
    queryKey: [`/api/public/events/${eventId}`],
    enabled: !!eventId,
    refetchInterval: 30000,
  });

  function handleSuccess(orderId: string, name: string, total: number, qty: number, status = "confirmed") {
    const eventTitle = event?.title || "";
    navigate(`/success?orderId=${orderId}&name=${encodeURIComponent(name)}&total=${total}&tickets=${qty}&status=${status}&eventTitle=${encodeURIComponent(eventTitle)}`);
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex items-center gap-3 text-zinc-500">
          <div className="w-5 h-5 border-2 border-zinc-700 border-t-amber-400 rounded-full animate-spin" />
          Loading event...
        </div>
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-zinc-950">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full border border-zinc-700 bg-zinc-900 flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8 text-zinc-600" />
          </div>
          <h1 className="text-white font-black text-2xl uppercase tracking-wide mb-2">Event Not Found</h1>
          <p className="text-zinc-500 text-sm">This event doesn't exist or is no longer available.</p>
        </div>
      </div>
    );
  }

  const formattedDate = fmtDate(event.date);
  const totalAvailable = event.ticketTypes.reduce((s, t) => s + t.quantityAvailable, 0);
  const totalSold = event.ticketTypes.reduce((s, t) => s + t.quantitySold, 0);
  const totalRemaining = event.ticketTypes.reduce((s, t) => s + t.remaining, 0);
  const pctSold = totalAvailable > 0 ? Math.min(100, Math.round((totalSold / totalAvailable) * 100)) : 0;

  const bt = event.branding?.brandTheme;
  const primary = bt?.primary ?? "#F59E0B";
  const bgColor = bt?.background ?? "#09090b";
  const surfaceColor = bt?.surface ?? "#18181b";
  const textColor = bt?.text ?? "#ffffff";

  const isTestMode = event.paystackEnv === "test" || import.meta.env.VITE_PAYSTACK_ENV === "test";

  return (
    <div className="min-h-screen flex flex-col text-zinc-100" style={{ backgroundColor: bgColor, color: textColor }}>
      {isTestMode && (
        <div className="bg-yellow-400 text-black text-center text-xs font-bold py-2 px-4 tracking-wide">
          TEST MODE — No real payments will be processed
        </div>
      )}
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(to bottom, ${surfaceColor}, ${bgColor})` }}>
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: `radial-gradient(circle, ${primary} 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-950" />

        {/* Cover image */}
        {event.coverImageUrl && (
          <div className="relative w-full max-h-[420px] overflow-hidden">
            <img
              src={event.coverImageUrl}
              alt={event.title}
              className="w-full object-cover max-h-[420px]"
              style={{ objectPosition: "center" }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-zinc-950" />
          </div>
        )}

        <div className={`relative max-w-3xl mx-auto px-4 pb-14 ${event.coverImageUrl ? "pt-8" : "pt-12"}`}>
          <div className="flex flex-col items-center text-center mb-8">
            {/* Organizer branding — logo if pro+logoUrl, otherwise icon */}
            {!event.coverImageUrl && (
              event.branding?.isPro && event.branding.logoUrl ? (
                <img
                  src={event.branding.logoUrl}
                  alt={event.branding.name}
                  className="h-14 max-w-[180px] object-contain mb-6"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl border border-amber-400/20 bg-amber-400/10 flex items-center justify-center mb-6">
                  <Ticket className="w-8 h-8 text-amber-400" />
                </div>
              )
            )}
            <p className="text-xs font-bold uppercase tracking-[0.3em] mb-2" style={{ color: primary }}>
              {event.branding?.name ?? event.organizer?.businessName}
            </p>
            <h1 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tight leading-none mb-4">
              {event.title}
            </h1>
            <div className="flex flex-wrap justify-center gap-3 mb-4">
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 text-sm text-zinc-300">
                <Calendar className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>{formattedDate}</span>
              </div>
              {event.startTime && (
                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 text-sm text-zinc-300">
                  <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span>{fmtTime12h(event.startTime)}</span>
                </div>
              )}
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 text-sm text-zinc-300">
                <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>{event.location}</span>
              </div>
            </div>

            <Countdown date={event.date} startTime={event.startTime} accent={primary} />

            {event.description && (
              <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-xl">
                {event.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Availability bar */}
      <div className="border-y border-zinc-800 bg-zinc-950">
        <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${totalRemaining > 0 ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            <span className="text-zinc-400 text-xs font-semibold">
              {totalRemaining > 0 ? `${totalRemaining} tickets remaining` : "Sold out"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-40 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pctSold}%`, backgroundColor: primary }} />
            </div>
            <span className="text-zinc-600 text-xs">{pctSold}% sold</span>
          </div>
        </div>
      </div>

      {/* Ticket types */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-black uppercase text-white tracking-wide">Get Your Tickets</h2>
          <p className="text-zinc-500 mt-2 text-sm">Select a ticket type to get started</p>
        </div>

        {event.ticketTypes.length === 0 ? (
          <div className="text-center py-16 text-zinc-600">
            <Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No tickets available for this event yet.</p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${event.ticketTypes.length > 1 ? "sm:grid-cols-2" : "max-w-md mx-auto"} gap-6`}>
            {event.ticketTypes.map((tt) => (
              <TicketCard key={tt.id} ticket={tt} event={event} onSuccess={handleSuccess} />
            ))}
          </div>
        )}

        <p className="text-center text-zinc-700 text-xs pt-8">
          Tickets are non-refundable · {event.title}
        </p>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-950">
        <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col items-center gap-3">
          <button onClick={copyLink}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors text-xs font-semibold">
            {copied ? <><Check className="w-3.5 h-3.5 text-green-400" /> Link copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy event link</>}
          </button>
          {event.branding?.isPro ? null : (
            <p className="text-zinc-700 text-xs">Powered by Showgate</p>
          )}
        </div>
      </footer>
    </div>
  );
}
