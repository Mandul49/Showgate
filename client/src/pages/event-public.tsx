import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Calendar, Clock, MapPin, Ticket, Loader2, X, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PublicTicketType {
  id: string;
  name: string;
  price: number;
  available: number;
  soldOut: boolean;
}

interface PublicEvent {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  location: string;
  organizerName: string;
  ticketTypes: PublicTicketType[];
}

function fmtTime(t: string | null | undefined) {
  if (!t) return null;
  try {
    const [h, m] = t.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return t;
  }
}

const buyerSchema = z.object({
  buyerName: z.string().min(2, "Full name required"),
  buyerEmail: z.string().email("Valid email required"),
  buyerPhone: z.string().min(7, "Phone number required"),
  quantity: z.coerce.number().int().min(1).max(10),
});
type BuyerForm = z.infer<typeof buyerSchema>;

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch { return d; }
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(n);
}

function inputClass(hasError?: boolean) {
  return `w-full bg-zinc-900 border ${hasError ? "border-red-500" : "border-zinc-700"} text-white rounded-xl px-4 h-12 text-sm outline-none focus:border-amber-400 transition-colors placeholder:text-zinc-600`;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-page)" }}>
      <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
    </div>
  );
}

function NotFoundScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" style={{ backgroundColor: "var(--bg-page)" }}>
      <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
        <X className="w-8 h-8 text-zinc-600" />
      </div>
      <h1 className="text-white font-bold text-xl text-center">Event not found</h1>
      <p className="text-zinc-500 text-sm text-center max-w-xs">This event may have ended, been removed, or is no longer active.</p>
    </div>
  );
}

export default function EventPublic() {
  const params = useParams<{ id: string }>();
  const eventId = params.id;
  const { toast } = useToast();
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const { data: event, isLoading, isError } = useQuery<PublicEvent>({
    queryKey: [`/api/events/${eventId}/public`],
  });

  const form = useForm<BuyerForm>({
    resolver: zodResolver(buyerSchema),
    defaultValues: { buyerName: "", buyerEmail: "", buyerPhone: "", quantity: 1 },
  });

  const quantity = Number(form.watch("quantity") || 1);

  const checkoutMutation = useMutation({
    mutationFn: async (values: BuyerForm) => {
      if (!selectedTypeId) throw new Error("No ticket type selected");
      const res = await apiRequest("POST", "/api/checkout", {
        ...values,
        quantity: Number(values.quantity),
        eventId,
        ticketTypeId: selectedTypeId,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Checkout failed");
      return data as { authorization_url: string; reference: string };
    },
    onSuccess: (data) => {
      setRedirecting(true);
      window.location.href = data.authorization_url;
    },
    onError: (err: any) => {
      toast({ title: "Payment error", description: err.message, variant: "destructive" });
    },
  });

  function handleSubmit(values: BuyerForm) {
    if (!selectedTypeId) {
      toast({ title: "Choose a ticket type first", variant: "destructive" });
      return;
    }
    checkoutMutation.mutate(values);
  }

  if (isLoading) return <LoadingScreen />;
  if (isError || !event) return <NotFoundScreen />;

  const selectedType = event.ticketTypes.find((t) => t.id === selectedTypeId);
  const total = selectedType ? selectedType.price * quantity : 0;
  const isPending = checkoutMutation.isPending || redirecting;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-page)", color: "var(--text-main)" }}>
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-zinc-900">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 60% 0%, rgba(245,158,11,0.07) 0%, transparent 65%)" }} />
        <div className="relative max-w-3xl mx-auto px-4 pt-10 pb-9">
          <div className="flex items-center gap-2 mb-8">
            <div className="p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
              <Ticket className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-widest">Showgate</span>
          </div>

          <p className="text-amber-400 text-xs uppercase tracking-[0.2em] font-bold mb-2">{event.organizerName}</p>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-5">{event.title}</h1>

          <div className="flex flex-wrap items-center gap-5 text-zinc-400 text-sm">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400/70 flex-shrink-0" />
              {fmtDate(event.date)}
            </span>
            {fmtTime(event.startTime) && (
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400/70 flex-shrink-0" />
                {fmtTime(event.startTime)}
              </span>
            )}
            <span className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-400/70 flex-shrink-0" />
              {event.location}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-10">
          {/* Left: ticket select + buyer form */}
          <div className="lg:col-span-3 space-y-8">
            {/* Ticket types */}
            <div>
              <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Choose Ticket</h2>
              {event.ticketTypes.length === 0 ? (
                <div className="border border-dashed border-zinc-800 rounded-xl p-8 text-center">
                  <Ticket className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                  <p className="text-zinc-600 text-sm">No tickets available yet</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {event.ticketTypes.map((tt) => {
                    const isSelected = selectedTypeId === tt.id;
                    return (
                      <button
                        key={tt.id}
                        type="button"
                        disabled={tt.soldOut}
                        onClick={() => !tt.soldOut && setSelectedTypeId(tt.id)}
                        className={`w-full text-left px-5 py-4 rounded-xl border transition-all duration-150 ${
                          tt.soldOut
                            ? "border-zinc-800 bg-zinc-900/40 opacity-50 cursor-not-allowed"
                            : isSelected
                              ? "border-amber-400/60 bg-amber-400/5 ring-1 ring-amber-400/20"
                              : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                              isSelected && !tt.soldOut ? "border-amber-400 bg-amber-400" : "border-zinc-600"
                            }`}>
                              {isSelected && !tt.soldOut && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                            </div>
                            <div>
                              <p className="text-white font-semibold text-sm">{tt.name}</p>
                              <p className="text-zinc-500 text-xs mt-0.5">
                                {tt.soldOut ? "Sold out" : `${tt.available} remaining`}
                              </p>
                            </div>
                          </div>
                          <span className={`font-black text-base flex-shrink-0 ${isSelected ? "text-amber-400" : "text-white"}`}>
                            {fmtCurrency(tt.price)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Buyer details form */}
            <div>
              <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Your Details</h2>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
                <div>
                  <input
                    {...form.register("buyerName")}
                    placeholder="Full name"
                    autoComplete="name"
                    className={inputClass(!!form.formState.errors.buyerName)}
                  />
                  {form.formState.errors.buyerName && (
                    <p className="text-red-400 text-xs mt-1 pl-1">{form.formState.errors.buyerName.message}</p>
                  )}
                </div>
                <div>
                  <input
                    {...form.register("buyerEmail")}
                    type="email"
                    placeholder="Email address"
                    autoComplete="email"
                    className={inputClass(!!form.formState.errors.buyerEmail)}
                  />
                  {form.formState.errors.buyerEmail && (
                    <p className="text-red-400 text-xs mt-1 pl-1">{form.formState.errors.buyerEmail.message}</p>
                  )}
                </div>
                <div>
                  <input
                    {...form.register("buyerPhone")}
                    type="tel"
                    placeholder="Phone number"
                    autoComplete="tel"
                    className={inputClass(!!form.formState.errors.buyerPhone)}
                  />
                  {form.formState.errors.buyerPhone && (
                    <p className="text-red-400 text-xs mt-1 pl-1">{form.formState.errors.buyerPhone.message}</p>
                  )}
                </div>
                <div>
                  <select
                    {...form.register("quantity")}
                    className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-4 h-12 text-sm outline-none focus:border-amber-400 transition-colors cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n} value={n}>{n} ticket{n > 1 ? "s" : ""}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isPending || event.ticketTypes.every((t) => t.soldOut)}
                  className="w-full h-14 rounded-xl bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-black font-black uppercase tracking-widest text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-3 mt-1"
                >
                  {isPending ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Redirecting to Paystack...</>
                  ) : selectedType ? (
                    <>Pay {fmtCurrency(total)} <ChevronRight className="w-5 h-5" /></>
                  ) : (
                    "Select a Ticket to Continue"
                  )}
                </button>

                <p className="text-zinc-600 text-xs text-center pt-1">
                  Secured by Paystack · You'll be redirected to complete payment
                </p>
              </form>
            </div>
          </div>

          {/* Right: sticky order summary */}
          <div className="lg:col-span-2">
            <div className="sticky top-6 space-y-4">
              <h2 className="text-white font-bold text-sm uppercase tracking-widest">Summary</h2>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                {selectedType ? (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-white font-semibold text-sm">{selectedType.name}</p>
                        <p className="text-zinc-500 text-xs mt-0.5">× {quantity}</p>
                      </div>
                      <p className="text-white font-bold flex-shrink-0">{fmtCurrency(selectedType.price * quantity)}</p>
                    </div>
                    <div className="h-px bg-zinc-800" />
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400 text-sm">Total</span>
                      <span className="text-amber-400 font-black text-xl">{fmtCurrency(total)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-5 gap-3 text-center">
                    <Ticket className="w-8 h-8 text-zinc-700" />
                    <p className="text-zinc-600 text-sm">No ticket selected</p>
                  </div>
                )}
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-zinc-500 text-[11px] uppercase tracking-widest mb-0.5">Date</p>
                    <p className="text-white text-sm font-semibold leading-snug">{fmtDate(event.date)}</p>
                  </div>
                </div>
                {fmtTime(event.startTime) && (
                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-zinc-500 text-[11px] uppercase tracking-widest mb-0.5">Time</p>
                      <p className="text-white text-sm font-semibold leading-snug">{fmtTime(event.startTime)}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-zinc-500 text-[11px] uppercase tracking-widest mb-0.5">Venue</p>
                    <p className="text-white text-sm font-semibold leading-snug">{event.location}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-zinc-900 py-6 mt-4">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-center gap-2 text-zinc-700 text-xs">
          <Ticket className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Powered by Showgate · Payments secured by Paystack</span>
        </div>
      </footer>
    </div>
  );
}
