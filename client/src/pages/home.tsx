import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin, Calendar, Clock, Ticket, User, Mail, Phone, Crown,
  Instagram, ChevronUp, ShieldCheck, Settings, ArrowLeft, Building2, CreditCard
} from "lucide-react";
import type { EventConfig, TicketTier } from "@shared/schema";

declare global {
  interface Window {
    PaystackPop: any;
    Stripe: any;
    paypal: any;
  }
}

type PublicConfig = Omit<EventConfig, "paystackSecretKey" | "stripeSecretKey" | "paypalSecretKey">;

const registrationSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  customerEmail: z.string().email("Please enter a valid email"),
  customerPhone: z.string().min(7, "Please enter a valid phone number"),
  instagramHandle: z.string().optional(),
  quantity: z.number().min(1).max(20),
});
type RegistrationForm = z.infer<typeof registrationSchema>;

function formatPrice(n: number, currency = "NGN") {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
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
  useEffect(() => { const id = setInterval(() => setTime(calc()), 1000); return () => clearInterval(id); }, [targetISO]);
  return time;
}

function CountdownUnit({ value, label, primary }: { value: number; label: string; primary: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
        <span className="text-2xl sm:text-3xl font-black tabular-nums" style={{ color: primary }}>{String(value).padStart(2, "0")}</span>
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
        className="pl-10 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 h-11" />
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

type PaymentPhase = "form" | "stripe" | "paypal" | "bank";

function TicketForm({ ticket, config, onSuccess }: {
  ticket: TicketTier;
  config: PublicConfig;
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
  const [paypalRendered, setPaypalRendered] = useState(false);
  const paypalRef = useRef<HTMLDivElement>(null);
  const stripeCardRef = useRef<HTMLDivElement>(null);

  const paymentMethod = config.paymentMethod || "paystack";
  const currency = config.currency || "NGN";
  const primary = config.primaryColor || "#F59E0B";

  const form = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { customerName: "", customerEmail: "", customerPhone: "", instagramHandle: "", quantity: 1 },
  });
  const quantity = form.watch("quantity");
  const total = ticket.price * quantity;

  function buildOrderData(data: RegistrationForm) {
    return {
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      instagramHandle: data.instagramHandle || null,
      ticketType: ticket.name,
      quantity: data.quantity,
      totalAmount: ticket.price * data.quantity,
    };
  }

  // ── Stripe init when phase = "stripe" ───────────────────────────────────
  useEffect(() => {
    if (phase !== "stripe" || !formData || stripeObj) return;
    let alive = true;

    async function initStripe() {
      try {
        setProcessing(true);
        await loadScript("https://js.stripe.com/v3/");
        const stripe = window.Stripe(config.stripePublicKey);

        const res = await apiRequest("POST", "/api/payments/stripe/create-intent", {
          amount: ticket.price * formData!.quantity,
          currency: currency.toLowerCase(),
          customerEmail: formData!.customerEmail,
          metadata: { name: formData!.customerName, ticket: ticket.name, qty: String(formData!.quantity) },
        });
        const { clientSecret: cs } = await res.json();

        if (!alive) return;
        setClientSecret(cs);

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

  // ── PayPal init when phase = "paypal" ───────────────────────────────────
  useEffect(() => {
    if (phase !== "paypal" || !formData || paypalRendered || !paypalRef.current) return;

    async function initPayPal() {
      try {
        const sdkCurrency = ["NGN", "GHS", "KES", "ZAR"].includes(currency) ? "USD" : currency;
        await loadScript(`https://www.paypal.com/sdk/js?client-id=${config.paypalClientId}&currency=${sdkCurrency}`);
        if (!window.paypal || !paypalRef.current) return;
        setPaypalRendered(true);

        window.paypal.Buttons({
          createOrder: async () => {
            const sdkAmount = ticket.price * formData!.quantity;
            const res = await apiRequest("POST", "/api/payments/paypal/create-order", { amount: sdkAmount, currency: sdkCurrency });
            const data = await res.json();
            if (!data.id) throw new Error(data.message || "Failed to create PayPal order");
            return data.id;
          },
          onApprove: async ({ orderID }: any) => {
            setProcessing(true);
            const res = await apiRequest("POST", "/api/payments/paypal/capture", { paypalOrderId: orderID, orderData: buildOrderData(formData!) });
            const order = await res.json();
            if (!res.ok) throw new Error(order.message);
            qc.invalidateQueries({ queryKey: ["/api/tickets/availability"] });
            onSuccess(order.id, formData!.customerName, total, formData!.quantity * ticket.ticketsIncluded);
          },
          onError: (err: any) => {
            toast({ title: "PayPal error", description: err.message || "Something went wrong.", variant: "destructive" });
            setProcessing(false);
          },
        }).render(paypalRef.current);
      } catch (err: any) {
        toast({ title: "PayPal setup failed", description: err.message, variant: "destructive" });
        setPhase("form");
      }
    }
    initPayPal();
  }, [phase, paypalRendered]);

  async function onFormSubmit(data: RegistrationForm) {
    setFormData(data);

    if (paymentMethod === "paystack") {
      if (!config.paystackPublicKey) { toast({ title: "Payment not configured", description: "Paystack key is missing.", variant: "destructive" }); return; }
      if (!window.PaystackPop) { toast({ title: "Payment system unavailable", description: "Please refresh and try again.", variant: "destructive" }); return; }
      setProcessing(true);
      const prefix = config.eventName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase() || "EVT";
      const ref = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      window.PaystackPop.setup({
        key: config.paystackPublicKey, email: data.customerEmail,
        amount: total * 100, currency, ref,
        callback: async (response: any) => {
          const orderData = buildOrderData(data);
          const res = await apiRequest("POST", "/api/payments/paystack/verify", { reference: response.reference, orderData });
          const order = await res.json();
          if (!res.ok) { toast({ title: "Verification failed", description: order.message, variant: "destructive" }); setProcessing(false); return; }
          qc.invalidateQueries({ queryKey: ["/api/tickets/availability"] });
          onSuccess(order.id, data.customerName, total, data.quantity * ticket.ticketsIncluded);
        },
        onClose: () => { setProcessing(false); toast({ title: "Payment cancelled", description: "You closed the payment window.", variant: "destructive" }); },
      }).openIframe();
      return;
    }

    if (paymentMethod === "stripe") { setPhase("stripe"); return; }
    if (paymentMethod === "paypal") { setPhase("paypal"); return; }
    if (paymentMethod === "bank_transfer") { setPhase("bank"); return; }
  }

  async function confirmStripePayment() {
    if (!stripeObj || !cardElement || !clientSecret) return;
    setProcessing(true);
    try {
      const { paymentIntent, error } = await stripeObj.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement, billing_details: { name: formData!.customerName, email: formData!.customerEmail } },
      });
      if (error) throw new Error(error.message);
      if (paymentIntent?.status === "succeeded") {
        const res = await apiRequest("POST", "/api/payments/stripe/verify", { paymentIntentId: paymentIntent.id, orderData: buildOrderData(formData!) });
        const order = await res.json();
        if (!res.ok) throw new Error(order.message);
        qc.invalidateQueries({ queryKey: ["/api/tickets/availability"] });
        onSuccess(order.id, formData!.customerName, total, formData!.quantity * ticket.ticketsIncluded);
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
      const res = await apiRequest("POST", "/api/payments/bank-transfer", { orderData: buildOrderData(formData) });
      const order = await res.json();
      if (!res.ok) throw new Error(order.message);
      qc.invalidateQueries({ queryKey: ["/api/tickets/availability"] });
      onSuccess(order.id, formData.customerName, total, formData.quantity * ticket.ticketsIncluded, "awaiting_transfer");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  }

  const isLoading = processing;

  const BackBtn = () => (
    <button type="button" onClick={() => { setPhase("form"); setStripeObj(null); setCardElement(null); setPaypalRendered(false); }}
      className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors mb-4">
      <ArrowLeft className="w-3.5 h-3.5" /> Back to form
    </button>
  );

  const Summary = () => (
    <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 mb-5">
      <div>
        <p className="text-zinc-500 text-xs">{formData?.customerName} · {ticket.name}</p>
        <p className="text-white font-bold text-sm">{formData?.quantity} × {formatPrice(ticket.price, currency)}</p>
      </div>
      <span className="font-black text-xl" style={{ color: primary }}>{formatPrice(total, currency)}</span>
    </div>
  );

  return (
    <div className="pt-5 mt-5 border-t border-zinc-700">
      {/* ── Registration Form ──────────────────────────────────────────────── */}
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
                  <FormControl><DarkInput icon={Phone} field={field} placeholder="+1 xxx xxx xxxx" /></FormControl>
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
                <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Instagram <span className="normal-case text-zinc-600">(optional)</span></FormLabel>
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
              <span className="font-black text-xl" style={{ color: primary }}>{formatPrice(total, currency)}</span>
            </div>

            <button type="submit" disabled={isLoading}
              className="w-full py-4 rounded-lg font-black uppercase tracking-widest text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={ticket.isVip ? { backgroundColor: primary, color: "#000" } : { border: `2px solid ${primary}`, color: primary }}>
              {isLoading
                ? <><span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Processing...</>
                : paymentMethod === "paystack" ? <><ShieldCheck className="w-4 h-4" /> Pay {formatPrice(total, currency)} with Paystack</>
                : paymentMethod === "stripe" ? <><CreditCard className="w-4 h-4" /> Continue to Card Payment</>
                : paymentMethod === "paypal" ? <><span className="font-black text-blue-400">Pay</span><span className="font-black text-blue-300">Pal</span> · Continue</>
                : <><Building2 className="w-4 h-4" /> View Bank Details</>
              }
            </button>

            <p className="text-center text-zinc-600 text-xs flex items-center justify-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              {paymentMethod === "bank_transfer" ? "Your details are kept private and secure" : "Secured payment · Your card details are never stored"}
            </p>
          </form>
        </Form>
      )}

      {/* ── Stripe Card ────────────────────────────────────────────────────── */}
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
          <button onClick={confirmStripePayment} disabled={isLoading || !stripeObj}
            className="w-full py-4 rounded-lg font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            style={{ backgroundColor: primary, color: "#000" }}>
            {isLoading
              ? <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Confirming...</>
              : <><ShieldCheck className="w-4 h-4" /> Confirm Payment · {formatPrice(total, currency)}</>
            }
          </button>
          <p className="text-center text-zinc-600 text-xs mt-3 flex items-center justify-center gap-1"><ShieldCheck className="w-3 h-3" /> Powered by Stripe · 256-bit SSL encryption</p>
        </div>
      )}

      {/* ── PayPal Buttons ─────────────────────────────────────────────────── */}
      {phase === "paypal" && (
        <div>
          <BackBtn />
          <Summary />
          {!paypalRendered && (
            <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm py-6">
              <span className="w-4 h-4 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" /> Loading PayPal...
            </div>
          )}
          <div ref={paypalRef} className="min-h-[50px]" />
          <p className="text-center text-zinc-600 text-xs mt-3">You'll be redirected to PayPal to complete your payment securely.</p>
        </div>
      )}

      {/* ── Bank Transfer ──────────────────────────────────────────────────── */}
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
              { label: "Bank Name", value: config.bankName },
              { label: "Account Name", value: config.bankAccountName },
              { label: "Account Number / IBAN", value: config.bankAccountNumber },
              config.bankRoutingCode ? { label: "Sort Code / Routing / SWIFT", value: config.bankRoutingCode } : null,
            ].filter(Boolean).map((row: any) => (
              <div key={row.label} className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-2 last:border-0 last:pb-0">
                <span className="text-zinc-500 text-xs uppercase tracking-widest">{row.label}</span>
                <span className="text-white font-mono font-bold text-sm text-right">{row.value || "—"}</span>
              </div>
            ))}
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-2">
              <span className="text-zinc-500 text-xs uppercase tracking-widest">Amount</span>
              <span className="font-black text-base text-right" style={{ color: primary }}>{formatPrice(total, currency)}</span>
            </div>
            {config.bankTransferInstructions && (
              <div className="mt-2 pt-2 border-t border-zinc-800">
                <p className="text-zinc-400 text-xs"><span className="text-zinc-600 uppercase text-[10px] tracking-widest block mb-1">Note</span>{config.bankTransferInstructions}</p>
              </div>
            )}
          </div>
          <button onClick={confirmBankTransfer} disabled={isLoading}
            className="w-full py-4 rounded-lg font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            style={{ backgroundColor: primary, color: "#000" }}>
            {isLoading
              ? <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Reserving...</>
              : <><Ticket className="w-4 h-4" /> Reserve My Spot</>
            }
          </button>
          <p className="text-center text-zinc-600 text-xs mt-3">Click above to reserve your spot, then make the bank transfer using the details above.</p>
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticket, config, remaining }: { ticket: TicketTier; config: PublicConfig; remaining: number }) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const primary = config.primaryColor;
  const Icon = ticket.isVip ? Crown : Ticket;

  function handleSuccess(orderId: string, name: string, total: number, qty: number, status = "confirmed") {
    navigate(`/success?orderId=${orderId}&name=${encodeURIComponent(name)}&total=${total}&tickets=${qty}&status=${status}`);
  }

  return (
    <div className="rounded-xl border transition-all duration-300 overflow-hidden"
      style={ticket.isVip
        ? { borderColor: primary + "99", background: "linear-gradient(180deg, #18181b 0%, #09090b 100%)", boxShadow: `0 0 30px ${primary}1e` }
        : { borderColor: "#3f3f46", backgroundColor: "#18181b" }
      }>
      {ticket.isVip && <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${primary}, ${config.highlightColor}, ${primary})` }} />}
      <div className="p-6">
        <div className="flex items-start justify-between mb-5">
          <div className="p-2.5 rounded-lg" style={ticket.isVip ? { backgroundColor: primary + "26", color: primary } : { backgroundColor: "#27272a", color: "#d4d4d8" }}>
            <Icon className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
            style={ticket.isVip
              ? { backgroundColor: primary + "26", color: primary, border: `1px solid ${primary}4d` }
              : { backgroundColor: "#27272a", color: "#a1a1aa", border: "1px solid #3f3f46" }}>
            {ticket.isVip ? "Exclusive" : "General"}
          </span>
        </div>
        <h3 className="text-2xl font-black uppercase tracking-wide mb-1" style={{ color: ticket.isVip ? primary : "#fff" }}>{ticket.name}</h3>
        <p className="text-zinc-500 text-sm mb-5">{ticket.description}</p>
        <ul className="space-y-2.5 mb-6">
          {ticket.perks.map((perk) => (
            <li key={perk} className="flex items-start gap-3 text-sm text-zinc-300">
              <span className="text-lg leading-none mt-0.5 flex-shrink-0" style={{ color: ticket.isVip ? primary : "#71717a" }}>✦</span>
              {perk}
            </li>
          ))}
        </ul>
        <div className="mb-5">
          <span className="text-4xl font-black" style={{ color: ticket.isVip ? primary : "#fff" }}>{formatPrice(ticket.price, config.currency || "NGN")}</span>
          <span className="text-zinc-600 text-sm ml-2">{ticket.ticketsIncluded > 1 ? `· ${ticket.ticketsIncluded} tickets` : "· per ticket"}</span>
        </div>

        {remaining <= 0
          ? <div className="w-full py-3 rounded-lg border border-zinc-700 text-center text-zinc-600 text-sm font-bold uppercase tracking-widest">Sold Out</div>
          : (
            <button onClick={() => setOpen((v) => !v)}
              className="w-full py-3.5 rounded-lg font-bold uppercase tracking-widest text-sm transition-all duration-200 flex items-center justify-center gap-2"
              style={open
                ? ticket.isVip ? { backgroundColor: primary + "1a", color: primary, border: `1px solid ${primary}66` } : { backgroundColor: "#27272a", color: "#fff", border: "1px solid #52525b" }
                : ticket.isVip ? { backgroundColor: primary, color: "#000" } : { border: `2px solid ${primary}`, color: primary }
              }>
              {open ? <><ChevronUp className="w-4 h-4" /> Close Form</> : <><Ticket className="w-4 h-4" /> Get Ticket</>}
            </button>
          )}
        {open && <TicketForm ticket={ticket} config={config} onSuccess={handleSuccess} />}
      </div>
    </div>
  );
}

export default function Home() {
  const { data: config, isLoading: configLoading } = useQuery<PublicConfig>({ queryKey: ["/api/config"] });
  const { data: availability } = useQuery<{ total: number; sold: number; remaining: number }>({
    queryKey: ["/api/tickets/availability"], refetchInterval: 30000,
  });

  const eventDate = config?.eventDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const countdown = useCountdown(eventDate);
  const totalTickets = config?.totalTickets ?? 200;
  const remaining = availability?.remaining ?? totalTickets;
  const sold = availability?.sold ?? 0;
  const pctSold = Math.min(100, Math.round((sold / totalTickets) * 100));
  const primary = config?.primaryColor || "#F59E0B";
  const bg = config?.bgColor || "#0d0d0d";

  // Load Paystack script if needed
  useEffect(() => {
    if (config?.paymentMethod === "paystack" && config.paystackPublicKey) {
      loadScript("https://js.paystack.co/v1/inline.js").catch(() => {});
    }
  }, [config?.paymentMethod, config?.paystackPublicKey]);

  if (configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bg }}>
        <div className="flex items-center gap-3 text-zinc-500">
          <div className="w-5 h-5 border-2 border-zinc-700 border-t-amber-400 rounded-full animate-spin" />
          Loading event...
        </div>
      </div>
    );
  }

  if (!config?.isPublished) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: bg }}>
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full border border-zinc-700 bg-zinc-900 flex items-center justify-center mx-auto mb-5">
            <Ticket className="w-8 h-8 text-zinc-600" />
          </div>
          <h1 className="text-white font-black text-2xl uppercase tracking-wide mb-2">Event Coming Soon</h1>
          <p className="text-zinc-500 text-sm">This event page hasn't been published yet. Check back soon.</p>
          <a href="/admin" className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors text-sm font-semibold">
            <Settings className="w-4 h-4" /> Set up your event
          </a>
        </div>
      </div>
    );
  }

  const formattedDate = new Date(config.eventDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: bg, color: "#f5f5f5" }}>
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(180deg, #111 0%, ${bg} 100%)` }}>
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: `radial-gradient(circle, ${primary} 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent, ${bg})` }} />
        <div className="relative max-w-4xl mx-auto px-4 pt-12 pb-16">
          <div className="flex flex-col items-center text-center mb-10">
            {config.logoDataUrl
              ? <img src={config.logoDataUrl} alt={config.eventName} className="max-h-28 max-w-xs w-auto mb-6 object-contain" style={{ mixBlendMode: "screen" }} />
              : <div className="w-16 h-16 rounded-2xl border border-zinc-700 bg-zinc-900 flex items-center justify-center mb-6"><Ticket className="w-8 h-8" style={{ color: primary }} /></div>
            }
            <div className="w-16 h-px mb-6" style={{ backgroundColor: primary + "80" }} />
            {config.eventTheme && <p className="text-xs font-bold uppercase tracking-[0.3em] mb-1" style={{ color: primary }}>Theme</p>}
            <h1 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tight leading-none mb-2">
              {config.eventTheme || config.eventName}
            </h1>
            {config.eventTheme && <p className="text-xs font-bold uppercase tracking-[0.3em] mt-1 mb-1 text-zinc-400">{config.eventName}</p>}
            {config.eventDescription && <p className="text-zinc-400 text-base mt-3 max-w-md">{config.eventDescription}</p>}
          </div>

          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {[{ icon: Calendar, text: formattedDate }, { icon: Clock, text: config.eventTime }, { icon: MapPin, text: config.eventVenue }].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 text-sm text-zinc-300">
                <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: primary }} />
                <span>{text}</span>
              </div>
            ))}
          </div>

          <div className="text-center mb-6">
            <p className="text-zinc-600 text-xs uppercase tracking-[0.3em] mb-5 font-semibold">Event Starts In</p>
            <div className="flex items-start justify-center gap-3 sm:gap-6">
              <CountdownUnit value={countdown.days} label="Days" primary={primary} />
              <span className="text-3xl font-thin mt-4" style={{ color: primary + "66" }}>|</span>
              <CountdownUnit value={countdown.hours} label="Hours" primary={primary} />
              <span className="text-3xl font-thin mt-4" style={{ color: primary + "66" }}>|</span>
              <CountdownUnit value={countdown.mins} label="Mins" primary={primary} />
              <span className="text-3xl font-thin mt-4" style={{ color: primary + "66" }}>|</span>
              <CountdownUnit value={countdown.secs} label="Secs" primary={primary} />
            </div>
          </div>
        </div>
      </div>

      <div className="border-y border-zinc-800 bg-zinc-950">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-zinc-400 text-xs font-semibold">{remaining} of {totalTickets} tickets remaining</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-40 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pctSold}%`, backgroundColor: primary }} />
            </div>
            <span className="text-zinc-600 text-xs">{pctSold}% sold</span>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-12 space-y-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-black uppercase text-white tracking-wide">Get Your Tickets</h2>
          <p className="text-zinc-500 mt-2">Fill in your details and pay securely</p>
        </div>

        {config.ticketTiers.length > 0
          ? <div className={`grid grid-cols-1 ${config.ticketTiers.length > 1 ? "sm:grid-cols-2" : "max-w-md mx-auto"} gap-6`}>
              {config.ticketTiers.map((tier) => <TicketCard key={tier.id} ticket={tier} config={config} remaining={remaining} />)}
            </div>
          : <div className="text-center py-12 text-zinc-600"><Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No ticket tiers configured yet.</p></div>
        }

        <p className="text-center text-zinc-700 text-xs pt-4">Tickets are non-refundable · Please arrive 30 minutes early · {config.eventName}</p>
      </div>

      <footer className="border-t border-zinc-800 bg-zinc-950">
        <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col items-center gap-4">
          {config.logoDataUrl
            ? <img src={config.logoDataUrl} alt={config.eventName} className="max-h-12 w-auto opacity-60 object-contain" style={{ mixBlendMode: "screen" }} />
            : <p className="font-black text-white text-lg">{config.eventName}</p>
          }
          <p className="text-zinc-600 text-xs text-center">
            {config.eventName}{config.eventTheme ? ` · ${config.eventTheme}` : ""}<br />{formattedDate} · {config.eventVenue}
          </p>
          {(config.contactEmail || config.contactPhone) && (
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-5 text-zinc-500 text-xs">
              {config.contactEmail && <a href={`mailto:${config.contactEmail}`} className="hover:text-white transition-colors">{config.contactEmail}</a>}
              {config.contactEmail && config.contactPhone && <span className="hidden sm:inline text-zinc-700">·</span>}
              {config.contactPhone && <a href={`tel:${config.contactPhone}`} className="hover:text-white transition-colors">{config.contactPhone}</a>}
            </div>
          )}
          <a href="/admin" className="text-zinc-800 text-xs hover:text-zinc-600 transition-colors flex items-center gap-1 mt-1">
            <Settings className="w-3 h-3" /> Event Admin
          </a>
        </div>
      </footer>
    </div>
  );
}
