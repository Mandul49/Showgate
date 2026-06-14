import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { isAuthenticated, clearToken, getUser, getToken } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Plus, Calendar, MapPin, Ticket, LogOut,
  ChevronDown, ChevronUp, Loader2, Lock, Users,
  ToggleLeft, ToggleRight, Tag, AlertTriangle, X,
  CheckCircle2, CircleDot, ExternalLink, Copy, Check, Link2, Zap,
  Paintbrush, Image, Type, BarChart2, Wallet, Clock, CheckCheck, Pencil, Trash2,
  Crown, Settings, PauseCircle, RefreshCw, Landmark, UserCircle, Download,
} from "lucide-react";
import sgLogo from "../assets/showgate-logo.png";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TicketTypeData {
  id: string;
  name: string;
  price: number;
  quantityAvailable: number;
  quantitySold: number;
  groupSize: number;
  groupLabel: string | null;
}

interface EventData {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  location: string;
  status: "active" | "inactive" | "draft";
  maxTickets: number;
  paymentMethod: string;
  isActive: boolean;
  description: string | null;
  coverImageUrl: string | null;
  ticketTypes: TicketTypeData[];
  createdAt: string;
}

interface EventsResponse {
  events: EventData[];
  tier: "free" | "pro";
  paystackMode: "test" | "live";
  organizer: {
    testSubaccountCode: string | null;
    hasTestSubaccount: boolean;
    hasLiveSubaccount: boolean;
  } | null;
  limits: {
    maxActiveEvents: number | null;
    maxMonthlyTickets: number | null;
    allowedPaymentMethods: string[] | null;
  };
}

interface UpgradeStatus {
  tier: "free" | "pro";
  proExpiresAt: string | null;
  cancelledAt: string | null;
  isPro: boolean;
}

interface HistoryItem {
  plan: string;
  amountKobo: number;
  fulfilledAt: string;
  reference: string;
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const newEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().optional().nullable(),
  location: z.string().min(1, "Location is required"),
  maxTickets: z.coerce.number().min(1, "Must be at least 1"),
  paymentMethod: z.enum(["paystack", "bank_transfer", "flutterwave"]),
  isActive: z.boolean(),
  description: z.string().optional(),
  coverImageUrl: z.string().optional().nullable(),
});
type NewEventForm = z.infer<typeof newEventSchema>;

const newTicketTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  quantityAvailable: z.coerce.number().min(1, "Must be at least 1"),
  groupSize: z.coerce.number().int().min(1).default(1),
  groupLabel: z.string().optional().nullable(),
});
type NewTicketTypeForm = z.infer<typeof newTicketTypeSchema>;

const editTicketTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  quantityAvailable: z.coerce.number().min(1, "Must be at least 1"),
  groupSize: z.coerce.number().int().min(1).default(1),
  groupLabel: z.string().optional().nullable(),
});
type EditTicketTypeForm = z.infer<typeof editTicketTypeSchema>;

// ─── Utils ────────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return d; }
}

function fmtPrice(n: number) {
  return new Intl.NumberFormat("en-NG", { minimumFractionDigits: 0 }).format(n);
}

const PM_LABELS: Record<string, string> = {
  paystack: "Paystack", bank_transfer: "Bank Transfer", flutterwave: "Flutterwave",
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const form = useForm<NewEventForm>({
    resolver: zodResolver(newEventSchema),
    defaultValues: {
      title: "", date: "", startTime: "", location: "",
      maxTickets: tier === "free" ? 100 : 500,
      paymentMethod: "paystack",
      isActive: true,
      description: "",
      coverImageUrl: null,
    },
  });

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select an image under 5 MB.", variant: "destructive" });
      return;
    }

    setUploadingImage(true);
    try {
      const urlRes = await apiRequest("POST", "/api/uploads/request-url", {
        name: file.name,
        size: file.size,
        contentType: file.type,
      });
      const { uploadURL, objectPath } = await urlRes.json();
      if (!urlRes.ok) throw new Error("Failed to get upload URL");

      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      form.setValue("coverImageUrl", objectPath);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  }

  function removeImage() {
    form.setValue("coverImageUrl", null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

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
              <label className="text-zinc-400 text-xs uppercase tracking-widest block mb-1.5">Event Time <span className="normal-case text-zinc-600">(optional)</span></label>
              <input {...form.register("startTime")} type="time"
                className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-10 text-sm outline-none focus:border-amber-400 transition-colors" />
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
              </label>
              <input {...form.register("maxTickets")} type="number" min={1}
                className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-10 text-sm outline-none focus:border-amber-400 transition-colors" />
              {form.formState.errors.maxTickets && <p className="text-red-400 text-xs mt-1">{form.formState.errors.maxTickets.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-widest block mb-1.5">
                Payment Method *
                {isFree && (
                  <span className="block normal-case font-normal tracking-normal text-zinc-500 mt-0.5">
                    Direct deposit via Paystack
                    <span className="block text-zinc-600 text-[11px] mt-0.5">Just connect your bank account once and get paid directly.</span>
                  </span>
                )}
              </label>
              <select {...form.register("paymentMethod")} disabled={isFree}
                className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-10 text-sm outline-none focus:border-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed appearance-none">
                <option value="paystack">Paystack</option>
                {!isFree && <>
                  <option value="flutterwave">Flutterwave</option>
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

          {/* Description */}
          <div>
            <label className="text-zinc-400 text-xs uppercase tracking-widest block mb-1.5">
              Description <span className="normal-case text-zinc-600">(optional)</span>
            </label>
            <textarea {...form.register("description")} rows={3}
              placeholder="Tell attendees what this event is about..."
              className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400 transition-colors placeholder:text-zinc-600 resize-none" />
          </div>

          {/* Cover Image */}
          <div>
            <label className="text-zinc-400 text-xs uppercase tracking-widest block mb-1.5">
              Cover Image <span className="normal-case text-zinc-600">(optional)</span>
            </label>
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-zinc-700">
                <img src={imagePreview} alt="Cover preview" className="w-full h-40 object-cover" />
                <button type="button" onClick={removeImage}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-zinc-900/80 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}
                className="w-full border-2 border-dashed border-zinc-700 hover:border-amber-400/50 rounded-xl p-6 flex flex-col items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {uploadingImage
                  ? <><Loader2 className="w-5 h-5 animate-spin" /><span className="text-xs">Uploading...</span></>
                  : <><Image className="w-5 h-5" /><span className="text-xs">Click to upload a cover image</span><span className="text-xs text-zinc-600">JPG, PNG, WebP — max 5 MB</span></>
                }
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          </div>

          {isFree && (
            <div className="flex gap-3 bg-amber-400/5 border border-amber-400/15 rounded-lg p-3.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-zinc-400 text-xs leading-relaxed">
                Free plan: <strong className="text-zinc-300">1 active event</strong>, <strong className="text-zinc-300">500 tickets per month</strong>. Paystack payments only.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors text-sm font-semibold">
              Cancel
            </button>
            <button type="submit" disabled={createMutation.isPending || uploadingImage}
              className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {createMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : "Create Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Ticket Type Panel ───────────────────────────────────────────────────

function EditTicketTypePanel({
  tt, event, onClose, onSaved,
}: { tt: TicketTypeData; event: EventData; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isGroup, setIsGroup] = useState((tt.groupSize ?? 1) > 1);

  const form = useForm<EditTicketTypeForm>({
    resolver: zodResolver(editTicketTypeSchema),
    defaultValues: {
      name: tt.name,
      price: tt.price,
      quantityAvailable: tt.quantityAvailable,
      groupSize: tt.groupSize ?? 1,
      groupLabel: tt.groupLabel ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: EditTicketTypeForm) => {
      if (values.quantityAvailable < tt.quantitySold) {
        throw new Error(`Quantity cannot be less than tickets already sold (${tt.quantitySold}).`);
      }
      const res = await apiRequest("PATCH", `/api/events/${event.id}/ticket-types/${tt.id}`, values);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update ticket type");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Ticket type updated!" });
      onSaved();
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="bg-zinc-800/80 border border-amber-400/20 rounded-lg px-4 py-3 space-y-3">
      {event.isActive && (
        <div className="flex items-center gap-2 bg-amber-400/8 border border-amber-400/20 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <p className="text-amber-300 text-xs">This event is live — changes will take effect immediately for new purchases.</p>
        </div>
      )}
      <form onSubmit={form.handleSubmit((v) => mutation.mutate({ ...v, groupSize: isGroup ? v.groupSize : 1, groupLabel: isGroup ? v.groupLabel : null }))} className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-3 sm:col-span-1">
            <label className="text-zinc-500 text-xs block mb-1">Name *</label>
            <input {...form.register("name")} placeholder="e.g. Regular"
              className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-8 text-sm outline-none focus:border-amber-400 transition-colors placeholder:text-zinc-600" />
            {form.formState.errors.name && <p className="text-red-400 text-xs mt-0.5">{form.formState.errors.name.message}</p>}
          </div>
          <div>
            <label className="text-zinc-500 text-xs block mb-1">Price (₦)</label>
            <input {...form.register("price")} type="number" min={0} placeholder="5000"
              className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-8 text-sm outline-none focus:border-amber-400 transition-colors" />
            {form.formState.errors.price && <p className="text-red-400 text-xs mt-0.5">{form.formState.errors.price.message}</p>}
          </div>
          <div>
            <label className="text-zinc-500 text-xs block mb-1">
              Qty <span className="text-zinc-600">(min {tt.quantitySold} sold)</span>
            </label>
            <input {...form.register("quantityAvailable")} type="number" min={tt.quantitySold || 1}
              className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-8 text-sm outline-none focus:border-amber-400 transition-colors" />
            {form.formState.errors.quantityAvailable && <p className="text-red-400 text-xs mt-0.5">{form.formState.errors.quantityAvailable.message}</p>}
          </div>
        </div>
        {/* Group ticket toggle */}
        <div className="flex items-center gap-2 pt-1">
          <button type="button" onClick={() => setIsGroup((v) => !v)}
            className={`w-8 h-4 rounded-full transition-colors flex items-center ${isGroup ? "bg-amber-400" : "bg-zinc-700"}`}>
            <span className={`w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${isGroup ? "translate-x-4" : "translate-x-0"}`} />
          </button>
          <span className="text-zinc-400 text-xs">Group ticket</span>
        </div>
        {isGroup && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-zinc-500 text-xs block mb-1">People per ticket</label>
              <input {...form.register("groupSize")} type="number" min={2} max={50} placeholder="4"
                className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-8 text-sm outline-none focus:border-amber-400 transition-colors" />
            </div>
            <div>
              <label className="text-zinc-500 text-xs block mb-1">Label <span className="text-zinc-600">(optional)</span></label>
              <input {...form.register("groupLabel")} placeholder="e.g. Table, Couple"
                className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-8 text-sm outline-none focus:border-amber-400 transition-colors placeholder:text-zinc-600" />
            </div>
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-500 hover:text-zinc-300 text-xs transition-colors">Cancel</button>
          <button type="submit" disabled={mutation.isPending}
            className="px-3 py-1.5 rounded-lg bg-amber-400/90 hover:bg-amber-400 text-black font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5">
            {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Add Ticket Type Form ─────────────────────────────────────────────────────

function AddTicketTypePanel({
  event, onClose, onAdded,
}: { event: EventData; onClose: () => void; onAdded: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isGroup, setIsGroup] = useState(false);

  const usedCapacity = event.ticketTypes.reduce((s, t) => s + t.quantityAvailable, 0);
  const remaining = event.maxTickets - usedCapacity;

  const form = useForm<NewTicketTypeForm>({
    resolver: zodResolver(newTicketTypeSchema),
    defaultValues: { name: "", price: 0, quantityAvailable: Math.min(remaining, 50), groupSize: 1, groupLabel: "" },
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
      <form onSubmit={form.handleSubmit((v) => mutation.mutate({ ...v, groupSize: isGroup ? v.groupSize : 1, groupLabel: isGroup ? v.groupLabel : null }))} className="space-y-3">
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
        {/* Group ticket toggle */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setIsGroup((v) => !v)}
            className={`w-8 h-4 rounded-full transition-colors flex items-center ${isGroup ? "bg-amber-400" : "bg-zinc-700"}`}>
            <span className={`w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${isGroup ? "translate-x-4" : "translate-x-0"}`} />
          </button>
          <span className="text-zinc-400 text-xs">Group ticket</span>
        </div>
        {isGroup && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-zinc-500 text-xs block mb-1">People per ticket</label>
              <input {...form.register("groupSize")} type="number" min={2} max={50} placeholder="4"
                className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-9 text-sm outline-none focus:border-amber-400 transition-colors" />
              <p className="text-zinc-600 text-xs mt-0.5">Deducts this many seats per ticket sold</p>
            </div>
            <div>
              <label className="text-zinc-500 text-xs block mb-1">Label <span className="text-zinc-600">(optional)</span></label>
              <input {...form.register("groupLabel")} placeholder="e.g. Table, Couple"
                className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-9 text-sm outline-none focus:border-amber-400 transition-colors placeholder:text-zinc-600" />
            </div>
          </div>
        )}
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

// ─── Edit Event Panel ─────────────────────────────────────────────────────────

const editEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  date: z.string().min(1, "Date is required"),
  location: z.string().min(1, "Location is required"),
  startTime: z.string().optional().nullable(),
  description: z.string().optional(),
  coverImageUrl: z.string().optional().nullable(),
});
type EditEventForm = z.infer<typeof editEventSchema>;

function EditEventPanel({
  event, onClose, onSaved,
}: { event: EventData; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const form = useForm<EditEventForm>({
    resolver: zodResolver(editEventSchema),
    defaultValues: {
      title: event.title,
      date: event.date,
      location: event.location,
      startTime: event.startTime ?? "",
      description: event.description ?? "",
      coverImageUrl: event.coverImageUrl ?? null,
    },
  });

  const coverImageUrl = form.watch("coverImageUrl");

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select an image under 5 MB.", variant: "destructive" });
      return;
    }
    setUploadingImage(true);
    try {
      const urlRes = await apiRequest("POST", "/api/uploads/request-url", {
        name: file.name, size: file.size, contentType: file.type,
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      const putRes = await fetch(uploadURL, {
        method: "PUT", body: file, headers: { "Content-Type": file.type },
      });
      if (!putRes.ok) throw new Error("Upload failed");

      form.setValue("coverImageUrl", objectPath);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  }

  function removeImage() {
    form.setValue("coverImageUrl", null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const saveMutation = useMutation({
    mutationFn: async (values: EditEventForm) => {
      const res = await apiRequest("PATCH", `/api/events/${event.id}`, values);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Event updated!" });
      onSaved();
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const displayImageSrc = imagePreview ?? (event.coverImageUrl ? event.coverImageUrl : null);
  const hasImage = !!(coverImageUrl || imagePreview);

  return (
    <div className="border-t border-zinc-800 px-5 pb-5 pt-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-zinc-300 text-sm font-semibold flex items-center gap-1.5">
          <Pencil className="w-3.5 h-3.5 text-amber-400" /> Edit Event Details
        </span>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-zinc-500 text-xs uppercase tracking-widest block mb-1">Title *</label>
            <input {...form.register("title")} placeholder="e.g. Lagos Jazz Night"
              className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-9 text-sm outline-none focus:border-amber-400 transition-colors placeholder:text-zinc-600" />
            {form.formState.errors.title && <p className="text-red-400 text-xs mt-0.5">{form.formState.errors.title.message}</p>}
          </div>
          <div>
            <label className="text-zinc-500 text-xs uppercase tracking-widest block mb-1">Date *</label>
            <input {...form.register("date")} type="date"
              className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-9 text-sm outline-none focus:border-amber-400 transition-colors" />
            {form.formState.errors.date && <p className="text-red-400 text-xs mt-0.5">{form.formState.errors.date.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-zinc-500 text-xs uppercase tracking-widest block mb-1">Location *</label>
            <input {...form.register("location")} placeholder="e.g. Eko Hotel, Lagos"
              className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-9 text-sm outline-none focus:border-amber-400 transition-colors placeholder:text-zinc-600" />
            {form.formState.errors.location && <p className="text-red-400 text-xs mt-0.5">{form.formState.errors.location.message}</p>}
          </div>
          <div>
            <label className="text-zinc-500 text-xs uppercase tracking-widest block mb-1">
              Event Time <span className="normal-case text-zinc-600">(optional)</span>
            </label>
            <input {...form.register("startTime")} type="time"
              className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-9 text-sm outline-none focus:border-amber-400 transition-colors" />
          </div>
        </div>
        <div>
          <label className="text-zinc-500 text-xs uppercase tracking-widest block mb-1">
            Description <span className="normal-case text-zinc-600">(optional)</span>
          </label>
          <textarea {...form.register("description")} rows={3}
            placeholder="Tell attendees what this event is about..."
            className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400 transition-colors placeholder:text-zinc-600 resize-none" />
        </div>

        <div>
          <label className="text-zinc-500 text-xs uppercase tracking-widest block mb-1">
            Cover Image <span className="normal-case text-zinc-600">(optional)</span>
          </label>
          {hasImage && displayImageSrc ? (
            <div className="relative rounded-xl overflow-hidden border border-zinc-700">
              <img src={displayImageSrc} alt="Cover" className="w-full h-32 object-cover" />
              <button type="button" onClick={removeImage}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-zinc-900/80 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}
              className="w-full border-2 border-dashed border-zinc-700 hover:border-amber-400/50 rounded-xl p-4 flex flex-col items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {uploadingImage
                ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Uploading...</span></>
                : <><Image className="w-4 h-4" /><span className="text-xs">Click to upload a cover image</span><span className="text-xs text-zinc-600">JPG, PNG, WebP — max 5 MB</span></>
              }
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-zinc-700 text-zinc-500 hover:text-zinc-300 text-xs transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saveMutation.isPending || uploadingImage}
            className="px-4 py-1.5 rounded-lg bg-amber-400/90 hover:bg-amber-400 text-black font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5">
            {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Attendees Section ────────────────────────────────────────────────────────

interface AttendeeOrder {
  id: string;
  eventId: string | null;
  ticketTypeId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  instagramHandle: string | null;
  ticketType: string;
  quantity: number;
  totalAmount: number;
  status: string;
  createdAt: string | null;
}

function AttendeesSection({ event }: { event: EventData }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const token = getToken();

  const { data: attendees = [], isLoading } = useQuery<AttendeeOrder[]>({
    queryKey: ["/api/events", event.id, "orders"],
    enabled: open,
    queryFn: async () => {
      const res = await fetch(`/api/events/${event.id}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load attendees");
      return res.json();
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest("PATCH", `/api/events/${event.id}/orders/${orderId}/confirm`, {});
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to confirm");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events", event.id, "orders"] });
      toast({ title: "Transfer confirmed", description: "Order is now fully confirmed." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusConfig: Record<string, { label: string; cls: string }> = {
    confirmed: { label: "Confirmed", cls: "text-green-400 bg-green-400/10 border-green-400/20" },
    awaiting_transfer: { label: "Awaiting Transfer", cls: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
    failed: { label: "Failed", cls: "text-red-400 bg-red-400/10 border-red-400/20" },
  };

  return (
    <div className="border-t border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-zinc-800/40 transition-colors">
        <Users className="w-4 h-4 text-zinc-500 flex-shrink-0" />
        <span className="flex-1 text-zinc-400 text-xs font-semibold uppercase tracking-widest">
          Attendees
          {!isLoading && open && attendees.length > 0 && (
            <span className="ml-2 normal-case font-normal text-zinc-600">({attendees.length})</span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-zinc-600" /> : <ChevronDown className="w-4 h-4 text-zinc-600" />}
      </button>

      {open && (
        <div className="px-5 pb-5">
          {isLoading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-3">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading attendees…
            </div>
          ) : attendees.length === 0 ? (
            <div className="text-center py-6">
              <Users className="w-7 h-7 text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-600 text-sm">No ticket purchases yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attendees.map((a) => {
                const sc = statusConfig[a.status] ?? { label: a.status, cls: "text-zinc-400 bg-zinc-800 border-zinc-700" };
                return (
                  <div key={a.id} className="flex items-start gap-3 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-semibold text-sm">{a.customerName}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${sc.cls}`}>
                          {sc.label}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400">
                          {a.quantity} × {a.ticketType}
                        </span>
                      </div>
                      <p className="text-zinc-500 text-xs">{a.customerEmail} · {a.customerPhone}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-amber-400 font-bold text-sm">
                          ₦{new Intl.NumberFormat("en-NG").format(a.totalAmount)}
                        </span>
                        {a.createdAt && (
                          <span className="text-zinc-700 text-xs">
                            {new Date(a.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>
                    {a.status === "awaiting_transfer" && (
                      <button
                        onClick={() => confirmMutation.mutate(a.id)}
                        disabled={confirmMutation.isPending}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 text-xs font-bold transition-colors disabled:opacity-50">
                        {confirmMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                        Confirm
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function CopyLinkButton({ eventId }: { eventId: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    const url = `${window.location.origin}/e/${eventId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      title="Copy public event link"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-semibold transition-colors hover:border-zinc-500 text-zinc-400 hover:text-white">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Link2 className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{copied ? "Copied!" : "Share"}</span>
    </button>
  );
}

// ─── Discount Codes Panel ─────────────────────────────────────────────────────

interface DiscountCodeData {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  appliesTo: "all" | "specific";
  appliesToTicketTypeId: string | null;
  usageLimit: number | null;
  timesUsed: number;
  expiresAt: string | null;
}

const newDiscountSchema = z.object({
  code: z.string().min(3, "Code must be at least 3 characters").max(20),
  type: z.enum(["percent", "fixed"]),
  value: z.coerce.number().min(1, "Value must be at least 1"),
  appliesTo: z.enum(["all", "specific"]).default("all"),
  appliesToTicketTypeId: z.string().nullable().optional(),
  usageLimit: z.coerce.number().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});
type NewDiscountForm = z.infer<typeof newDiscountSchema>;

function DiscountCodesPanel({ event }: { event: EventData }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const { data: codes = [], isLoading } = useQuery<DiscountCodeData[]>({
    queryKey: ["/api/events", event.id, "discount-codes"],
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`/api/events/${event.id}/discount-codes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load discount codes");
      return res.json();
    },
    enabled: open,
  });

  const form = useForm<NewDiscountForm>({
    resolver: zodResolver(newDiscountSchema),
    defaultValues: { code: "", type: "percent", value: 10, appliesTo: "all", usageLimit: null, expiresAt: null },
  });
  const watchType = form.watch("type");
  const watchAppliesTo = form.watch("appliesTo");

  const createMutation = useMutation({
    mutationFn: async (values: NewDiscountForm) => {
      const res = await apiRequest("POST", `/api/events/${event.id}/discount-codes`, {
        ...values,
        code: values.code.toUpperCase(),
        usageLimit: values.usageLimit || null,
        expiresAt: values.expiresAt || null,
        appliesToTicketTypeId: values.appliesTo === "specific" ? (values.appliesToTicketTypeId || null) : null,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create code");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events", event.id, "discount-codes"] });
      toast({ title: "Discount code created!" });
      form.reset({ code: "", type: "percent", value: 10, appliesTo: "all", usageLimit: null, expiresAt: null });
      setAdding(false);
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/discount-codes/${id}`, undefined);
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to delete");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events", event.id, "discount-codes"] });
      toast({ title: "Code deleted" });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="mt-4 border-t border-zinc-800 pt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-semibold w-full text-left transition-colors">
        <Tag className="w-3.5 h-3.5 text-amber-400" />
        Discount Codes
        <span className="text-zinc-600 font-normal text-xs ml-1">{codes.length > 0 ? `(${codes.length})` : ""}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-zinc-600 text-xs py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading codes...
            </div>
          ) : codes.length === 0 && !adding ? (
            <p className="text-zinc-600 text-xs py-1">No discount codes yet.</p>
          ) : (
            <div className="space-y-1.5">
              {codes.map((dc) => (
                <div key={dc.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-white font-mono font-bold text-sm">{dc.code}</span>
                    <span className="text-amber-400 text-xs font-semibold">
                      {dc.type === "percent" ? `${dc.value}%` : `₦${dc.value.toLocaleString()}`} off
                    </span>
                    {dc.usageLimit && (
                      <span className="text-zinc-600 text-xs">{dc.timesUsed}/{dc.usageLimit} used</span>
                    )}
                    {!dc.usageLimit && dc.timesUsed > 0 && (
                      <span className="text-zinc-600 text-xs">{dc.timesUsed} used</span>
                    )}
                    {dc.expiresAt && (
                      <span className="text-zinc-600 text-xs hidden sm:inline">· exp {new Date(dc.expiresAt).toLocaleDateString()}</span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(dc.id)}
                    disabled={deleteMutation.isPending}
                    className="p-1 rounded text-zinc-700 hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {adding ? (
            <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-zinc-300 text-sm font-semibold">New Discount Code</span>
                <button onClick={() => setAdding(false)} className="text-zinc-600 hover:text-zinc-400"><X className="w-3.5 h-3.5" /></button>
              </div>
              <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-zinc-500 text-xs block mb-1">Code *</label>
                    <input {...form.register("code")} placeholder="SAVE20" maxLength={20}
                      onChange={(e) => form.setValue("code", e.target.value.toUpperCase())}
                      className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-8 text-sm font-mono outline-none focus:border-amber-400 transition-colors uppercase placeholder:text-zinc-600 placeholder:normal-case" />
                    {form.formState.errors.code && <p className="text-red-400 text-xs mt-0.5">{form.formState.errors.code.message}</p>}
                  </div>
                  <div>
                    <label className="text-zinc-500 text-xs block mb-1">Type</label>
                    <select {...form.register("type")}
                      className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-8 text-sm outline-none focus:border-amber-400 transition-colors">
                      <option value="percent">Percentage</option>
                      <option value="fixed">Fixed amount</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-zinc-500 text-xs block mb-1">
                      Value {watchType === "percent" ? "(%)" : "(₦)"}
                    </label>
                    <input {...form.register("value")} type="number" min={1} max={watchType === "percent" ? 100 : undefined}
                      className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-8 text-sm outline-none focus:border-amber-400 transition-colors" />
                    {form.formState.errors.value && <p className="text-red-400 text-xs mt-0.5">{form.formState.errors.value.message}</p>}
                  </div>
                  <div>
                    <label className="text-zinc-500 text-xs block mb-1">Usage limit <span className="text-zinc-600">(opt)</span></label>
                    <input {...form.register("usageLimit")} type="number" min={1} placeholder="∞"
                      className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-8 text-sm outline-none focus:border-amber-400 transition-colors placeholder:text-zinc-600" />
                  </div>
                  <div>
                    <label className="text-zinc-500 text-xs block mb-1">Expiry <span className="text-zinc-600">(opt)</span></label>
                    <input {...form.register("expiresAt")} type="date"
                      className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-8 text-sm outline-none focus:border-amber-400 transition-colors" />
                  </div>
                </div>
                {event.ticketTypes.length > 1 && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-zinc-500 text-xs block mb-1">Applies to</label>
                      <select {...form.register("appliesTo")}
                        className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-8 text-sm outline-none focus:border-amber-400 transition-colors">
                        <option value="all">All ticket types</option>
                        <option value="specific">Specific ticket type</option>
                      </select>
                    </div>
                    {watchAppliesTo === "specific" && (
                      <div>
                        <label className="text-zinc-500 text-xs block mb-1">Ticket type</label>
                        <select {...form.register("appliesToTicketTypeId")}
                          className="w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-8 text-sm outline-none focus:border-amber-400 transition-colors">
                          <option value="">Select...</option>
                          {event.ticketTypes.map((tt) => (
                            <option key={tt.id} value={tt.id}>{tt.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setAdding(false)}
                    className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-500 hover:text-zinc-300 text-xs transition-colors">Cancel</button>
                  <button type="submit" disabled={createMutation.isPending}
                    className="px-3 py-1.5 rounded-lg bg-amber-400/90 hover:bg-amber-400 text-black font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5">
                    {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Tag className="w-3 h-3" />}
                    Create Code
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-zinc-600 hover:text-amber-400 text-xs transition-colors mt-1">
              <Plus className="w-3.5 h-3.5" /> Add discount code
            </button>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [editingDetails, setEditingDetails] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingTicketTypeId, setEditingTicketTypeId] = useState<string | null>(null);
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [capInput, setCapInput] = useState("");
  const [capError, setCapError] = useState("");
  const [savingCapacity, setSavingCapacity] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  async function saveCapacity() {
    const newVal = parseInt(capInput, 10);
    if (isNaN(newVal) || newVal < 1) { setCapError("Must be a valid number."); return; }
    if (newVal < totalSold) { setCapError(`Cannot set below tickets already sold (${totalSold}).`); return; }
    if (newVal < totalAvailable) { setCapError(`Cannot set below allocated tier total (${totalAvailable}).`); return; }
    setSavingCapacity(true);
    try {
      const res = await apiRequest("PATCH", `/api/events/${event.id}`, { maxTickets: newVal });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.message || "Failed to save"); }
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      setEditingCapacity(false);
      setCapError("");
    } catch (err: any) {
      setCapError(err.message);
    } finally {
      setSavingCapacity(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await apiRequest("DELETE", `/api/events/${event.id}`);
      if (res.status === 409) {
        const body = await res.json();
        toast({ title: "Cannot delete event", description: body.message, variant: "destructive" });
        setConfirmDelete(false);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to delete event");
      }
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Event deleted", description: `"${event.title}" has been removed.` });
      setConfirmDelete(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  }

  function copyPublicLink() {
    const url = `${window.location.origin}/e/${event.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }).catch(() => {
      toast({ title: "Could not copy link", description: "Please copy it manually.", variant: "destructive" });
    });
  }

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
            <CopyLinkButton eventId={event.id} />
            <a
              href={`/analytics/${event.id}`}
              title="View analytics"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-semibold transition-colors hover:border-amber-400/40 text-zinc-400 hover:text-amber-400">
              <BarChart2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Analytics</span>
            </a>
            <button
              onClick={() => { setEditingDetails((v) => !v); setExpanded(true); }}
              title="Edit description & cover image"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                editingDetails
                  ? "border-amber-400/40 text-amber-400 bg-amber-400/10"
                  : "border-zinc-700 text-zinc-400 hover:border-amber-400/40 hover:text-amber-400"
              }`}>
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit</span>
            </button>
            <button
              onClick={copyPublicLink}
              title="Copy public event link"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-semibold transition-colors hover:border-zinc-500 text-zinc-400 hover:text-white">
              {linkCopied
                ? <><Check className="w-3.5 h-3.5 text-green-400" /><span className="hidden sm:inline text-green-400">Copied!</span></>
                : <><Link2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Copy Link</span></>
              }
            </button>
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
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete event"
              className="p-1.5 rounded-lg text-zinc-700 hover:text-red-400 hover:bg-red-400/10 transition-colors">
              <Trash2 className="w-4 h-4" />
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
            {editingCapacity ? (
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={totalSold}
                    value={capInput}
                    onChange={(e) => { setCapInput(e.target.value); setCapError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") saveCapacity(); if (e.key === "Escape") { setEditingCapacity(false); setCapError(""); } }}
                    className="w-20 px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-mono focus:outline-none focus:border-amber-500"
                    autoFocus
                  />
                  <button
                    onClick={saveCapacity}
                    disabled={savingCapacity}
                    className="px-2 py-0.5 rounded-md bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold transition-colors disabled:opacity-50">
                    {savingCapacity ? "…" : "Save"}
                  </button>
                  <button
                    onClick={() => { setEditingCapacity(false); setCapError(""); }}
                    className="p-0.5 text-zinc-600 hover:text-zinc-400 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {capError && <span className="text-red-400 text-xs">{capError}</span>}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-400 text-xs font-mono">{usedCapacity} / {event.maxTickets} allocated · <span className="text-amber-400">{totalSold} sold</span></span>
                <button
                  onClick={() => { setCapInput(String(event.maxTickets)); setCapError(""); setEditingCapacity(true); }}
                  title="Edit capacity"
                  className="p-0.5 text-zinc-700 hover:text-zinc-400 transition-colors">
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
          <CapacityBar used={usedCapacity} total={event.maxTickets} />
        </div>
      </div>

      {/* Edit details panel */}
      {expanded && editingDetails && (
        <EditEventPanel
          event={event}
          onClose={() => setEditingDetails(false)}
          onSaved={() => setEditingDetails(false)}
        />
      )}

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
                <div key={tt.id}>
                  {editingTicketTypeId === tt.id ? (
                    <EditTicketTypePanel
                      tt={tt}
                      event={event}
                      onClose={() => setEditingTicketTypeId(null)}
                      onSaved={() => setEditingTicketTypeId(null)}
                    />
                  ) : (
                    <div className="flex items-center justify-between bg-zinc-800/60 rounded-lg px-4 py-2.5 gap-4">
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                        <span className="text-zinc-300 text-sm font-semibold">{tt.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span className="font-mono text-zinc-300">₦{fmtPrice(tt.price)}</span>
                        <span>{tt.quantitySold} / {tt.quantityAvailable} sold</span>
                        <div className="w-16 h-1 bg-zinc-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-amber-400 transition-all"
                            style={{ width: `${tt.quantityAvailable > 0 ? (tt.quantitySold / tt.quantityAvailable) * 100 : 0}%` }} />
                        </div>
                        <button
                          onClick={() => { setEditingTicketTypeId(tt.id); setAddingTicketType(false); }}
                          title="Edit ticket type"
                          className="p-1 rounded text-zinc-600 hover:text-amber-400 hover:bg-amber-400/10 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
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

      <AttendeesSection event={event} />

      <DiscountCodesPanel event={event} />

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Delete this event?</h3>
                <p className="text-zinc-500 text-xs mt-0.5">This cannot be undone. All ticket data will be lost.</p>
              </div>
            </div>
            <p className="text-zinc-400 text-sm mb-5 bg-zinc-800 rounded-lg px-3 py-2 truncate">
              {event.title}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-sm font-semibold transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isDeleting
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Deleting...</>
                  : <><Trash2 className="w-4 h-4" /> Confirm Delete</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const FREE_MAX_ACTIVE_EVENTS = 1;

// ─── Flutterwave Section ──────────────────────────────────────────────────────

const fwFormSchema = z.object({
  flutterwavePublicKey: z.string().min(1, "Public key is required"),
  flutterwaveSecretKey: z.string().min(1, "Secret key is required"),
});
type FwForm = z.infer<typeof fwFormSchema>;

interface PaymentSettings {
  tier: "free" | "pro";
  bankName: string;
  bankCode: string;
  accountNumber: string;
  businessName: string;
  flutterwavePublicKey: string;
  flutterwaveSecretKey: string;
  hasFlutterwave: boolean;
}

// ─── Edit Bank Account Section ────────────────────────────────────────────────

interface PaystackBank { id: number; name: string; code: string; }

const bankAccountSchema = z.object({
  bankCode: z.string().min(1, "Please select your bank"),
  bankName: z.string(),
  accountNumber: z.string().regex(/^\d{10}$/, "Must be exactly 10 digits"),
});
type BankAccountForm = z.infer<typeof bankAccountSchema>;

function EditBankAccountSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: settings, isLoading: settingsLoading } = useQuery<PaymentSettings>({
    queryKey: ["/api/organizer/payment-settings"],
  });

  const { data: banks = [], isLoading: banksLoading } = useQuery<PaystackBank[]>({
    queryKey: ["/api/onboarding/banks"],
    staleTime: 60 * 60 * 1000,
    enabled: open,
  });

  const form = useForm<BankAccountForm>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: { bankCode: "", bankName: "", accountNumber: "" },
  });

  useEffect(() => {
    if (open && settings) {
      form.reset({
        bankCode: settings.bankCode || "",
        bankName: settings.bankName || "",
        accountNumber: settings.accountNumber || "",
      });
    }
  }, [open, settings]);

  const saveMutation = useMutation({
    mutationFn: async (values: BankAccountForm) => {
      const res = await apiRequest("PUT", "/api/organizer/bank-account", values);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to update bank account");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/organizer/payment-settings"] });
      toast({ title: "Bank account updated", description: "Your settlement account has been updated on Paystack." });
      setOpen(false);
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const maskedAccount = settings
    ? `${settings.bankName} \u2022\u2022\u2022\u2022 ${settings.accountNumber.slice(-4)}`
    : "—";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 mb-6 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-zinc-900 transition-colors">
        <div className="p-2 rounded-lg bg-amber-400/10 border border-amber-400/20 flex-shrink-0">
          <Landmark className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">Settlement Bank Account</p>
          <p className="text-zinc-500 text-xs mt-0.5 font-mono">
            {settingsLoading ? "Loading…" : maskedAccount}
          </p>
        </div>
        <Pencil className="w-3.5 h-3.5 text-zinc-500 mr-1" />
        {open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>

      {open && (
        <div className="border-t border-zinc-800 px-5 pb-5 pt-4">
          <p className="text-zinc-500 text-xs mb-4">
            Changing your bank account will update your Paystack subaccount. Payouts will go to the new account.
          </p>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4">
              {/* Bank selector */}
              <FormField control={form.control} name="bankCode" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Bank</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <select
                        value={field.value}
                        onChange={(e) => {
                          const bank = banks.find((b) => b.code === e.target.value);
                          field.onChange(e.target.value);
                          form.setValue("bankName", bank?.name || "");
                        }}
                        className="w-full appearance-none bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400/50 transition-colors pr-8"
                      >
                        <option value="">{banksLoading ? "Loading banks…" : "Select your bank"}</option>
                        {banks.map((b) => (
                          <option key={b.code} value={b.code}>{b.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                    </div>
                  </FormControl>
                  <FormMessage className="text-red-400 text-xs" />
                </FormItem>
              )} />

              {/* Account number */}
              <FormField control={form.control} name="accountNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Account Number</FormLabel>
                  <FormControl>
                    <input
                      {...field}
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="0123456789"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-400/50 transition-colors"
                    />
                  </FormControl>
                  <FormMessage className="text-red-400 text-xs" />
                </FormItem>
              )} />

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-sm font-bold transition-colors disabled:opacity-50">
                  {saveMutation.isPending
                    ? <><span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Saving…</>
                    : <><Check className="w-3.5 h-3.5" /> Save Changes</>}
                </button>
                <button
                  type="button"
                  onClick={() => { setOpen(false); form.reset(); }}
                  className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white text-sm font-medium transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
}

function FlutterwaveSection({ tier }: { tier: "free" | "pro" }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: settings, isLoading } = useQuery<PaymentSettings>({
    queryKey: ["/api/organizer/payment-settings"],
    enabled: tier === "pro",
  });

  const form = useForm<FwForm>({
    resolver: zodResolver(fwFormSchema),
    defaultValues: { flutterwavePublicKey: "", flutterwaveSecretKey: "" },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        flutterwavePublicKey: settings.flutterwavePublicKey || "",
        flutterwaveSecretKey: "",
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (values: FwForm) => {
      const res = await apiRequest("PUT", "/api/organizer/payment-settings", values);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to save");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/organizer/payment-settings"] });
      toast({ title: "Flutterwave keys saved", description: "Your events can now accept Flutterwave payments." });
      form.reset({ flutterwavePublicKey: form.getValues("flutterwavePublicKey"), flutterwaveSecretKey: "" });
    },
    onError: (err: any) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  if (tier !== "pro") {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 mb-6 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 flex-shrink-0">
            <Wallet className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-zinc-400 font-semibold text-sm flex items-center gap-2">
              Flutterwave Payments <Lock className="w-3.5 h-3.5 text-zinc-600" />
            </p>
            <p className="text-zinc-600 text-xs mt-0.5">
              Accept card, bank transfer and USSD via Flutterwave. Pro plan only.
            </p>
          </div>
          <a href="/pricing"
            className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-violet-500/40 text-violet-400 hover:bg-violet-500/10 text-xs font-semibold transition-colors">
            Upgrade
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 mb-6 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-zinc-900 transition-colors">
        <div className="p-2 rounded-lg bg-amber-400/10 border border-amber-400/20 flex-shrink-0">
          <Wallet className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">Flutterwave Payments</p>
          <p className="text-zinc-500 text-xs mt-0.5">
            {settings?.hasFlutterwave
              ? "Keys configured — events can accept Flutterwave payments"
              : "Add your API keys to enable Flutterwave checkout on events"}
          </p>
        </div>
        {settings?.hasFlutterwave && <CheckCheck className="w-4 h-4 text-green-400 mr-1" />}
        {open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>

      {open && (
        <div className="border-t border-zinc-800 px-5 pb-5 pt-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <p className="text-zinc-500 text-xs mb-4">
                Get your API keys from the{" "}
                <a href="https://dashboard.flutterwave.com/dashboard/settings/apis" target="_blank" rel="noopener noreferrer"
                  className="text-amber-400 hover:text-amber-300 underline">
                  Flutterwave dashboard
                </a>.
                {" "}Secret key is write-only — paste a new one to update.
              </p>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4">
                  <FormField control={form.control} name="flutterwavePublicKey" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Public Key (FLWPUBK-…)</FormLabel>
                      <FormControl>
                        <input {...field} placeholder="FLWPUBK-xxxxxxxx"
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-400/50 transition-colors" />
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="flutterwaveSecretKey" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Secret Key (FLWSECK-…)</FormLabel>
                      <FormControl>
                        <input {...field} type="password" placeholder={settings?.hasFlutterwave ? "Paste new key to update" : "FLWSECK-xxxxxxxx"}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-400/50 transition-colors" />
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )} />
                  <button type="submit" disabled={saveMutation.isPending}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-sm font-bold transition-colors disabled:opacity-60">
                    {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Save Keys
                  </button>
                </form>
              </Form>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Pending Transfers Section ────────────────────────────────────────────────

interface PendingOrder {
  id: string;
  eventId: string | null;
  eventTitle: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  ticketType: string;
  quantity: number;
  totalAmount: number;
  createdAt: string | null;
  status: string;
}

function PendingTransfersSection({ tier }: { tier: "free" | "pro" }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const token = getToken();

  const { data: pending = [], isLoading } = useQuery<PendingOrder[]>({
    queryKey: ["/api/orders/pending-transfers"],
    enabled: tier === "pro" && open,
    refetchInterval: open ? 30000 : false,
    queryFn: async () => {
      const res = await fetch("/api/orders/pending-transfers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest("PATCH", `/api/orders/${orderId}/confirm-transfer`, {});
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/orders/pending-transfers"] });
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Transfer confirmed", description: "Ticket is now fully confirmed." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (tier !== "pro") return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 mb-6 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-zinc-900 transition-colors">
        <div className="p-2 rounded-lg bg-amber-400/10 border border-amber-400/20 flex-shrink-0">
          <Clock className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">Pending Bank Transfers</p>
          <p className="text-zinc-500 text-xs mt-0.5">
            Buyers who selected bank transfer — confirm when payment arrives
          </p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>

      {open && (
        <div className="border-t border-zinc-800 px-5 pb-5 pt-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : pending.length === 0 ? (
            <div className="text-center py-6">
              <CheckCheck className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-600 text-sm">No pending transfers</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((order) => (
                <div key={order.id} className="flex items-start gap-4 bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-semibold text-sm">{order.customerName}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
                        {order.quantity} × {order.ticketType}
                      </span>
                    </div>
                    <p className="text-zinc-500 text-xs">{order.customerEmail} · {order.customerPhone}</p>
                    <p className="text-zinc-600 text-xs">{order.eventTitle}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-amber-400 font-bold text-sm">
                        ₦{new Intl.NumberFormat("en-NG").format(order.totalAmount)}
                      </span>
                      {order.createdAt && (
                        <span className="text-zinc-700 text-xs">
                          {new Date(order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => confirmMutation.mutate(order.id)}
                    disabled={confirmMutation.isPending}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 text-xs font-bold transition-colors disabled:opacity-50">
                    {confirmMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                    Confirm
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Branding Section ─────────────────────────────────────────────────────────

interface BrandTheme {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
}

const COLOR_LABELS: Record<keyof BrandTheme, string> = {
  primary: "Primary", accent: "Accent", background: "Background", surface: "Surface", text: "Text",
};

function extractThemeFromImage(imgEl: HTMLImageElement): BrandTheme {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(imgEl, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const toHex = (r: number, g: number, b: number) =>
    "#" + [r, g, b].map((v) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const getSat = (r: number, g: number, b: number) => {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return max === 0 ? 0 : (max - min) / max;
  };
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < data.length; i += 4)
    if (data[i + 3] > 128) pixels.push([data[i], data[i + 1], data[i + 2]]);
  if (pixels.length === 0)
    return { primary: "#F59E0B", accent: "#D97706", background: "#0d0d0d", surface: "#1c1c1e", text: "#ffffff" };
  const vibrant = [...pixels].sort((a, b) => getSat(...b) - getSat(...a)).filter(([r, g, b]) => getSat(r, g, b) > 0.2);
  const [pr, pg, pb] = vibrant[0] ?? pixels[Math.floor(pixels.length / 2)];
  const primary = toHex(pr, pg, pb);
  const accentPx = vibrant.find(([r, g, b]) => Math.sqrt((r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2) > 50)
    ?? ([pr * 0.7, pg * 0.7, pb * 0.7] as [number, number, number]);
  const accent = toHex(...(accentPx as [number, number, number]));
  const avgR = pixels.reduce((s, [r]) => s + r, 0) / pixels.length;
  const avgG = pixels.reduce((s, [, g]) => s + g, 0) / pixels.length;
  const avgB = pixels.reduce((s, [, , b]) => s + b, 0) / pixels.length;
  const background = toHex(avgR * 0.08, avgG * 0.08, avgB * 0.08);
  const surface = toHex(avgR * 0.16, avgG * 0.16, avgB * 0.16);
  const lum = (0.2126 * pr + 0.7152 * pg + 0.0722 * pb) / 255;
  const text = lum > 0.45 ? "#111111" : "#ffffff";
  return { primary, accent, background, surface, text };
}

const brandingFormSchema = z.object({
  customBrandName: z.string().max(80).optional(),
});
type BrandingForm = z.infer<typeof brandingFormSchema>;

interface BrandingSettings {
  customBrandName: string | null;
  customLogoUrl: string | null;
  brandTheme: BrandTheme | null;
  tier: "free" | "pro";
}

function BrandingSection({ tier }: { tier: "free" | "pro" }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [colorEditorOpen, setColorEditorOpen] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<BrandTheme | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewImgRef = useRef<HTMLImageElement>(null);
  const token = getToken();

  const { data: branding, isLoading } = useQuery<BrandingSettings>({
    queryKey: ["/api/branding/settings"],
    enabled: tier === "pro",
  });

  const form = useForm<BrandingForm>({
    resolver: zodResolver(brandingFormSchema),
    defaultValues: { customBrandName: "" },
  });

  useEffect(() => {
    if (branding) {
      form.reset({ customBrandName: branding.customBrandName ?? "" });
      if (branding.brandTheme && !theme) setTheme(branding.brandTheme);
      if (branding.customLogoUrl && !logoPreviewUrl) setLogoPreviewUrl(branding.customLogoUrl);
    }
  }, [branding]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 5 MB", variant: "destructive" }); return;
    }
    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
    setExtracting(true);
    e.target.value = "";
  };

  const handleImageLoad = () => {
    if (!previewImgRef.current || !logoFile) { setExtracting(false); return; }
    try {
      setTheme(extractThemeFromImage(previewImgRef.current));
      setColorEditorOpen(false);
    } catch { /* svg cross-origin fallback */ }
    setExtracting(false);
  };

  const handleSave = async () => {
    const values = form.getValues();
    setSaving(true);
    try {
      let logoUrl: string | null = branding?.customLogoUrl ?? null;

      if (logoFile) {
        const urlRes = await fetch("/api/branding/logo-upload-url", {
          method: "POST", headers: { Authorization: `Bearer ${token}` },
        });
        if (!urlRes.ok) throw new Error((await urlRes.json()).message || "Failed to get upload URL");
        const { uploadURL, objectPath } = await urlRes.json();
        const uploadRes = await fetch(uploadURL, {
          method: "PUT", body: logoFile, headers: { "Content-Type": logoFile.type || "image/png" },
        });
        if (!uploadRes.ok) throw new Error("Logo upload failed");
        logoUrl = objectPath;
        setLogoFile(null);
      } else if (logoPreviewUrl === null) {
        logoUrl = null;
      }

      const res = await apiRequest("PUT", "/api/branding/settings", {
        customBrandName: values.customBrandName || null,
        customLogoUrl: logoUrl,
        brandTheme: theme,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Save failed");
      qc.invalidateQueries({ queryKey: ["/api/branding/settings"] });
      toast({ title: "Branding saved", description: "Your brand and color theme are now live on event pages." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (tier !== "pro") {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 mb-6 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 flex-shrink-0">
            <Paintbrush className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-zinc-400 font-semibold text-sm flex items-center gap-2">
              White-label Branding <Lock className="w-3.5 h-3.5 text-zinc-600" />
            </p>
            <p className="text-zinc-600 text-xs mt-0.5">
              Upload your logo · auto color theme · manual overrides. Pro plan only.
            </p>
          </div>
          <a href="/pricing"
            className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-violet-500/40 text-violet-400 hover:bg-violet-500/10 text-xs font-semibold transition-colors">
            Upgrade
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 mb-6 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-zinc-900 transition-colors">
        <div className="p-2 rounded-lg bg-amber-400/10 border border-amber-400/20 flex-shrink-0">
          <Paintbrush className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">White-label Branding</p>
          <p className="text-zinc-500 text-xs mt-0.5">
            {branding?.customBrandName
              ? `Brand: ${branding.customBrandName}${branding?.brandTheme ? " · Color theme active" : ""}`
              : "Logo upload · auto color theme · manual overrides"}
          </p>
        </div>
        {branding?.brandTheme && <CheckCheck className="w-4 h-4 text-green-400 mr-1" />}
        {open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>

      {open && (
        <div className="border-t border-zinc-800 px-5 pb-5 pt-4 space-y-5">
          {isLoading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (<>
            {/* Brand Name */}
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                <Type className="w-3 h-3" /> Brand Name
              </label>
              <input {...form.register("customBrandName")} placeholder="e.g. Afrobeats Lagos"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-amber-400/50 transition-colors" />
              <p className="text-zinc-600 text-xs mt-1">Shown on event pages instead of "Showgate"</p>
            </div>

            {/* Logo Upload */}
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-widest flex items-center gap-1.5 mb-2">
                <Image className="w-3 h-3" /> Logo
              </label>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden" onChange={handleFileChange} />

              {logoPreviewUrl ? (
                <div className="flex items-center gap-4 p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                  <img ref={previewImgRef} src={logoPreviewUrl} alt="Logo preview" crossOrigin="anonymous"
                    className="h-14 max-w-[140px] object-contain rounded"
                    onLoad={handleImageLoad} onError={() => setExtracting(false)} />
                  <div className="flex-1 min-w-0">
                    {extracting
                      ? <div className="flex items-center gap-1.5 text-amber-400 text-xs"><Loader2 className="w-3 h-3 animate-spin" /> Extracting colors…</div>
                      : theme
                        ? <p className="text-green-400 text-xs font-semibold flex items-center gap-1"><CheckCheck className="w-3 h-3" /> Colors extracted</p>
                        : null}
                    <p className="text-zinc-600 text-xs mt-1">PNG, JPG, SVG · Max 5 MB</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white text-xs font-semibold transition-colors">
                      Replace
                    </button>
                    <button type="button" onClick={() => { setLogoFile(null); setLogoPreviewUrl(null); setTheme(null); }}
                      className="px-3 py-1.5 rounded-lg border border-red-900/40 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition-colors">
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 py-8 rounded-xl border border-dashed border-zinc-700 hover:border-amber-400/40 hover:bg-amber-400/5 transition-colors">
                  <div className="p-2.5 rounded-lg bg-zinc-800"><Image className="w-5 h-5 text-zinc-500" /></div>
                  <div className="text-center">
                    <p className="text-zinc-400 text-sm font-semibold">Click to upload logo</p>
                    <p className="text-zinc-600 text-xs mt-0.5">PNG, JPG, SVG · Max 5 MB · Colors auto-extracted</p>
                  </div>
                </button>
              )}
            </div>

            {/* Color Theme */}
            {theme && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-zinc-400 text-xs uppercase tracking-widest flex items-center gap-1.5">
                    <Paintbrush className="w-3 h-3" /> Color Theme
                    <span className="normal-case text-zinc-600 text-xs font-normal ml-1">from logo</span>
                  </label>
                  <button type="button" onClick={() => setColorEditorOpen((v) => !v)}
                    className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors flex items-center gap-1">
                    Edit {colorEditorOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {/* Swatches row */}
                <div className="flex gap-2 flex-wrap mb-3">
                  {(Object.entries(theme) as [keyof BrandTheme, string][]).map(([key, val]) => (
                    <div key={key} className="flex flex-col items-center gap-1">
                      <div className="w-9 h-9 rounded-lg border border-zinc-700 shadow-inner"
                        style={{ backgroundColor: val }} />
                      <span className="text-zinc-600 text-[10px]">{COLOR_LABELS[key]}</span>
                    </div>
                  ))}
                </div>

                {/* Live mini-preview */}
                <div className="rounded-xl overflow-hidden border border-zinc-800 mb-3" style={{ backgroundColor: theme.background }}>
                  <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: theme.surface }}>
                    <div className="w-7 h-7 rounded-lg" style={{ backgroundColor: theme.primary }} />
                    <div>
                      <div className="text-xs font-bold" style={{ color: theme.text }}>Your Event Name</div>
                      <div className="text-[10px] opacity-50" style={{ color: theme.text }}>Venue · Date</div>
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="text-xs font-semibold" style={{ color: theme.text }}>General Admission</div>
                    <div className="px-3 py-1 rounded-lg text-xs font-bold"
                      style={{ backgroundColor: theme.primary, color: theme.background }}>
                      Buy ₦5,000
                    </div>
                  </div>
                </div>

                {/* Color override inputs */}
                {colorEditorOpen && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                    {(Object.keys(theme) as (keyof BrandTheme)[]).map((key) => (
                      <div key={key}>
                        <label className="text-zinc-500 text-[10px] uppercase tracking-widest block mb-1.5">{COLOR_LABELS[key]}</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={theme[key]}
                            onChange={(e) => setTheme((prev) => prev ? { ...prev, [key]: e.target.value } : prev)}
                            className="w-8 h-8 rounded cursor-pointer bg-transparent border border-zinc-700 p-0.5 flex-shrink-0" />
                          <input type="text" value={theme[key]} maxLength={7}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (/^#[0-9a-fA-F]{0,6}$/.test(v))
                                setTheme((prev) => prev ? { ...prev, [key]: v } : prev);
                            }}
                            className="flex-1 min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white text-xs font-mono focus:outline-none focus:border-amber-400/50" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Save */}
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-sm font-bold transition-colors disabled:opacity-60">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save Branding
            </button>
          </>)}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showNewEventForm, setShowNewEventForm] = useState(false);
  const [showCancelSubModal, setShowCancelSubModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [downloadingRef, setDownloadingRef] = useState<string | null>(null);
  const [showProPopover, setShowProPopover] = useState(false);
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

  const { data: upgradeStatus } = useQuery<UpgradeStatus>({
    queryKey: ["/api/upgrade/status"],
    enabled: isAuthenticated(),
  });

  const tier = data?.tier ?? "free";

  const { data: paymentHistory } = useQuery<HistoryItem[]>({
    queryKey: ["/api/upgrade/history"],
    enabled: isAuthenticated() && tier === "pro",
  });

  const cancelSubMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/upgrade/cancel", { reason: cancelReason || null });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Cancellation failed");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/upgrade/status"] });
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      setShowCancelSubModal(false);
      setCancelReason("");
      toast({ title: "Subscription cancelled", description: "Your plan has been downgraded to Free." });
    },
    onError: (err: any) => toast({ title: "Cancellation failed", description: err.message, variant: "destructive" }),
  });

  const pauseSubMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/cancel", { reason: cancelReason || null });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Pause failed");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/upgrade/status"] });
      setShowCancelSubModal(false);
      setCancelReason("");
      toast({ title: "Renewal paused", description: "You keep Pro until your billing period ends. You can reinstate anytime." });
    },
    onError: (err: any) => toast({ title: "Could not pause renewal", description: err.message, variant: "destructive" }),
  });

  const reinstateSubMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/reinstate", {});
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Reinstatement failed");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/upgrade/status"] });
      toast({ title: "Renewal reinstated", description: "Your Pro plan will auto-renew as normal." });
    },
    onError: (err: any) => toast({ title: "Reinstatement failed", description: err.message, variant: "destructive" }),
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
  const paystackMode = data?.paystackMode ?? "live";
  const organizerInfo = data?.organizer ?? null;

  useEffect(() => {
    const name = organizerInfo?.businessName;
    document.title = name ? `Dashboard — ${name}` : "Dashboard — Showgate";
    return () => { document.title = "Showgate"; };
  }, [organizerInfo?.businessName]);
  const limits = data?.limits ?? { maxActiveEvents: FREE_MAX_ACTIVE_EVENTS, maxMonthlyTickets: 500, allowedPaymentMethods: ["paystack"] };
  const activeCount = events.filter((e) => e.isActive).length;
  const atEventLimit = tier === "free" && activeCount >= FREE_MAX_ACTIVE_EVENTS;
  const totalSold = events.reduce((s, e) => s + e.ticketTypes.reduce((ss, t) => ss + t.quantitySold, 0), 0);

  const toggleModeMutation = useMutation({
    mutationFn: async (mode: "test" | "live") => {
      const res = await apiRequest("POST", "/api/admin/paystack-mode", { mode });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/events"] }),
    onError: (err: any) => toast({ title: "Failed to switch mode", description: err.message, variant: "destructive" }),
  });

  const setupTestSubaccountMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/setup-test-subaccount", {});
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      toast({ title: "Test payment account created!", description: "You can now process test payments." });
      qc.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: (err: any) => toast({ title: "Setup failed", description: err.message, variant: "destructive" }),
  });

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
              <h1 className="text-white font-bold text-sm">Showgate<img src={sgLogo} alt="" className="inline-block h-[18px] w-auto ml-1.5 align-middle" /></h1>
              <p className="text-zinc-600 text-xs">Event Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <span className="text-zinc-400 text-xs truncate max-w-[140px]">{user.email}</span>
                {user.role === "admin" && (
                  <a href="/admin" className="text-[10px] font-bold text-violet-400 bg-violet-500/20 border border-violet-500/30 px-1.5 py-0.5 rounded-full hover:bg-violet-500/30 transition-colors">Admin</a>
                )}
                <TierBadge tier={tier || user.tier} />
                {tier === "pro" && upgradeStatus?.proExpiresAt && (
                  <span className="text-zinc-600 text-[10px]">
                    renews {new Date(upgradeStatus.proExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
            )}
            {user && (
              <div className="relative sm:hidden">
                <button
                  onClick={() => setShowProPopover(v => !v)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800"
                  aria-label="Account info"
                >
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-700 text-[10px] font-bold text-zinc-300 uppercase leading-none">
                    {user.email.slice(0, 2)}
                  </span>
                  <TierBadge tier={tier || user.tier} />
                </button>
                {showProPopover && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProPopover(false)} />
                    <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[180px] rounded-lg bg-zinc-900 border border-zinc-800 shadow-xl px-3 py-2.5">
                      <p className="text-zinc-400 text-xs truncate mb-1">{user.email}</p>
                      {upgradeStatus?.proExpiresAt ? (
                        tier === "pro" ? (
                          <p className="text-zinc-500 text-[11px]">
                            {upgradeStatus.cancelledAt ? "Expires" : "Renews"}{" "}
                            <span className="text-zinc-300 font-medium">
                              {new Date(upgradeStatus.proExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          </p>
                        ) : (
                          <>
                            <p className="text-zinc-500 text-[11px]">
                              Expired{" "}
                              <span className="text-zinc-300 font-medium">
                                {new Date(upgradeStatus.proExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            </p>
                            <a
                              href="/subscription"
                              onClick={() => setShowProPopover(false)}
                              className="mt-2 block text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                            >
                              Renew Pro →
                            </a>
                          </>
                        )
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            )}
            <a href="/profile"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 transition-colors text-xs font-semibold"
              title="Profile Settings">
              <UserCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Profile</span>
            </a>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-400/30 transition-colors text-xs font-semibold">
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {paystackMode === "test" && (
        <div className="bg-yellow-400 text-black text-center text-xs font-bold py-2 px-4 tracking-wide flex items-center justify-center gap-3">
          <span>TEST MODE — No real payments will be processed</span>
          <button
            onClick={() => toggleModeMutation.mutate("live")}
            disabled={toggleModeMutation.isPending}
            className="bg-black/20 hover:bg-black/30 text-black px-2.5 py-0.5 rounded text-xs font-bold transition-colors disabled:opacity-50"
          >
            Switch to Live
          </button>
        </div>
      )}
      {paystackMode === "live" && (
        <div className="bg-green-500/10 border-b border-green-500/20 text-green-400 text-center text-xs font-bold py-1.5 px-4 tracking-wide flex items-center justify-center gap-3">
          <span>LIVE MODE — Real payments are active</span>
          <button
            onClick={() => toggleModeMutation.mutate("test")}
            disabled={toggleModeMutation.isPending}
            className="bg-green-500/20 hover:bg-green-500/30 text-green-300 px-2.5 py-0.5 rounded text-xs font-bold transition-colors disabled:opacity-50"
          >
            Switch to Test
          </button>
        </div>
      )}

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

        {/* Branding */}
        <BrandingSection tier={tier} />

        {/* Live subaccount missing — warn organizer */}
        {paystackMode === "live" && organizerInfo !== null && !organizerInfo.hasLiveSubaccount && (
          <div className="flex items-center gap-4 rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-4 mb-6">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Your payment account is not set up</p>
              <p className="text-zinc-500 text-xs mt-0.5">You cannot receive payments until you complete setup. Enter your bank details below to create your live payment account.</p>
            </div>
            <button
              onClick={() => document.getElementById("bank-account-section")?.scrollIntoView({ behavior: "smooth", block: "center" })}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition-colors"
            >
              <Wallet className="w-3.5 h-3.5" /> Complete Payment Setup
            </button>
          </div>
        )}

        {/* Bank account */}
        <div id="bank-account-section">
          <EditBankAccountSection />
        </div>

        {/* Flutterwave payment gateway */}
        <FlutterwaveSection tier={tier} />

        {/* Test payment account setup */}
        {paystackMode === "test" && !organizerInfo?.hasTestSubaccount && (
          <div className="flex items-center gap-4 rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-5 py-4 mb-6">
            <div className="p-2 rounded-lg bg-yellow-400/10 border border-yellow-400/20 flex-shrink-0">
              <Wallet className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Test payment account required</p>
              <p className="text-zinc-500 text-xs mt-0.5">Your live subaccount doesn't work in test mode. Create a separate test subaccount to process test payments.</p>
            </div>
            <button
              onClick={() => setupTestSubaccountMutation.mutate()}
              disabled={setupTestSubaccountMutation.isPending}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold transition-colors disabled:opacity-50"
            >
              {setupTestSubaccountMutation.isPending
                ? <><span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Setting up...</>
                : <><Wallet className="w-3.5 h-3.5" /> Set up test payment account</>
              }
            </button>
          </div>
        )}
        {paystackMode === "test" && organizerInfo?.hasTestSubaccount && (
          <div className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/5 px-5 py-3 mb-6">
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
            <p className="text-zinc-400 text-xs">Test payment account active · <span className="font-mono text-green-400">{organizerInfo.testSubaccountCode}</span></p>
          </div>
        )}

        {/* Pending bank transfers — Pro only */}
        <PendingTransfersSection tier={tier} />

        {/* Pro upgrade banner — free tier only */}
        {tier === "free" && (
          <div className="flex items-center gap-4 rounded-xl border border-violet-500/20 bg-violet-500/5 px-5 py-4 mb-6">
            <div className="p-2 rounded-lg bg-violet-400/10 border border-violet-400/20 flex-shrink-0">
              <Zap className="w-4 h-4 text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Upgrade to Pro</p>
              <p className="text-zinc-500 text-xs mt-0.5">0% platform fee · Unlimited events & tickets · All payment methods</p>
            </div>
            <a href="/pricing"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 text-white text-xs font-bold transition-colors">
              <Zap className="w-3.5 h-3.5" /> From ₦12k/mo
            </a>
          </div>
        )}

        {/* Cancel subscription confirmation modal */}
        {showCancelSubModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <h3 className="text-white font-semibold text-base">Manage Pro subscription</h3>
                </div>
                <button onClick={() => { setShowCancelSubModal(false); setCancelReason(""); }} className="text-zinc-500 hover:text-white transition-colors ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Pause option */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <PauseCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <p className="text-white font-semibold text-sm">Pause renewal</p>
                </div>
                <p className="text-zinc-400 text-xs mb-3">
                  Keep Pro until your current billing period ends, then stop. No immediate loss of features — you can reinstate anytime before it expires.
                </p>
                <button
                  onClick={() => pauseSubMutation.mutate()}
                  disabled={pauseSubMutation.isPending || cancelSubMutation.isPending}
                  className="w-full px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {pauseSubMutation.isPending
                    ? <><span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Pausing...</>
                    : <><PauseCircle className="w-3.5 h-3.5" /> Pause renewal</>
                  }
                </button>
              </div>

              {/* Cancel immediately option */}
              <div className="rounded-xl border border-red-800/30 bg-red-900/10 p-4 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-white font-semibold text-sm">Cancel immediately</p>
                </div>
                <p className="text-zinc-400 text-xs mb-3">
                  Your plan is downgraded to Free right now. You'll lose access to 0% platform fee, unlimited events, and all Pro features immediately.
                </p>
                <div className="mb-3">
                  <p className="text-zinc-500 text-xs uppercase tracking-widest mb-2">Why are you cancelling? <span className="normal-case text-zinc-600">(optional)</span></p>
                  <div className="flex flex-col gap-1.5">
                    {["Too expensive", "Not using it enough", "Missing features", "Switching to another tool", "Other"].map((reason) => (
                      <label key={reason} className="flex items-center gap-2.5 cursor-pointer group">
                        <input
                          type="radio"
                          name="cancelReason"
                          value={reason}
                          checked={cancelReason === reason}
                          onChange={() => setCancelReason(reason)}
                          className="accent-red-500"
                        />
                        <span className={`text-sm transition-colors ${cancelReason === reason ? "text-white" : "text-zinc-400 group-hover:text-zinc-300"}`}>{reason}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => cancelSubMutation.mutate()}
                  disabled={cancelSubMutation.isPending || pauseSubMutation.isPending}
                  className="w-full px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {cancelSubMutation.isPending
                    ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Cancelling...</>
                    : "Cancel immediately"
                  }
                </button>
              </div>

              <button
                onClick={() => { setShowCancelSubModal(false); setCancelReason(""); }}
                disabled={cancelSubMutation.isPending || pauseSubMutation.isPending}
                className="w-full px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Keep Pro
              </button>
            </div>
          </div>
        )}

        {/* Pro subscription management — Pro tier only */}
        {tier === "pro" && (
          <div className="mb-6 space-y-3">
            <div className={`flex items-center gap-4 rounded-xl border px-5 py-4 ${upgradeStatus?.cancelledAt ? "border-amber-500/20 bg-amber-500/5" : "border-violet-500/20 bg-violet-500/5"}`}>
              <div className={`p-2 rounded-lg border flex-shrink-0 ${upgradeStatus?.cancelledAt ? "bg-amber-400/10 border-amber-400/20" : "bg-violet-400/10 border-violet-400/20"}`}>
                {upgradeStatus?.cancelledAt
                  ? <PauseCircle className="w-4 h-4 text-amber-400" />
                  : <Crown className="w-4 h-4 text-violet-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                {upgradeStatus?.cancelledAt ? (
                  <>
                    <p className="text-white font-semibold text-sm">Pro · renewal paused</p>
                    {upgradeStatus.proExpiresAt && (
                      <p className="text-amber-400/80 text-xs mt-0.5">
                        Expires {new Date(upgradeStatus.proExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-white font-semibold text-sm">Pro Plan Active</p>
                    {upgradeStatus?.proExpiresAt ? (
                      <p className="text-zinc-500 text-xs mt-0.5">
                        Renews on {new Date(upgradeStatus.proExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    ) : (
                      <p className="text-zinc-500 text-xs mt-0.5">0% platform fee · Unlimited events & tickets</p>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {upgradeStatus?.cancelledAt ? (
                  <button
                    onClick={() => reinstateSubMutation.mutate()}
                    disabled={reinstateSubMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-400 hover:text-amber-300 hover:border-amber-400 text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {reinstateSubMutation.isPending
                      ? <><span className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" /> Reinstating...</>
                      : <><RefreshCw className="w-3 h-3" /> Reinstate</>
                    }
                  </button>
                ) : (
                  <>
                    <a
                      href="/subscription"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-xs font-semibold transition-colors">
                      <Settings className="w-3 h-3" /> Manage
                    </a>
                    <button
                      onClick={() => setShowCancelSubModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-800/50 text-red-400 hover:text-red-300 hover:border-red-700 text-xs font-semibold transition-colors">
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Payment history */}
            {paymentHistory && paymentHistory.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest">Payment History</p>
                </div>
                <div className="divide-y divide-zinc-800/60">
                  {paymentHistory.map((item) => (
                    <div key={item.reference} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-zinc-200 text-xs font-medium">
                            Pro {item.plan === "yearly" ? "Yearly" : "Monthly"}
                          </p>
                          <p className="text-zinc-600 text-xs">
                            {new Date(item.fulfilledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className="text-zinc-300 text-xs font-semibold">
                          {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(item.amountKobo / 100)}
                        </p>
                        <button
                          onClick={() => {
                            setDownloadingRef(item.reference);
                            const token = getToken();
                            const url = `/api/upgrade/receipt/${encodeURIComponent(item.reference)}`;
                            fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
                              .then((r) => { if (!r.ok) throw new Error("Failed"); return r.blob(); })
                              .then((blob) => {
                                const blobUrl = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = blobUrl;
                                a.download = `receipt-${item.reference.slice(-8)}.pdf`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
                              })
                              .catch(() => toast({ title: "Download failed", description: "Could not generate receipt", variant: "destructive" }))
                              .finally(() => setDownloadingRef(null));
                          }}
                          disabled={downloadingRef === item.reference}
                          title="Download receipt"
                          className="p-1 rounded-md border border-zinc-700 text-zinc-500 hover:text-zinc-200 hover:border-zinc-500 transition-colors disabled:opacity-40"
                        >
                          {downloadingRef === item.reference
                            ? <RefreshCw className="w-3 h-3 animate-spin" />
                            : <Download className="w-3 h-3" />
                          }
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tier limit warning */}
        {tier === "free" && atEventLimit && !showNewEventForm && (
          <div className="flex items-center gap-3 bg-amber-400/5 border border-amber-400/15 rounded-xl p-4 mb-6">
            <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-zinc-400 text-sm flex-1">
              You've reached the <strong className="text-zinc-200">Free plan limit</strong> of 1 active event.
              Deactivate it to create a new one, or upgrade to Pro for unlimited events.
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
