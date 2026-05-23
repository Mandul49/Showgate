import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { isAuthenticated, clearToken, getUser, getToken } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus, Calendar, MapPin, Ticket, LogOut, Settings,
  ChevronDown, ChevronUp, Loader2, Lock, Users,
  ToggleLeft, ToggleRight, Tag, AlertTriangle, X,
  CheckCircle2, CircleDot, ExternalLink
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TicketTypeData {
  id: string;
  name: string;
  price: number;
  quantityAvailable: number;
  quantitySold: number;
}

interface EventData {
  id: string;
  title: string;
  date: string;
  location: string;
  status: "active" | "inactive" | "draft";
  maxTickets: number;
  paymentMethod: string;
  isActive: boolean;
  ticketTypes: TicketTypeData[];
  createdAt: string;
}

interface EventsResponse {
  events: EventData[];
  tier: "free" | "pro";
  limits: {
    maxActiveEvents: number | null;
    maxTicketsPerEvent: number | null;
    allowedPaymentMethods: string[] | null;
  };
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const newEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  date: z.string().min(1, "Date is required"),
  location: z.string().min(1, "Location is required"),
  maxTickets: z.coerce.number().min(1, "Must be at least 1"),
  paymentMethod: z.enum(["paystack", "stripe", "paypal", "bank_transfer"]),
  isActive: z.boolean(),
});
type NewEventForm = z.infer<typeof newEventSchema>;

const newTicketTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  quantityAvailable: z.coerce.number().min(1, "Must be at least 1"),
});
type NewTicketTypeForm = z.infer<typeof newTicketTypeSchema>;

// ─── Utils ────────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return d; }
}

function fmtPrice(n: number) {
  return new Intl.NumberFormat("en-NG", { minimumFractionDigits: 0 }).format(n);
}

const PM_LABELS: Record<string, string> = {
  paystack: "Paystack", stripe: "Stripe", paypal: "PayPal", bank_transfer: "Bank Transfer",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
      tier === "pro"
        ? "bg-violet-400/10 text-violet-400 border-violet-400/20"
        : "bg-amber-400/10 text-amber-400 border-amber-400/20"
    }`}>{tier}</span>
  );
}

function StatusPip({ isActive, status }: { isActive: boolean; status: string }) {
  if (isActive) return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400">
      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Active
    </span>
  );
  if (status === "draft") return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
      <CircleDot className="w-3 h-3" /> Draft
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
      <span className="w-2 h-2 rounded-full bg-zinc-700" /> Inactive
    </span>
  );
}

function CapacityBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : "#22c55e" }} />
    </div>
  );
}

// ─── New Event Form ───────────────────────────────────────────────────────────

function NewEventPanel({
  tier, limits, onClose, onCreated,
}: {
  tier: string;
  limits: EventsResponse["limits"];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const form = useForm<NewEventForm>({
    resolver: zodResolver(newEventSchema),
    defaultValues: {
      title: "", date: "", location: "",
      maxTickets: tier === "free" ? 100 : 500,
      paymentMethod: "paystack",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: NewEventForm) => {
      const res = await apiRequest("POST", "/api/events", values);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create event");
      return data as EventData;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Event created!", description: "Your event is ready. Add ticket types to it." });
      onCreated();
    },
    onError: (err: any) => {
      toast({ title: "Failed to create event", description: err.message, variant: "destructive" });
    },
  });

  const isFree = tier === "free";
  const maxTicketsLimit = limits.maxTicketsPerEvent;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden mb-6">
      <div className="h-0.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-bold">New Event</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-widest block mb-1.5">Event Title *</label>
              <input {...form.register("title")} placeholder="e.g. Lagos Jazz Night"
                className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-10 text-sm outline-none focus:border-amber-400 transition-colors placeholder:text-zinc-600" />
              {form.formState.errors.title && <p className="text-red-400 text-xs mt-1">{form.formState.errors.title.message}</p>}
            </div>
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-widest block mb-1.5">Date *</label>
              <input {...form.register("date")} type="date"
                className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-10 text-sm outline-none focus:border-amber-400 transition-colors" />
              {form.formState.errors.date && <p className="text-red-400 text-xs mt-1">{form.formState.errors.date.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-widest block mb-1.5">Location *</label>
              <input {...form.register("location")} placeholder="e.g. Eko Hotel, Lagos"
                className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-10 text-sm outline-none focus:border-amber-400 transition-colors placeholder:text-zinc-600" />
              {form.formState.errors.location && <p className="text-red-400 text-xs mt-1">{form.formState.errors.location.message}</p>}
            </div>
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-widest block mb-1.5">
                Max Tickets *
                {maxTicketsLimit && <span className="normal-case text-zinc-600 ml-1.5">(Free: max {maxTicketsLimit})</span>}
              </label>
              <input {...form.register("maxTickets")} type="number" min={1} max={maxTicketsLimit ?? undefined}
                className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-10 text-sm outline-none focus:border-amber-400 transition-colors" />
              {form.formState.errors.maxTickets && <p className="text-red-400 text-xs mt-1">{form.formState.errors.maxTickets.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-widest block mb-1.5">
                Payment Method *
                {isFree && <span className="normal-case text-zinc-600 ml-1.5">(Free: Paystack only)</span>}
              </label>
              <select {...form.register("paymentMethod")} disabled={isFree}
                className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-10 text-sm outline-none focus:border-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed appearance-none">
                <option value="paystack">Paystack</option>
                {!isFree && <>
                  <option value="stripe">Stripe</option>
                  <option value="paypal">PayPal</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </>}
              </select>
            </div>
            <div className="flex flex-col justify-end pb-1">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" {...form.register("isActive")}
                  className="w-4 h-4 accent-amber-400 rounded" />
                <span className="text-zinc-300 text-sm">Activate immediately</span>
              </label>
            </div>
          </div>

          {isFree && (
            <div className="flex gap-3 bg-amber-400/5 border border-amber-400/15 rounded-lg p-3.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-zinc-400 text-xs leading-relaxed">
                Free plan: max <strong className="text-zinc-300">{FREE_MAX_ACTIVE_EVENTS} active events</strong> &amp; <strong className="text-zinc-300">{maxTicketsLimit} tickets per event</strong>. Paystack payments only.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors text-sm font-semibold">
              Cancel
            </button>
            <button type="submit" disabled={createMutation.isPending}
              className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {createMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : "Create Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Ticket Type Form ─────────────────────────────────────────────────────

function AddTicketTypePanel({
  event, onClose, onAdded,
}: { event: EventData; onClose: () => void; onAdded: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const usedCapacity = event.ticketTypes.reduce((s, t) => s + t.quantityAvailable, 0);
  const remaining = event.maxTickets - usedCapacity;

  const form = useForm<NewTicketTypeForm>({
    resolver: zodResolver(newTicketTypeSchema),
    defaultValues: { name: "", price: 0, quantityAvailable: Math.min(remaining, 50) },
  });

  const mutation = useMutation({
    mutationFn: async (values: NewTicketTypeForm) => {
      const res = await apiRequest("POST", `/api/events/${event.id}/ticket-types`, values);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add ticket type");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Ticket type added!" });
      onAdded();
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="mt-3 bg-zinc-800/60 border border-zinc-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-zinc-300 text-sm font-semibold">Add Ticket Type</span>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
      </div>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-3 sm:col-span-1">
            <label className="text-zinc-500 text-xs block mb-1">Name *</label>
            <input {...form.register("name")} placeholder="e.g. Regular"
              className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-9 text-sm outline-none focus:border-amber-400 transition-colors placeholder:text-zinc-600" />
            {form.formState.errors.name && <p className="text-red-400 text-xs mt-0.5">{form.formState.errors.name.message}</p>}
          </div>
          <div>
            <label className="text-zinc-500 text-xs block mb-1">Price (₦)</label>
            <input {...form.register("price")} type="number" min={0} placeholder="5000"
              className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-9 text-sm outline-none focus:border-amber-400 transition-colors" />
          </div>
          <div>
            <label className="text-zinc-500 text-xs block mb-1">Qty (max {remaining})</label>
            <input {...form.register("quantityAvailable")} type="number" min={1} max={remaining}
              className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-9 text-sm outline-none focus:border-amber-400 transition-colors" />
            {form.formState.errors.quantityAvailable && <p className="text-red-400 text-xs mt-0.5">{form.formState.errors.quantityAvailable.message}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-zinc-700 text-zinc-500 hover:text-zinc-300 text-xs transition-colors">Cancel</button>
          <button type="submit" disabled={mutation.isPending || remaining <= 0}
            className="px-4 py-1.5 rounded-lg bg-amber-400/90 hover:bg-amber-400 text-black font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5">
            {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Add
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({
  event, tier, onToggle, isToggling,
}: {
  event: EventData;
  tier: string;
  onToggle: (id: string, active: boolean) => void;
  isToggling: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [addingTicketType, setAddingTicketType] = useState(false);
  const qc = useQueryClient();

  const totalAvailable = event.ticketTypes.reduce((s, t) => s + t.quantityAvailable, 0);
  const totalSold = event.ticketTypes.reduce((s, t) => s + t.quantitySold, 0);
  const usedCapacity = totalAvailable;

  return (
    <div className={`bg-zinc-900 border rounded-2xl overflow-hidden transition-all ${
      event.isActive ? "border-zinc-700" : "border-zinc-800 opacity-70"
    }`}>
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-1">
              <h3 className="text-white font-bold text-base truncate">{event.title}</h3>
              <StatusPip isActive={event.isActive} status={event.status} />
            </div>
            <div className="flex items-center gap-4 flex-wrap mt-1.5">
              <span className="flex items-center gap-1.5 text-zinc-500 text-xs">
                <Calendar className="w-3.5 h-3.5" /> {fmtDate(event.date)}
              </span>
              <span className="flex items-center gap-1.5 text-zinc-500 text-xs">
                <MapPin className="w-3.5 h-3.5" /> {event.location}
              </span>
              <span className="flex items-center gap-1.5 text-zinc-500 text-xs">
                <Tag className="w-3.5 h-3.5" /> {PM_LABELS[event.paymentMethod] || event.paymentMethod}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onToggle(event.id, !event.isActive)}
              disabled={isToggling}
              title={event.isActive ? "Deactivate event" : "Activate event"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-semibold transition-colors hover:border-zinc-500 text-zinc-400 hover:text-white disabled:opacity-50">
              {isToggling
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : event.isActive
                  ? <ToggleRight className="w-4 h-4 text-green-400" />
                  : <ToggleLeft className="w-4 h-4" />
              }
              <span className="hidden sm:inline">{event.isActive ? "Active" : "Activate"}</span>
            </button>
            <button onClick={() => setExpanded((v) => !v)}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Capacity bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-zinc-600 text-xs">Capacity used</span>
            <span className="text-zinc-400 text-xs font-mono">{usedCapacity} / {event.maxTickets} allocated · <span className="text-amber-400">{totalSold} sold</span></span>
          </div>
          <CapacityBar used={usedCapacity} total={event.maxTickets} />
        </div>
      </div>

      {/* Ticket types */}
      {expanded && (
        <div className="border-t border-zinc-800 px-5 pb-5 pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-zinc-500 text-xs uppercase tracking-widest font-semibold">Ticket Types</span>
            {!addingTicketType && usedCapacity < event.maxTickets && (
              <button onClick={() => setAddingTicketType(true)}
                className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors font-semibold">
                <Plus className="w-3.5 h-3.5" /> Add type
              </button>
            )}
          </div>

          {event.ticketTypes.length === 0 ? (
            <div className="border border-dashed border-zinc-800 rounded-xl p-4 text-center">
              <Ticket className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-600 text-xs">No ticket types yet</p>
              <button onClick={() => setAddingTicketType(true)}
                className="mt-2 text-xs text-amber-400 hover:text-amber-300 transition-colors font-semibold">
                + Add your first ticket type
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {event.ticketTypes.map((tt) => (
                <div key={tt.id} className="flex items-center justify-between bg-zinc-800/60 rounded-lg px-4 py-2.5 gap-4">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                    <span className="text-zinc-300 text-sm font-semibold">{tt.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span className="font-mono text-zinc-300">₦{fmtPrice(tt.price)}</span>
                    <span>{tt.quantitySold} / {tt.quantityAvailable} sold</span>
                    <div className="w-16 h-1 bg-zinc-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-amber-400 transition-all"
                        style={{ width: `${tt.quantityAvailable > 0 ? (tt.quantitySold / tt.quantityAvailable) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {addingTicketType && (
            <AddTicketTypePanel
              event={event}
              onClose={() => setAddingTicketType(false)}
              onAdded={() => setAddingTicketType(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

const FREE_MAX_ACTIVE_EVENTS = 2;

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showNewEventForm, setShowNewEventForm] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const user = getUser();

  useEffect(() => {
    if (!isAuthenticated()) { navigate("/login"); return; }
    const token = getToken();
    fetch("/api/onboarding/status", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((s) => { if (!s.completed) navigate("/onboarding"); })
      .catch(() => navigate("/onboarding"));
  }, []);

  const { data, isLoading } = useQuery<EventsResponse>({
    queryKey: ["/api/events"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/events/${id}`, { isActive });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to update");
      return json;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/events"] }),
    onError: (err: any) => toast({ title: "Could not toggle event", description: err.message, variant: "destructive" }),
    onSettled: () => setTogglingId(null),
  });

  function handleToggle(id: string, isActive: boolean) {
    setTogglingId(id);
    toggleMutation.mutate({ id, isActive });
  }

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  const events = data?.events ?? [];
  const tier = data?.tier ?? "free";
  const limits = data?.limits ?? { maxActiveEvents: FREE_MAX_ACTIVE_EVENTS, maxTicketsPerEvent: 100, allowedPaymentMethods: ["paystack"] };
  const activeCount = events.filter((e) => e.isActive).length;
  const atEventLimit = tier === "free" && activeCount >= FREE_MAX_ACTIVE_EVENTS;
  const totalSold = events.reduce((s, e) => s + e.ticketTypes.reduce((ss, t) => ss + t.quantitySold, 0), 0);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a0a" }}>
      {/* Navbar */}
      <div className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
              <Ticket className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm">TicketForge</h1>
              <p className="text-zinc-600 text-xs">Event Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <span className="text-zinc-400 text-xs truncate max-w-[140px]">{user.email}</span>
                <TierBadge tier={tier || user.tier} />
              </div>
            )}
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-400/30 transition-colors text-xs font-semibold">
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Events", value: events.length, icon: Calendar, suffix: tier === "free" ? `/ ${FREE_MAX_ACTIVE_EVENTS} active max` : "" },
            { label: "Active Events", value: activeCount, icon: CheckCircle2, color: "text-green-400" },
            { label: "Tickets Sold", value: totalSold, icon: Users, color: "text-amber-400" },
          ].map(({ label, value, icon: Icon, suffix, color }) => (
            <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${color ?? "text-zinc-500"}`} />
                <span className="text-zinc-500 text-xs uppercase tracking-widest">{label}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-white">{value}</span>
                {suffix && <span className="text-zinc-600 text-xs">{suffix}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Tier limit warning */}
        {tier === "free" && atEventLimit && !showNewEventForm && (
          <div className="flex items-center gap-3 bg-amber-400/5 border border-amber-400/15 rounded-xl p-4 mb-6">
            <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-zinc-400 text-sm flex-1">
              You've reached the <strong className="text-zinc-200">Free plan limit</strong> of {FREE_MAX_ACTIVE_EVENTS} active events.
              Deactivate one to create another, or upgrade to Pro for unlimited events.
            </p>
          </div>
        )}

        {/* New event panel */}
        {showNewEventForm && (
          <NewEventPanel
            tier={tier}
            limits={limits}
            onClose={() => setShowNewEventForm(false)}
            onCreated={() => setShowNewEventForm(false)}
          />
        )}

        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold">Your Events</h2>
          <button
            onClick={() => {
              if (atEventLimit) {
                toast({ title: "Event limit reached", description: "Deactivate an event or upgrade to Pro.", variant: "destructive" });
                return;
              }
              setShowNewEventForm(true);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              atEventLimit
                ? "bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700"
                : "bg-amber-400 hover:bg-amber-300 text-black"
            }`}>
            {atEventLimit ? <Lock className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            New Event
          </button>
        </div>

        {/* Events list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-zinc-600">
            <Loader2 className="w-6 h-6 animate-spin mr-3" /> Loading events...
          </div>
        ) : events.length === 0 ? (
          <div className="border border-dashed border-zinc-800 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-zinc-700" />
            </div>
            <h3 className="text-zinc-400 font-bold mb-1">No events yet</h3>
            <p className="text-zinc-600 text-sm mb-5">Create your first event to start selling tickets.</p>
            <button onClick={() => setShowNewEventForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm transition-colors">
              <Plus className="w-4 h-4" /> Create Event
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                tier={tier}
                onToggle={handleToggle}
                isToggling={togglingId === event.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
