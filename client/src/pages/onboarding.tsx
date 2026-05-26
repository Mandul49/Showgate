import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ShowgateLogo } from "@/components/showgate-logo";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { isAuthenticated, getUser, authHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  Building2, Landmark, Hash, ShieldCheck, CheckCircle2,
  ArrowRight, Ticket, ChevronDown, Loader2, BadgeCheck, AlertCircle
} from "lucide-react";

interface PaystackBank {
  id: number;
  name: string;
  code: string;
  longcode: string;
  slug: string;
}

const formSchema = z.object({
  businessName: z.string().min(2, "Business name must be at least 2 characters"),
  bankCode: z.string().min(1, "Please select your bank"),
  bankName: z.string(),
  accountNumber: z.string().regex(/^\d{10}$/, "Must be exactly 10 digits"),
  bvn: z.string().regex(/^\d{11}$/, "BVN must be 11 digits").or(z.literal("")).optional(),
});
type FormValues = z.infer<typeof formSchema>;

interface OrganizerResult {
  id: string;
  businessName: string;
  subaccountCode: string;
  bankName: string;
  accountNumber: string;
  tier: string;
}

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [done, setDone] = useState<OrganizerResult | null>(null);
  const user = getUser();

  useEffect(() => {
    if (!isAuthenticated()) { navigate("/login"); return; }
    const params = new URLSearchParams(window.location.search);
    if (params.get("verified") === "1") {
      toast({ title: "Email verified!", description: "Your account is now active. Let's get you set up." });
    }
  }, []);

  // Fetch bank list
  const { data: banks = [], isLoading: banksLoading, isError: banksError } = useQuery<PaystackBank[]>({
    queryKey: ["/api/onboarding/banks"],
    staleTime: 60 * 60 * 1000,
    retry: 2,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { businessName: "", bankCode: "", bankName: "", accountNumber: "", bvn: "" },
  });

  const setupMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await apiRequest("POST", "/api/onboarding/setup", {
        businessName: values.businessName,
        bankCode: values.bankCode,
        bankName: values.bankName,
        accountNumber: values.accountNumber,
        bvn: values.bvn || undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Setup failed");
      return data.organizer as OrganizerResult;
    },
    onSuccess: (organizer) => {
      setDone(organizer);
    },
    onError: (err: any) => {
      toast({ title: "Setup failed", description: err.message, variant: "destructive" });
    },
  });

  function onSubmit(values: FormValues) {
    setupMutation.mutate(values);
  }

  // ── Confirmation screen ─────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0a0a0a" }}>
        <div className="border-b border-zinc-800 bg-zinc-950 px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
              <Ticket className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-white font-bold text-sm">Showgate<ShowgateLogo size={16} /></span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-lg text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: "#22c55e26", border: "1px solid #22c55e60" }}>
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>

            <h1 className="text-3xl font-black text-white mb-2">You're all set!</h1>
            <p className="text-zinc-500 text-sm mb-8">
              Your Paystack payment account is ready. You can now set up and publish your event.
            </p>

            {/* Details card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-8 text-left">
              <div className="h-0.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 mb-5">
                  <BadgeCheck className="w-5 h-5 text-green-400" />
                  <span className="text-white font-bold">Payment Account Created</span>
                </div>
                {[
                  { label: "Business Name", value: done.businessName },
                  { label: "Bank", value: done.bankName },
                  { label: "Account Number", value: `•••• ${done.accountNumber.slice(-4)}` },
                  { label: "Subaccount Code", value: done.subaccountCode, mono: true },
                  { label: "Plan", value: done.tier.toUpperCase() },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-3 last:border-0 last:pb-0">
                    <span className="text-zinc-500 text-xs uppercase tracking-widest">{label}</span>
                    <span className={`text-white text-sm font-bold ${mono ? "font-mono" : ""}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => navigate("/dashboard")}
              className="w-full py-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black uppercase tracking-widest text-sm transition-colors flex items-center justify-center gap-2">
              <ArrowRight className="w-5 h-5" /> Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Onboarding form ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0a0a0a" }}>
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-950 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
            <Ticket className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-white font-bold text-sm">Showgate<ShowgateLogo size={16} /></span>
          {user && <span className="ml-auto text-zinc-600 text-xs">{user.email}</span>}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Title */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto mb-4">
              <Landmark className="w-7 h-7 text-amber-400" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Set up your payments</h1>
            <p className="text-zinc-500 text-sm mt-1.5 max-w-sm mx-auto">
              Connect your bank account so ticket sales go directly to you via Paystack.
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-3 mb-8">
            {["Account created", "Payment setup", "Publish event"].map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                  i === 0 ? "bg-amber-400/20 border-amber-400/40 text-amber-400" :
                  i === 1 ? "bg-amber-400 border-amber-400 text-black" :
                  "bg-zinc-900 border-zinc-700 text-zinc-600"}`}>
                  {i === 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-xs font-semibold hidden sm:inline ${i === 1 ? "text-white" : "text-zinc-600"}`}>{step}</span>
                {i < 2 && <div className="w-6 h-px bg-zinc-800 hidden sm:block" />}
              </div>
            ))}
          </div>

          {/* Form card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />
            <div className="p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                  {/* Business name */}
                  <FormField control={form.control} name="businessName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Business / Event Name *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                          <Input {...field} placeholder="e.g. Lagos Music Events Ltd"
                            className="pl-10 bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-600 h-11 focus:border-amber-400" />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )} />

                  {/* Bank select */}
                  <FormField control={form.control} name="bankCode" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Settlement Bank *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          {banksLoading
                            ? <div className="w-full bg-zinc-800 border border-zinc-600 rounded-md h-11 flex items-center gap-2 px-3 text-zinc-500 text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" /> Loading banks...
                              </div>
                            : banksError || banks.length === 0
                            ? <div className="w-full bg-zinc-800 border border-red-500/60 rounded-md h-11 flex items-center gap-2 px-3 text-red-400 text-sm">
                                <AlertCircle className="w-4 h-4 shrink-0" /> Failed to load banks — please refresh the page
                              </div>
                            : <>
                                <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none z-10" />
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none z-10" />
                                <select
                                  value={field.value}
                                  onChange={(e) => {
                                    const selected = banks.find(b => b.code === e.target.value);
                                    field.onChange(e.target.value);
                                    form.setValue("bankName", selected?.name || "");
                                  }}
                                  className="w-full appearance-none bg-zinc-800 border border-zinc-600 text-white rounded-md h-11 pl-10 pr-8 text-sm outline-none focus:border-amber-400 transition-colors"
                                >
                                  <option value="">Select your bank</option>
                                  {banks
                                    .filter((bank, index, self) => index === self.findIndex(b => b.id === bank.id))
                                    .map((bank) => (
                                      <option key={bank.id} value={bank.code}>{bank.name}</option>
                                    ))}
                                </select>
                              </>
                          }
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )} />

                  {/* Account number */}
                  <FormField control={form.control} name="accountNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">Account Number *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                          <Input {...field} placeholder="0123456789" maxLength={10}
                            className="pl-10 bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-600 h-11 focus:border-amber-400 font-mono tracking-wider"
                            onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))} />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )} />

                  {/* BVN (optional) */}
                  <FormField control={form.control} name="bvn" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400 text-xs uppercase tracking-widest">
                        BVN <span className="normal-case text-zinc-600 ml-1">(optional · speeds up verification)</span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                          <Input {...field} placeholder="12345678901" maxLength={11}
                            className="pl-10 bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-600 h-11 focus:border-amber-400 font-mono tracking-wider"
                            onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))} />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                      <p className="text-zinc-700 text-xs mt-1.5">Your BVN is only used for identity verification and is never shared.</p>
                    </FormItem>
                  )} />

                  {/* Info notice */}
                  <div className="flex gap-3 bg-amber-400/5 border border-amber-400/15 rounded-lg p-4">
                    <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-zinc-400 text-xs leading-relaxed">
                      A <strong className="text-zinc-300">Paystack subaccount</strong> will be created so ticket sales are settled directly to your bank. A <strong className="text-zinc-300">2.5% platform fee</strong> applies on the Free plan.
                    </p>
                  </div>

                  <button type="submit" disabled={setupMutation.isPending || banksLoading}
                    className="w-full py-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black uppercase tracking-widest text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 mt-2">
                    {setupMutation.isPending
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating payment account...</>
                      : <><ArrowRight className="w-4 h-4" /> Create Payment Account</>
                    }
                  </button>
                </form>
              </Form>
            </div>
          </div>

          <p className="text-center text-zinc-700 text-xs mt-5">
            By continuing you agree to Paystack's{" "}
            <a href="https://paystack.com/terms" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-zinc-300 transition-colors">terms of service</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
