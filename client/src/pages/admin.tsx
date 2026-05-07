import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Settings, Image, Palette, Ticket, CreditCard, Plus, Trash2,
  Eye, EyeOff, ChevronDown, ChevronUp, Save, ExternalLink, Info,
  CheckCircle, Globe
} from "lucide-react";
import type { EventConfig, TicketTier } from "@shared/schema";

const formSchema = z.object({
  eventName: z.string().min(1, "Event name is required"),
  eventTheme: z.string(),
  eventDate: z.string().min(1, "Event date is required"),
  eventTime: z.string().min(1, "Event time is required"),
  eventVenue: z.string().min(1, "Venue is required"),
  eventDescription: z.string(),
  contactEmail: z.string().email("Enter a valid email").or(z.literal("")),
  contactPhone: z.string(),
  totalTickets: z.coerce.number().min(1, "Must have at least 1 ticket"),
  primaryColor: z.string(),
  highlightColor: z.string(),
  accentColor: z.string(),
  bgColor: z.string(),
  paystackPublicKey: z.string(),
  paystackSecretKey: z.string(),
  isPublished: z.boolean(),
});
type FormValues = z.infer<typeof formSchema>;

function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="p-2 rounded-lg bg-white/5 border border-white/10 mt-0.5">
        <Icon className="w-4 h-4 text-amber-400" />
      </div>
      <div>
        <h2 className="text-white font-bold text-base">{title}</h2>
        {subtitle && <p className="text-zinc-500 text-xs mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-zinc-400 text-xs uppercase tracking-widest font-semibold">{label}</label>
      <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0" />
        <span className="text-zinc-300 text-sm font-mono uppercase">{value}</span>
      </div>
    </div>
  );
}

function TierEditor({ tier, index, onChange, onRemove }: {
  tier: TicketTier;
  index: number;
  onChange: (t: TicketTier) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const [perkInput, setPerkInput] = useState("");

  function update(partial: Partial<TicketTier>) {
    onChange({ ...tier, ...partial });
  }

  function addPerk() {
    const trimmed = perkInput.trim();
    if (!trimmed) return;
    update({ perks: [...tier.perks, trimmed] });
    setPerkInput("");
  }

  function removePerk(i: number) {
    update({ perks: tier.perks.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="border border-zinc-700 rounded-xl overflow-hidden bg-zinc-900/50">
      <button type="button" onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors">
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${tier.isVip ? "bg-amber-400" : "bg-zinc-500"}`} />
          <span className="text-white font-semibold text-sm">{tier.name || `Tier ${index + 1}`}</span>
          <span className="text-zinc-500 text-xs">
            {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(tier.price)}
          </span>
          {tier.isVip && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">VIP</span>}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-zinc-700 pt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-widest font-semibold block mb-1.5">Tier Name *</label>
              <Input value={tier.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Regular"
                className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-600 focus:border-amber-400 h-10" />
            </div>
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-widest font-semibold block mb-1.5">Price (₦) *</label>
              <Input type="number" value={tier.price} onChange={(e) => update({ price: Number(e.target.value) })} placeholder="5000"
                className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-600 focus:border-amber-400 h-10" />
            </div>
          </div>

          <div>
            <label className="text-zinc-400 text-xs uppercase tracking-widest font-semibold block mb-1.5">Short Description</label>
            <Input value={tier.description} onChange={(e) => update({ description: e.target.value })} placeholder="What does this ticket include?"
              className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-600 focus:border-amber-400 h-10" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-widest font-semibold block mb-1.5">Tickets Included</label>
              <Input type="number" min={1} value={tier.ticketsIncluded} onChange={(e) => update({ ticketsIncluded: Math.max(1, Number(e.target.value)) })}
                className="bg-zinc-800 border-zinc-600 text-white focus:border-amber-400 h-10" />
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <label className="text-zinc-400 text-xs uppercase tracking-widest font-semibold">Options</label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={tier.isVip} onChange={(e) => update({ isVip: e.target.checked })}
                    className="w-4 h-4 accent-amber-400 rounded" />
                  <span className="text-zinc-300 text-sm">Mark as VIP / Premium tier</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={tier.allowQuantity} onChange={(e) => update({ allowQuantity: e.target.checked })}
                    className="w-4 h-4 accent-amber-400 rounded" />
                  <span className="text-zinc-300 text-sm">Allow buyers to choose quantity</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="text-zinc-400 text-xs uppercase tracking-widest font-semibold block mb-2">Perks / Inclusions</label>
            <ul className="space-y-1.5 mb-3">
              {tier.perks.map((perk, i) => (
                <li key={i} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                  <span className="text-amber-400 text-xs">✦</span>
                  <span className="text-zinc-300 text-sm flex-1">{perk}</span>
                  <button type="button" onClick={() => removePerk(i)} className="text-zinc-600 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input value={perkInput} onChange={(e) => setPerkInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPerk(); } }}
                placeholder="e.g. Full concert access"
                className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-600 focus:border-amber-400 h-9 text-sm" />
              <button type="button" onClick={addPerk}
                className="px-3 py-2 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-400 hover:bg-amber-400/20 transition-colors text-sm font-semibold whitespace-nowrap">
                + Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [primaryColor, setPrimaryColor] = useState("#F59E0B");
  const [highlightColor, setHighlightColor] = useState("#FDE68A");
  const [accentColor, setAccentColor] = useState("#D97706");
  const [bgColor, setBgColor] = useState("#0d0d0d");
  const [showSecret, setShowSecret] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { isLoading } = useQuery<EventConfig>({
    queryKey: ["/api/config/admin"],
    queryFn: async () => {
      const res = await fetch("/api/config/admin");
      return res.json();
    },
    onSuccess: (data: EventConfig) => {
      if (loaded) return;
      form.reset({
        eventName: data.eventName,
        eventTheme: data.eventTheme,
        eventDate: data.eventDate?.split("T")[0] || "",
        eventTime: data.eventTime,
        eventVenue: data.eventVenue,
        eventDescription: data.eventDescription,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        totalTickets: data.totalTickets,
        primaryColor: data.primaryColor,
        highlightColor: data.highlightColor,
        accentColor: data.accentColor,
        bgColor: data.bgColor,
        paystackPublicKey: data.paystackPublicKey,
        paystackSecretKey: data.paystackSecretKey,
        isPublished: data.isPublished,
      });
      setPrimaryColor(data.primaryColor);
      setHighlightColor(data.highlightColor);
      setAccentColor(data.accentColor);
      setBgColor(data.bgColor);
      setLogoDataUrl(data.logoDataUrl);
      setTiers(data.ticketTiers || []);
      setLoaded(true);
    },
  } as any);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      eventName: "", eventTheme: "", eventDate: "", eventTime: "",
      eventVenue: "", eventDescription: "", contactEmail: "",
      contactPhone: "", totalTickets: 200, primaryColor: "#F59E0B",
      highlightColor: "#FDE68A", accentColor: "#D97706", bgColor: "#0d0d0d",
      paystackPublicKey: "", paystackSecretKey: "", isPublished: false,
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues & { publish: boolean }) => {
      const { publish, ...rest } = values;
      const dateStr = rest.eventDate.includes("T") ? rest.eventDate : `${rest.eventDate}T${timeToISO(rest.eventTime)}`;
      const payload: EventConfig = {
        ...rest,
        eventDate: dateStr,
        primaryColor,
        highlightColor,
        accentColor,
        bgColor,
        logoDataUrl,
        ticketTiers: tiers,
        isPublished: publish,
      };
      const res = await apiRequest("POST", "/api/config", payload);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to save");
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/config"] });
      qc.invalidateQueries({ queryKey: ["/api/config/admin"] });
      toast({
        title: vars.publish ? "Event published!" : "Changes saved",
        description: vars.publish ? "Your event page is now live." : "All settings have been saved.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  function timeToISO(time: string) {
    const match = time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return "18:00:00";
    let h = parseInt(match[1]);
    const m = match[2];
    const ampm = match[3]?.toUpperCase();
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m}:00`;
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Logo too large", description: "Please use an image under 2MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setLogoDataUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function addTier() {
    const newTier: TicketTier = {
      id: `tier-${Date.now()}`,
      name: "New Tier",
      price: 5000,
      description: "",
      perks: [],
      isVip: false,
      allowQuantity: true,
      ticketsIncluded: 1,
    };
    setTiers((prev) => [...prev, newTier]);
  }

  function onSubmit(values: FormValues, publish: boolean) {
    if (tiers.length === 0) {
      toast({ title: "Add at least one ticket tier", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ ...values, publish });
  }

  if (isLoading && !loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0d0d0d" }}>
        <div className="flex items-center gap-3 text-zinc-500">
          <div className="w-5 h-5 border-2 border-zinc-700 border-t-amber-400 rounded-full animate-spin" />
          Loading your setup...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a0a", color: "#f5f5f5" }}>
      {/* Top bar */}
      <div className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
              <Settings className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm">Event Setup</h1>
              <p className="text-zinc-600 text-xs">Configure your event ticketing page</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" target="_blank" rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors text-xs font-semibold">
              <ExternalLink className="w-3.5 h-3.5" /> Preview
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <Form {...form}>
          <form className="space-y-6">

            {/* Branding */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <SectionHeader icon={Image} title="Branding" subtitle="Your logo and event colour scheme" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Logo upload */}
                <div>
                  <label className="text-zinc-400 text-xs uppercase tracking-widest font-semibold block mb-3">Event Logo</label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-zinc-700 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-amber-400/50 transition-colors min-h-[120px]">
                    {logoDataUrl ? (
                      <img src={logoDataUrl} alt="Logo preview" className="max-h-24 max-w-full object-contain" />
                    ) : (
                      <div className="text-center">
                        <Image className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                        <p className="text-zinc-500 text-sm">Click to upload logo</p>
                        <p className="text-zinc-700 text-xs mt-1">PNG or SVG recommended · Max 2MB</p>
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </div>
                  {logoDataUrl && (
                    <button type="button" onClick={() => setLogoDataUrl(null)}
                      className="mt-2 text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
                      <Trash2 className="w-3 h-3" /> Remove logo
                    </button>
                  )}
                </div>

                {/* Colors */}
                <div className="space-y-3">
                  <ColorField label="Primary Color" value={primaryColor} onChange={setPrimaryColor} />
                  <ColorField label="Highlight Color" value={highlightColor} onChange={setHighlightColor} />
                  <ColorField label="Accent Color" value={accentColor} onChange={setAccentColor} />
                  <ColorField label="Background Color" value={bgColor} onChange={setBgColor} />
                </div>
              </div>
            </div>

            {/* Event Details */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <SectionHeader icon={Globe} title="Event Details" subtitle="Name, date, location and description" />

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="eventName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Event Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Lagos Music Festival"
                          className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-600 focus:border-amber-400 h-10" />
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="eventTheme" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Theme / Subtitle <span className="normal-case text-zinc-600">(optional)</span></FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. An Evening of Jazz"
                          className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-600 focus:border-amber-400 h-10" />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="eventDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Event Date *</FormLabel>
                      <FormControl>
                        <Input {...field} type="date"
                          className="bg-zinc-800 border-zinc-600 text-white focus:border-amber-400 h-10" />
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="eventTime" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Event Time *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. 4:00 PM"
                          className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-600 focus:border-amber-400 h-10" />
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="eventVenue" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Venue *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Eko Hotel & Suites, Lagos"
                        className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-600 focus:border-amber-400 h-10" />
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="eventDescription" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Description <span className="normal-case text-zinc-600">(optional)</span></FormLabel>
                    <FormControl>
                      <textarea {...field} rows={3} placeholder="Tell attendees what to expect..."
                        className="w-full bg-zinc-800 border border-zinc-600 text-white placeholder:text-zinc-600 focus:border-amber-400 rounded-md px-3 py-2 text-sm outline-none resize-none transition-colors" />
                    </FormControl>
                  </FormItem>
                )} />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField control={form.control} name="totalTickets" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Total Tickets *</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min={1}
                          className="bg-zinc-800 border-zinc-600 text-white focus:border-amber-400 h-10" />
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="contactEmail" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Contact Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="hello@event.com"
                          className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-600 focus:border-amber-400 h-10" />
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="contactPhone" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Contact Phone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+234 xxx xxx xxxx"
                          className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-600 focus:border-amber-400 h-10" />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
              </div>
            </div>

            {/* Ticket Tiers */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <SectionHeader icon={Ticket} title="Ticket Tiers" subtitle="Create the ticket types for your event" />

              {tiers.length === 0 && (
                <div className="border border-dashed border-zinc-700 rounded-xl p-8 text-center mb-4">
                  <Ticket className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-zinc-500 text-sm">No ticket tiers yet</p>
                  <p className="text-zinc-700 text-xs mt-1">Add at least one tier to publish your event</p>
                </div>
              )}

              <div className="space-y-3 mb-4">
                {tiers.map((tier, i) => (
                  <TierEditor
                    key={tier.id}
                    tier={tier}
                    index={i}
                    onChange={(updated) => setTiers((prev) => prev.map((t, idx) => idx === i ? updated : t))}
                    onRemove={() => setTiers((prev) => prev.filter((_, idx) => idx !== i))}
                  />
                ))}
              </div>

              <button type="button" onClick={addTier}
                className="w-full py-3 rounded-xl border-2 border-dashed border-zinc-700 text-zinc-400 hover:border-amber-400/40 hover:text-amber-400 transition-colors flex items-center justify-center gap-2 text-sm font-semibold">
                <Plus className="w-4 h-4" /> Add Ticket Tier
              </button>
            </div>

            {/* Payment */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <SectionHeader icon={CreditCard} title="Payment (Paystack)" subtitle="Connect your Paystack account to collect payments" />

              <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 flex gap-3 mb-5">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-blue-300 text-sm font-semibold">Using your live Paystack keys</p>
                  <p className="text-zinc-500 text-xs mt-1">
                    Enter your <strong className="text-zinc-400">Live Public Key</strong> (starts with <code className="text-blue-300">pk_live_</code>) and
                    your <strong className="text-zinc-400">Live Secret Key</strong> (starts with <code className="text-blue-300">sk_live_</code>).
                    Find these in your <a href="https://dashboard.paystack.com/#/settings/developer" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Paystack dashboard</a>.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <FormField control={form.control} name="paystackPublicKey" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Paystack Public Key</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="pk_live_xxxxxxxxxxxxxxxxxxxxxxxx"
                        className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-600 focus:border-amber-400 h-10 font-mono text-sm" />
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="paystackSecretKey" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Paystack Secret Key</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input {...field} type={showSecret ? "text" : "password"} placeholder="sk_live_xxxxxxxxxxxxxxxxxxxxxxxx"
                          className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-600 focus:border-amber-400 h-10 font-mono text-sm pr-10" />
                        <button type="button" onClick={() => setShowSecret((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                          {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <p className="text-zinc-700 text-xs mt-1">Your secret key is stored securely on the server and never exposed to buyers.</p>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Save actions */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  disabled={saveMutation.isPending}
                  onClick={form.handleSubmit((v) => onSubmit(v, false))}
                  className="flex-1 py-3.5 rounded-xl border border-zinc-600 text-zinc-300 hover:border-zinc-400 hover:text-white transition-colors font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {saveMutation.isPending ? (
                    <><span className="w-4 h-4 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="w-4 h-4" /> Save Draft</>
                  )}
                </button>
                <button
                  type="button"
                  disabled={saveMutation.isPending}
                  onClick={form.handleSubmit((v) => onSubmit(v, true))}
                  className="flex-1 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {saveMutation.isPending ? (
                    <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Publishing...</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" /> Save & Publish</>
                  )}
                </button>
              </div>
              <p className="text-zinc-700 text-xs text-center mt-3">
                "Save & Publish" makes your event page live. "Save Draft" keeps it hidden while you work.
              </p>
            </div>

          </form>
        </Form>
      </div>
    </div>
  );
}
