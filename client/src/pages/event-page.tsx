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
  ShieldCheck, ArrowLeft, Building2, CreditCard, Crown, AlertCircle, Copy, Check,
  Tag, Users, X, CheckCircle2, LockKeyhole
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
  groupSize: number;
  groupLabel: string | null;
  remaining: number;
  remainingSeats: number;
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
  coverImagePositionY: number | null;
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
      textSecondary?: string;
      textMuted?: string;
      onPrimary?: string;
      border?: string;
      themeMode?: "custom" | "auto";
      countdownStyle?: "box" | "minimal" | "rings";
      buttonStyle?: "solid" | "outline";
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

function Countdown({
  date, startTime, accent,
  countdownStyle = "box",
  textMuted = "#71717a",
}: {
  date: string;
  startTime: string | null;
  accent: string;
  countdownStyle?: "box" | "minimal" | "rings";
  textMuted?: string;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const target = getEventDateTime(date, startTime);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
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

  // ── Minimal style ──────────────────────────────────────────────────────────
  if (countdownStyle === "minimal") {
    const parts = dd > 0
      ? `${dd}d ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
      : `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
    return (
      <div className="flex justify-center mt-4 mb-1">
        <span className="text-xl sm:text-2xl font-black tabular-nums tracking-tight"
          style={{ color: urgent ? accent : textMuted }}>
          {parts}
        </span>
      </div>
    );
  }

  // ── Rings style ────────────────────────────────────────────────────────────
  if (countdownStyle === "rings") {
    const RADIUS = 24;
    const CIRC = 2 * Math.PI * RADIUS;
    const ringDefs = [
      { label: "Days",  value: dd, max: 365 },
      { label: "Hours", value: hh, max: 24  },
      { label: "Mins",  value: mm, max: 60  },
      { label: "Secs",  value: ss, max: 60  },
    ];
    return (
      <div className="flex justify-center gap-3 sm:gap-6 mt-4 mb-1">
        {ringDefs.map(({ label, value, max }) => {
          const frac = Math.max(0, Math.min(1, value / max));
          const offset = CIRC * (1 - frac);
          return (
            <div key={label} className="flex flex-col items-center gap-1">
              <svg width="60" height="60" viewBox="0 0 60 60">
                <circle cx="30" cy="30" r={RADIUS} fill="none" strokeWidth="3.5"
                  stroke={`${accent}25`} />
                <circle cx="30" cy="30" r={RADIUS} fill="none" strokeWidth="3.5"
                  stroke={urgent ? accent : accent}
                  strokeDasharray={CIRC}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  transform="rotate(-90 30 30)"
                  style={{ transition: "stroke-dashoffset 0.5s ease" }} />
                <text x="30" y="35" textAnchor="middle" fontSize="13" fontWeight="900"
                  fill={urgent ? accent : "#ffffff"} fontFamily="inherit">
                  {String(value).padStart(2, "0")}
                </text>
              </svg>
              <span className="text-[10px] uppercase tracking-widest"
                style={{ color: urgent ? accent : textMuted }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Box style (default) ────────────────────────────────────────────────────
  const blocks = [
    { label: "Days",    value: dd },
    { label: "Hours",   value: hh },
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
            style={{ color: urgent ? accent : textMuted }}>
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
  gender: z.string().optional(),
  ageRange: z.string().optional(),
  heardFrom: z.string().optional(),
});
type RegistrationForm = z.infer<typeof registrationSchema>;

interface DiscountResult {
  valid: boolean;
  codeId: string;
  code: string;
  discountAmount: number;
  newTotal: number;
  description: string;
}

// ─── Input component ──────────────────────────────────────────────────────────

function DarkInput({ icon: Icon, field, placeholder, type = "text", borderColor }: any) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 z-10" />
      <Input {...field} type={type} placeholder={placeholder}
        className="pl-10 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 h-11"
        style={borderColor ? { borderColor } : undefined} />
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

  // Discount code state
  const [discountInput, setDiscountInput] = useState("");
  const [discountResult, setDiscountResult] = useState<DiscountResult | null>(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);

  // Attendee names (for group tickets)
  const [attendeeNames, setAttendeeNames] = useState<string[]>([]);

  // Send ticket to different email
  const [sendToOther, setSendToOther] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientEmailError, setRecipientEmailError] = useState("");

  const paymentMethod = event.paymentMethod;
  const primary = event.branding?.brandTheme?.primary ?? "#F59E0B";
  const btForm = event.branding?.brandTheme;
  const onPrimaryForm = btForm?.onPrimary ?? "#000000";
  const buttonStyleForm = btForm?.buttonStyle ?? "outline";
  const formBorderColor = btForm?.border ?? null;
  const groupSize = ticket.groupSize ?? 1;
  const isGroupTicket = groupSize > 1;

  const form = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { customerName: "", customerEmail: "", customerPhone: "", instagramHandle: "", quantity: 1, gender: "", ageRange: "", heardFrom: "" },
  });
  const quantity = form.watch("quantity");
  const baseTotal = ticket.price * quantity;
  const total = discountResult ? discountResult.newTotal : baseTotal;

  // Sync attendeeNames length to quantity * groupSize
  useEffect(() => {
    if (!isGroupTicket) return;
    const totalAttendees = quantity * groupSize;
    setAttendeeNames((prev) => {
      const arr = [...prev];
      while (arr.length < totalAttendees) arr.push("");
      return arr.slice(0, totalAttendees);
    });
  }, [quantity, groupSize, isGroupTicket]);

  // Reset discount when quantity changes
  useEffect(() => {
    setDiscountResult(null);
  }, [quantity]);

  async function applyDiscount() {
    const code = discountInput.trim();
    if (!code) return;
    setApplyingDiscount(true);
    try {
      const res = await apiRequest("POST", "/api/discount/validate", {
        code,
        eventId: event.id,
        ticketTypeId: ticket.id,
        baseTotal,
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Invalid code", description: data.message, variant: "destructive" });
        setDiscountResult(null);
        return;
      }
      setDiscountResult(data);
      toast({ title: "Discount applied!", description: data.description });
    } catch {
      toast({ title: "Could not apply discount", variant: "destructive" });
    } finally {
      setApplyingDiscount(false);
    }
  }

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
          discountCode: discountResult?.code || undefined,
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
          gender: formData!.gender || null,
          ageRange: formData!.ageRange || null,
          heardFrom: formData!.heardFrom || null,
          discountCode: discountResult?.code || undefined,
          recipientEmail: sendToOther && recipientEmail.trim() ? recipientEmail.trim() : undefined,
          attendeeDetails: isGroupTicket ? attendeeNames.map((n, i) => ({ name: n || formData!.customerName, email: i === 0 ? formData!.customerEmail : "" })) : undefined,
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
        gender: formData.gender || null,
        ageRange: formData.ageRange || null,
        heardFrom: formData.heardFrom || null,
        discountCode: discountResult?.code || undefined,
        recipientEmail: sendToOther && recipientEmail.trim() ? recipientEmail.trim() : undefined,
        attendeeDetails: isGroupTicket ? attendeeNames.map((n, i) => ({ name: n || formData.customerName, email: i === 0 ? formData.customerEmail : "" })) : undefined,
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

    // Validate recipient email if provided
    if (sendToOther) {
      const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!recipientEmail.trim()) {
        setRecipientEmailError("Please enter a recipient email address");
        return;
      }
      if (!emailRx.test(recipientEmail.trim())) {
        setRecipientEmailError("Please enter a valid email address");
        return;
      }
    }
    setRecipientEmailError("");

    const resolvedRecipient = sendToOther && recipientEmail.trim() ? recipientEmail.trim() : undefined;

    // Free ticket — bypass all payment providers
    if (total === 0) {
      setProcessing(true);
      try {
        const res = await apiRequest("POST", `/api/public/events/${event.id}/purchase/free`, {
          ticketTypeId: ticket.id,
          quantity: data.quantity,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          instagramHandle: data.instagramHandle || null,
          gender: data.gender || null,
          ageRange: data.ageRange || null,
          heardFrom: data.heardFrom || null,
          recipientEmail: resolvedRecipient,
          attendeeDetails: isGroupTicket ? attendeeNames.map((n, i) => ({ name: n || data.customerName, email: i === 0 ? data.customerEmail : "" })) : undefined,
        });
        const order = await res.json();
        if (!res.ok) {
          toast({ title: "Registration failed", description: order.message, variant: "destructive" });
          return;
        }
        qc.invalidateQueries({ queryKey: [`/api/public/events/${event.id}`] });
        onSuccess(order.id, data.customerName, 0, data.quantity);
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally {
        setProcessing(false);
      }
      return;
    }

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
              gender: data.gender || null,
              ageRange: data.ageRange || null,
              heardFrom: data.heardFrom || null,
              discountCode: discountResult?.code || undefined,
              recipientEmail: resolvedRecipient,
              attendeeDetails: isGroupTicket ? attendeeNames.map((n, i) => ({ name: n || data.customerName, email: i === 0 ? data.customerEmail : "" })) : undefined,
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
              gender: data.gender || null,
              ageRange: data.ageRange || null,
              heardFrom: data.heardFrom || null,
              discountCode: discountResult?.code || undefined,
              recipientEmail: resolvedRecipient,
              attendeeDetails: isGroupTicket ? attendeeNames.map((n, i) => ({ name: n || data.customerName, email: i === 0 ? data.customerEmail : "" })) : undefined,
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
    <div className="flex items-center justify-between bg-zinc-950 rounded-lg px-4 py-3 mb-5"
      style={{ border: formBorderColor ? `1px solid ${formBorderColor}` : "1px solid #27272a" }}>
      <div>
        <p className="text-zinc-500 text-xs">{formData?.customerName} · {ticket.name}</p>
        <p className="text-white font-bold text-sm">{formData?.quantity} × {formatPrice(ticket.price)}</p>
      </div>
      <span className="font-black text-xl" style={{ color: primary }}>{formatPrice(total)}</span>
    </div>
  );

  return (
    <div className="pt-5 mt-5" style={{ borderTop: `1px solid ${primary}35`, backgroundColor: `${primary}0d` }}>
      {phase === "form" && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField control={form.control} name="customerName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Full Name *</FormLabel>
                  <FormControl><DarkInput icon={User} field={field} placeholder="Your full name" borderColor={formBorderColor} /></FormControl>
                  <FormMessage className="text-red-400 text-xs" />
                </FormItem>
              )} />
              <FormField control={form.control} name="customerPhone" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Phone *</FormLabel>
                  <FormControl><DarkInput icon={Phone} field={field} placeholder="+234 xxx xxx xxxx" borderColor={formBorderColor} /></FormControl>
                  <FormMessage className="text-red-400 text-xs" />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="customerEmail" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Email *</FormLabel>
                <FormControl><DarkInput icon={Mail} field={field} placeholder="your@email.com" type="email" borderColor={formBorderColor} /></FormControl>
                <FormMessage className="text-red-400 text-xs" />
              </FormItem>
            )} />
            <FormField control={form.control} name="instagramHandle" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">
                  Instagram <span className="normal-case text-zinc-600">(optional)</span>
                </FormLabel>
                <FormControl><DarkInput icon={Instagram} field={field} placeholder="@yourhandle" borderColor={formBorderColor} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="gender" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">
                  Gender <span className="normal-case text-zinc-600">(Optional)</span>
                </FormLabel>
                <FormControl>
                  <select {...field} className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-md px-3 h-11 text-sm outline-none focus:border-amber-400 transition-colors cursor-pointer"
                    style={formBorderColor ? { borderColor: formBorderColor } : undefined}>
                    <option value="">Select...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="ageRange" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">
                  Age Range <span className="normal-case text-zinc-600">(Optional)</span>
                </FormLabel>
                <FormControl>
                  <select {...field} className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-md px-3 h-11 text-sm outline-none focus:border-amber-400 transition-colors cursor-pointer"
                    style={formBorderColor ? { borderColor: formBorderColor } : undefined}>
                    <option value="">Select...</option>
                    <option value="Under 18">Under 18</option>
                    <option value="18–24">18–24</option>
                    <option value="25–34">25–34</option>
                    <option value="35–44">35–44</option>
                    <option value="45+">45+</option>
                  </select>
                </FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="heardFrom" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">
                  How did you hear about this event? <span className="normal-case text-zinc-600">(Optional)</span>
                </FormLabel>
                <FormControl>
                  <select {...field} className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-md px-3 h-11 text-sm outline-none focus:border-amber-400 transition-colors cursor-pointer"
                    style={formBorderColor ? { borderColor: formBorderColor } : undefined}>
                    <option value="">Select...</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Friend/Family">Friend/Family</option>
                    <option value="Flyer/Poster">Flyer/Poster</option>
                    <option value="Online Search">Online Search</option>
                    <option value="Word of Mouth">Word of Mouth</option>
                    <option value="Other">Other</option>
                  </select>
                </FormControl>
              </FormItem>
            )} />

            {/* Send ticket to a different email */}
            <div className="space-y-3 pt-1">
              <p className="text-zinc-400 text-xs uppercase tracking-widest">Send ticket to a different email address?</p>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sendToOther"
                    checked={!sendToOther}
                    onChange={() => { setSendToOther(false); setRecipientEmail(""); setRecipientEmailError(""); }}
                    className="accent-amber-400 w-4 h-4"
                  />
                  <span className="text-zinc-300 text-sm">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sendToOther"
                    checked={sendToOther}
                    onChange={() => setSendToOther(true)}
                    className="accent-amber-400 w-4 h-4"
                  />
                  <span className="text-zinc-300 text-sm">Yes</span>
                </label>
              </div>
              {sendToOther && (
                <div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => { setRecipientEmail(e.target.value); setRecipientEmailError(""); }}
                      placeholder="Recipient email address"
                      className="w-full pl-10 bg-zinc-900 border border-zinc-700 text-white placeholder:text-zinc-600 h-11 rounded-md text-sm outline-none focus:border-amber-400 transition-colors"
                      style={formBorderColor ? { borderColor: formBorderColor } : undefined}
                    />
                  </div>
                  {recipientEmailError && (
                    <p className="text-red-400 text-xs mt-1">{recipientEmailError}</p>
                  )}
                </div>
              )}
            </div>

            <FormField control={form.control} name="quantity" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">
                  {isGroupTicket
                    ? `Number of ${ticket.groupLabel || "Group"}s`
                    : "Number of Tickets"}
                </FormLabel>
                <FormControl>
                  <div className="flex items-center gap-4">
                    <button type="button"
                      onClick={() => field.onChange(Math.max(1, field.value - 1))}
                      className="w-9 h-9 rounded-full border border-zinc-600 text-zinc-300 hover:border-amber-400 hover:text-amber-400 transition-colors flex items-center justify-center text-xl font-bold">−</button>
                    <span className="text-white font-bold text-xl w-8 text-center">{field.value}</span>
                    <button type="button"
                      onClick={() => field.onChange(Math.min(Math.min(20, ticket.remaining), field.value + 1))}
                      className="w-9 h-9 rounded-full border border-zinc-600 text-zinc-300 hover:border-amber-400 hover:text-amber-400 transition-colors flex items-center justify-center text-xl font-bold">+</button>
                    {isGroupTicket && (
                      <span className="text-zinc-500 text-sm">= {field.value * groupSize} people</span>
                    )}
                  </div>
                </FormControl>
              </FormItem>
            )} />

            {/* Attendee names for group tickets */}
            {isGroupTicket && quantity > 0 && (
              <div className="space-y-2">
                <p className="text-zinc-400 text-xs uppercase tracking-widest flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Attendee Names
                  <span className="normal-case text-zinc-600">(optional but recommended)</span>
                </p>
                {Array.from({ length: quantity * groupSize }).map((_, i) => (
                  <div key={i} className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      value={attendeeNames[i] ?? ""}
                      onChange={(e) => {
                        const arr = [...attendeeNames];
                        arr[i] = e.target.value;
                        setAttendeeNames(arr);
                      }}
                      placeholder={`Attendee ${i + 1} name`}
                      className="w-full pl-10 bg-zinc-900 border border-zinc-700 text-white placeholder:text-zinc-600 h-11 rounded-md text-sm outline-none focus:border-amber-400 transition-colors"
                      style={formBorderColor ? { borderColor: formBorderColor } : undefined}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Discount code input */}
            <div className="pb-2">
              <p className="text-zinc-400 text-xs uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Discount Code
                <span className="normal-case text-zinc-600">(optional)</span>
              </p>
              {discountResult ? (
                <div className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 text-sm font-semibold">{discountResult.code}</span>
                    <span className="text-green-400/70 text-xs">— {discountResult.description}</span>
                  </div>
                  <button type="button" onClick={() => { setDiscountResult(null); setDiscountInput(""); }}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyDiscount())}
                    placeholder="Enter code"
                    className="flex-1 bg-zinc-900 border border-zinc-700 text-white placeholder:text-zinc-600 h-10 rounded-md px-3 text-sm uppercase outline-none focus:border-amber-400 transition-colors"
                    style={formBorderColor ? { borderColor: formBorderColor } : undefined}
                  />
                  <button type="button" onClick={applyDiscount} disabled={!discountInput.trim() || applyingDiscount}
                    className="px-4 h-10 rounded-md border border-zinc-600 text-zinc-300 hover:border-amber-400 hover:text-amber-400 text-sm font-semibold transition-colors disabled:opacity-50"
                    style={formBorderColor ? { borderColor: formBorderColor } : undefined}>
                    {applyingDiscount ? <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin inline-block" /> : "Apply"}
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-lg px-4 py-3 space-y-1.5 mb-6" style={{ backgroundColor: `${primary}15`, border: `1px solid ${primary}35` }}>
              {discountResult && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Subtotal</span>
                    <span className="text-zinc-300">{formatPrice(baseTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-400">Discount ({discountResult.code})</span>
                    <span className="text-green-400">−{formatPrice(discountResult.discountAmount)}</span>
                  </div>
                  <div className="pt-1.5" style={{ borderTop: formBorderColor ? `1px solid ${formBorderColor}` : "1px solid #27272a" }} />
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-sm">Total</span>
                <span className="font-black text-xl" style={{ color: primary }}>{formatPrice(total)}</span>
              </div>
            </div>

            <button type="submit" disabled={processing}
              className="w-full py-4 rounded-lg font-black uppercase tracking-widest text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={total === 0 || paymentMethod === "paystack" || paymentMethod === "stripe" || paymentMethod === "flutterwave"
                ? { backgroundColor: primary, color: onPrimaryForm }
                : buttonStyleForm === "solid"
                  ? { backgroundColor: primary, color: onPrimaryForm, border: `2px solid ${primary}` }
                  : { border: `2px solid ${primary}`, color: primary }}>
              {processing
                ? <><span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Processing...</>
                : total === 0
                  ? <><Ticket className="w-4 h-4" /> Register Free</>
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
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3.5"
              style={formBorderColor ? { borderColor: formBorderColor } : undefined}>
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
          <div className="rounded-xl p-5 mb-5 space-y-3" style={{ backgroundColor: `${primary}15`, border: `1px solid ${primary}35` }}>
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

function TicketCard({ ticket, event, onSuccess, isPast }: {
  ticket: PublicTicketType;
  event: PublicEvent;
  onSuccess: (orderId: string, name: string, total: number, qty: number, status?: string) => void;
  isPast?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const soldOut = ticket.remaining <= 0;
  const bt2 = event.branding?.brandTheme;
  const primary = bt2?.primary ?? "#F59E0B";
  const accent = bt2?.accent ?? primary;
  const surfaceColor = bt2?.surface ?? "#18181b";
  const textColor = bt2?.text ?? "#ffffff";
  const onPrimary = bt2?.onPrimary ?? "#000000";
  const buttonStyle = bt2?.buttonStyle ?? "outline";
  const cardBorderStyle = bt2?.border ? `1px solid ${bt2.border}` : `1px solid ${primary}44`;

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: `${primary}18`, border: cardBorderStyle }}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="p-2.5 rounded-lg" style={{ backgroundColor: `${primary}18` }}>
            <Ticket className="w-5 h-5" style={{ color: primary }} />
          </div>
          {isPast
            ? <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-zinc-800 text-zinc-600 border border-zinc-700 flex items-center gap-1">
                <LockKeyhole className="w-3 h-3" /> Ended
              </span>
            : soldOut
              ? <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">Sold Out</span>
              : <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  {ticket.remaining} left
                </span>
          }
        </div>

        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-xl font-black uppercase tracking-wide text-white">{ticket.name}</h3>
          {(ticket.groupSize ?? 1) > 1 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20 flex items-center gap-1 whitespace-nowrap">
              <Users className="w-3 h-3" /> {ticket.groupLabel || "Group"} of {ticket.groupSize}
            </span>
          )}
        </div>

        <div className="mb-4">
          <span className="text-3xl font-black text-white">{formatPrice(ticket.price)}</span>
          <span className="text-zinc-600 text-sm ml-2">
            · per {(ticket.groupSize ?? 1) > 1 ? (ticket.groupLabel?.toLowerCase() || "group") : "ticket"}
          </span>
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

        {isPast
          ? <div className="w-full py-3 rounded-lg border border-zinc-800 text-center text-zinc-600 text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2">
              <LockKeyhole className="w-4 h-4" /> Sales Closed
            </div>
          : soldOut
            ? <div className="w-full py-3 rounded-lg border border-zinc-700 text-center text-zinc-600 text-sm font-bold uppercase tracking-widest">
                Sold Out
              </div>
            : <button onClick={() => setOpen((v) => !v)}
                className="w-full py-3.5 rounded-lg font-bold uppercase tracking-widest text-sm transition-all duration-200 flex items-center justify-center gap-2"
                style={open
                  ? { backgroundColor: `${primary}20`, color: primary, border: `1px solid ${primary}50` }
                  : buttonStyle === "solid"
                    ? { backgroundColor: primary, color: onPrimary, border: `2px solid ${primary}` }
                    : { border: `2px solid ${primary}`, color: primary }
                }>
                {open
                  ? <><ArrowLeft className="w-4 h-4" /> Close</>
                  : <><Ticket className="w-4 h-4" /> Get Ticket</>
                }
              </button>
        }

        {!isPast && open && <PurchaseForm ticket={ticket} event={event} onSuccess={onSuccess} />}
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

  useEffect(() => {
    const bt = event?.branding?.brandTheme;
    if (!bt || (bt.themeMode ?? "auto") !== "custom") return;
    const bg = bt.background ?? "#09090b";
    const r = parseInt(bg.slice(1, 3), 16);
    const g = parseInt(bg.slice(3, 5), 16);
    const b = parseInt(bg.slice(5, 7), 16);
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const scheme = lum < 0.4 ? "only dark" : "only light";
    const existing = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;
    const created = !existing;
    const meta: HTMLMetaElement = existing ?? document.createElement("meta");
    if (created) { meta.name = "color-scheme"; document.head.appendChild(meta); }
    const prev = meta.content;
    meta.content = scheme;
    return () => {
      if (created) { meta.remove(); } else { meta.content = prev; }
    };
  }, [event?.branding?.brandTheme?.themeMode, event?.branding?.brandTheme?.background]);

  useEffect(() => {
    if (!event) return;

    document.title = `${event.title} — Tickets`;

    function setMeta(property: string, content: string) {
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    }

    const desc = event.description || `Get your tickets for ${event.title}`;
    setMeta("og:title", event.title);
    setMeta("og:description", desc);
    setMeta("og:url", window.location.href);
    if (event.coverImageUrl) setMeta("og:image", event.coverImageUrl);
    setMeta("og:type", "website");

    return () => {
      document.title = "Showgate";
    };
  }, [event]);

  function handleSuccess(orderId: string, name: string, total: number, qty: number, status = "confirmed") {
    const eventTitle = event?.title || "";
    const venue = event?.location || "";
    const date = event?.date || "";
    const time = event?.startTime || "";
    navigate(`/success?orderId=${orderId}&name=${encodeURIComponent(name)}&total=${total}&tickets=${qty}&status=${status}&eventTitle=${encodeURIComponent(eventTitle)}&venue=${encodeURIComponent(venue)}&date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`);
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
  const accent = bt?.accent ?? primary;
  const bgColor = bt?.background ?? "#09090b";
  const surfaceColor = bt?.surface ?? "#18181b";
  const textColor = bt?.text ?? "#ffffff";
  const textSecondaryColor = bt?.textSecondary ?? textColor;
  const textMutedColor = bt?.textMuted ?? "#71717a";
  const borderStyle = bt?.border ? `1px solid ${bt.border}` : `1px solid ${primary}28`;
  const countdownStyleVal = bt?.countdownStyle ?? "box";
  const brandName = event.branding?.name ?? "Showgate";
  const brandLogoUrl = (event.branding?.isPro && event.branding?.logoUrl && !bt?.hideLogo) ? event.branding.logoUrl : null;

  const isTestMode = event.paystackEnv === "test";

  const eventDateTime = getEventDateTime(event.date, event.startTime);
  const isPast = Date.now() - eventDateTime.getTime() > 4 * 60 * 60 * 1000;

  return (
    <div className="min-h-screen flex flex-col text-zinc-100" style={{ backgroundColor: bgColor, color: textColor, '--brand-primary': primary, '--brand-accent': accent, '--brand-surface': surfaceColor, '--brand-text': textColor } as any}>
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
              style={{ objectPosition: `center ${event.coverImagePositionY ?? 50}%` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-zinc-950" />
          </div>
        )}

        <div className={`relative max-w-3xl mx-auto px-4 pb-14 ${event.coverImageUrl ? "pt-8" : "pt-12"}`}>
          <div className="flex flex-col items-center text-center mb-8">
            {/* Brand logo — always shown for pro orgs */}
            {brandLogoUrl ? (
              <img
                src={brandLogoUrl}
                alt={brandName}
                className={`object-contain mb-4 ${event.coverImageUrl ? "h-10 max-w-[140px]" : "h-14 max-w-[180px]"}`}
              />
            ) : !event.coverImageUrl ? (
              <div className="w-16 h-16 rounded-2xl border flex items-center justify-center mb-6"
                style={{ borderColor: `${primary}33`, backgroundColor: `${primary}15` }}>
                <Ticket className="w-8 h-8" style={{ color: primary }} />
              </div>
            ) : null}
            {/* Brand name label */}
            {brandName !== "Showgate" && (
              <p className="text-xs uppercase tracking-widest font-semibold mb-3 opacity-75" style={{ color: accent }}>
                {brandName}
              </p>
            )}
            <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight leading-none mb-4" style={{ color: textColor }}>
              {event.title}
            </h1>
            <div className="flex flex-wrap justify-center gap-3 mb-4">
              <div className="flex items-center gap-2 rounded-full px-4 py-2 text-sm"
                style={{ backgroundColor: surfaceColor, border: borderStyle, color: textSecondaryColor }}>
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accent }} />
                <span>{formattedDate}</span>
              </div>
              <div className="flex items-center gap-2 rounded-full px-4 py-2 text-sm"
                style={{ backgroundColor: surfaceColor, border: borderStyle, color: textSecondaryColor }}>
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accent }} />
                <span>{event.location}</span>
              </div>
              {event.startTime && (
                <div className="flex items-center gap-2 rounded-full px-4 py-2 text-sm"
                  style={{ backgroundColor: surfaceColor, border: borderStyle, color: textSecondaryColor }}>
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accent }} />
                  <span>{fmtTime12h(event.startTime)}</span>
                </div>
              )}
            </div>

            <Countdown date={event.date} startTime={event.startTime} accent={accent}
              countdownStyle={countdownStyleVal} textMuted={textMutedColor} />

            {event.description && (
              <p className="text-sm sm:text-base leading-relaxed max-w-xl" style={{ color: textMutedColor }}>
                {event.description}
              </p>
            )}

            {event.location && (
              <div className="w-full max-w-2xl mx-auto mt-4">
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest mb-2"
                  style={{ color: textMutedColor }}>
                  <MapPin className="w-3 h-3" /> Location Map
                </div>
                <div className="rounded-xl overflow-hidden" style={{ height: 220, border: borderStyle }}>
                  <iframe
                    title="Event location map"
                    width="100%"
                    height="100%"
                    style={{ border: 0, display: "block" }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(event.location)}&output=embed`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Availability bar */}
      <div style={{ borderTop: `1px solid ${primary}25`, borderBottom: `1px solid ${primary}25`, backgroundColor: surfaceColor }}>
        <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${isPast ? "bg-zinc-600" : totalRemaining > 0 ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            <span className="text-zinc-400 text-xs font-semibold">
              {isPast ? "Event has ended" : totalRemaining > 0 ? `${totalRemaining} tickets remaining` : "Sold out"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-40 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pctSold}%`, backgroundColor: isPast ? "#52525b" : primary }} />
            </div>
            <span className="text-zinc-600 text-xs">{pctSold}% sold</span>
          </div>
        </div>
      </div>

      {/* Ticket types */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-12" style={{ backgroundColor: `${primary}0a` }}>
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wide" style={{ color: textColor }}>
            {isPast ? "This event has ended" : "Get Your Tickets"}
          </h2>
          <p className="mt-2 text-sm opacity-50" style={{ color: textColor }}>
            {isPast ? "Ticket sales for this event are now closed." : "Select a ticket type to get started"}
          </p>
        </div>

        {event.ticketTypes.length === 0 ? (
          <div className="text-center py-16 text-zinc-600">
            <Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No tickets available for this event yet.</p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${event.ticketTypes.length > 1 ? "sm:grid-cols-2" : "max-w-md mx-auto"} gap-6`}>
            {event.ticketTypes.map((tt) => (
              <TicketCard key={tt.id} ticket={tt} event={event} onSuccess={handleSuccess} isPast={isPast} />
            ))}
          </div>
        )}

        <p className="text-center text-zinc-700 text-xs pt-8">
          Tickets are non-refundable · {event.title}
        </p>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${primary}25`, backgroundColor: surfaceColor }}>
        <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col items-center gap-3">
          <button onClick={copyLink}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-xs font-semibold"
            style={{ border: `1px solid ${primary}40`, color: textColor + "80" }}>
            {copied ? <><Check className="w-3.5 h-3.5 text-green-400" /> Link copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy event link</>}
          </button>
          {event.branding?.isPro ? (
            brandName !== "Showgate" ? (
              <p className="text-xs opacity-30" style={{ color: textColor }}>Powered by {brandName}</p>
            ) : null
          ) : (
            <p className="text-zinc-700 text-xs">Powered by Showgate</p>
          )}
        </div>
      </footer>
    </div>
  );
}
