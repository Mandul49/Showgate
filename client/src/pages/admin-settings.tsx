import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { AdminLayout } from "@/components/admin-layout";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, ArrowLeft, Settings, DollarSign, Crown,
  Users, Wrench, Key, Save, AlertTriangle, CheckCircle,
} from "lucide-react";

export default function AdminSettings() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: me, isLoading: meLoading } = useQuery<{ id: string; role: string }>({
    queryKey: ["/api/auth/me"],
  });

  useEffect(() => {
    if (!meLoading && me?.role !== "admin") navigate("/");
  }, [me, meLoading, navigate]);

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/admin/settings"],
    enabled: me?.role === "admin",
  });

  const { data: envData } = useQuery<{ keys: string[] }>({
    queryKey: ["/api/admin/env-keys"],
    enabled: me?.role === "admin",
  });

  const saveMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      apiRequest("PATCH", `/api/admin/settings/${key}`, { value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      qc.invalidateQueries({ queryKey: ["/api/settings/public"] });
    },
  });

  // Local state for form fields
  const [feePercent, setFeePercent] = useState("");
  const [monthlyPriceNaira, setMonthlyPriceNaira] = useState("");
  const [yearlyPriceNaira, setYearlyPriceNaira] = useState("");
  const [maxMonthlyTickets, setMaxMonthlyTickets] = useState("");
  const [maxActiveEvents, setMaxActiveEvents] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Seed from settings when loaded
  useEffect(() => {
    if (!settings) return;
    setFeePercent(settings.platform_fee_percent ?? "2.5");
    setMonthlyPriceNaira(String(Math.round((parseInt(settings.pro_monthly_price_kobo ?? "1200000", 10)) / 100)));
    setYearlyPriceNaira(String(Math.round((parseInt(settings.pro_yearly_price_kobo ?? "12000000", 10)) / 100)));
    setMaxMonthlyTickets(settings.free_max_monthly_tickets ?? "500");
    setMaxActiveEvents(settings.free_max_active_events ?? "1");
    setMaintenanceMode(settings.maintenance_mode === "true");
  }, [settings]);

  function saveField(key: string, value: string, label: string) {
    saveMutation.mutate({ key, value }, {
      onSuccess: () => toast({ title: `${label} updated` }),
      onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  }

  function handleMaintenanceToggle() {
    const next = !maintenanceMode;
    setMaintenanceMode(next);
    saveMutation.mutate({ key: "maintenance_mode", value: String(next) }, {
      onSuccess: () => toast({ title: next ? "Maintenance mode ON" : "Maintenance mode OFF" }),
      onError: (e: any) => {
        setMaintenanceMode(!next);
        toast({ title: "Error", description: e.message, variant: "destructive" });
      },
    });
  }

  if (meLoading || isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AdminLayout>
      <main className="max-w-3xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-50 flex items-center gap-2">
            <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
            Platform Settings
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">Global configuration for the Showgate platform</p>
        </div>

        {/* Maintenance Mode */}
        <SettingSection
          icon={<Wrench className="w-4 h-4 text-amber-400" />}
          title="Maintenance Mode"
          description="When on, a banner is shown on all public pages. Admin pages are unaffected."
        >
          <div className="flex items-center justify-between py-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {maintenanceMode ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                )}
                <span className="text-sm font-medium text-zinc-200">
                  {maintenanceMode ? "Maintenance mode is ON" : "Platform is live"}
                </span>
              </div>
              <p className="text-xs text-zinc-500 ml-6">
                {maintenanceMode
                  ? "Public pages show a maintenance banner. Ticket purchases may still work."
                  : "All public pages are operating normally."}
              </p>
            </div>
            <button
              onClick={handleMaintenanceToggle}
              disabled={saveMutation.isPending}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                maintenanceMode ? "bg-amber-500" : "bg-zinc-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  maintenanceMode ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </SettingSection>

        {/* Platform Fee */}
        <SettingSection
          icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
          title="Platform Fee"
          description="Percentage of gross ticket revenue Showgate earns on each sale. Used in analytics calculations."
        >
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Fee Percentage</label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={feePercent}
                  onChange={e => setFeePercent(e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-zinc-100 pr-8 h-9 text-sm"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => saveField("platform_fee_percent", feePercent, "Platform fee")}
              disabled={saveMutation.isPending || feePercent === settings?.platform_fee_percent}
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold gap-1.5 h-9"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </Button>
          </div>
          <p className="text-xs text-zinc-600 mt-2">Current: {settings?.platform_fee_percent ?? "2.5"}%</p>
        </SettingSection>

        {/* Pro Pricing */}
        <SettingSection
          icon={<Crown className="w-4 h-4 text-amber-400" />}
          title="Pro Plan Pricing"
          description="Monthly and yearly subscription prices. These are used for display and Paystack payment initialization."
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Monthly price (₦)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">₦</span>
                <Input
                  type="number"
                  min="0"
                  value={monthlyPriceNaira}
                  onChange={e => setMonthlyPriceNaira(e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-zinc-100 pl-7 h-9 text-sm"
                />
              </div>
              <p className="text-[10px] text-zinc-600">
                Current: ₦{Math.round((parseInt(settings?.pro_monthly_price_kobo ?? "1200000", 10)) / 100).toLocaleString("en-NG")}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Yearly price (₦)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">₦</span>
                <Input
                  type="number"
                  min="0"
                  value={yearlyPriceNaira}
                  onChange={e => setYearlyPriceNaira(e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-zinc-100 pl-7 h-9 text-sm"
                />
              </div>
              <p className="text-[10px] text-zinc-600">
                Current: ₦{Math.round((parseInt(settings?.pro_yearly_price_kobo ?? "12000000", 10)) / 100).toLocaleString("en-NG")}
              </p>
            </div>
          </div>
          <div className="flex gap-3 mt-3">
            <Button
              size="sm"
              onClick={() => saveField("pro_monthly_price_kobo", String(Math.round(parseFloat(monthlyPriceNaira) * 100)), "Monthly price")}
              disabled={saveMutation.isPending}
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold gap-1.5 h-9"
            >
              <Save className="w-3.5 h-3.5" />
              Save prices
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                saveMutation.mutate({ key: "pro_monthly_price_kobo", value: String(Math.round(parseFloat(monthlyPriceNaira) * 100)) });
                saveField("pro_yearly_price_kobo", String(Math.round(parseFloat(yearlyPriceNaira) * 100)), "Yearly price");
              }}
              disabled={saveMutation.isPending}
              className="text-zinc-400 hover:text-zinc-100 h-9 text-xs"
            >
              Save both
            </Button>
          </div>
        </SettingSection>

        {/* Free Tier Limits */}
        <SettingSection
          icon={<Users className="w-4 h-4 text-sky-400" />}
          title="Free Tier Limits"
          description="Limits applied to organizers on the free plan. Changes take effect immediately."
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Max tickets / month</label>
              <Input
                type="number"
                min="1"
                value={maxMonthlyTickets}
                onChange={e => setMaxMonthlyTickets(e.target.value)}
                className="bg-zinc-900 border-zinc-700 text-zinc-100 h-9 text-sm"
              />
              <p className="text-[10px] text-zinc-600">Current: {settings?.free_max_monthly_tickets ?? "500"}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Max active events</label>
              <Input
                type="number"
                min="1"
                value={maxActiveEvents}
                onChange={e => setMaxActiveEvents(e.target.value)}
                className="bg-zinc-900 border-zinc-700 text-zinc-100 h-9 text-sm"
              />
              <p className="text-[10px] text-zinc-600">Current: {settings?.free_max_active_events ?? "1"}</p>
            </div>
          </div>
          <div className="flex gap-3 mt-3">
            <Button
              size="sm"
              onClick={() => {
                saveMutation.mutate({ key: "free_max_monthly_tickets", value: maxMonthlyTickets });
                saveField("free_max_active_events", maxActiveEvents, "Free tier limits");
              }}
              disabled={saveMutation.isPending}
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold gap-1.5 h-9"
            >
              <Save className="w-3.5 h-3.5" />
              Save limits
            </Button>
          </div>
        </SettingSection>

        {/* Environment Variables */}
        <SettingSection
          icon={<Key className="w-4 h-4 text-violet-400" />}
          title="Environment Variables"
          description="Names of configured secrets and environment variables. Values are never shown."
        >
          {envData?.keys && envData.keys.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-1">
              {envData.keys.map(k => (
                <span
                  key={k}
                  className="px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-300"
                >
                  {k}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-600">No environment variables detected.</p>
          )}
        </SettingSection>
      </main>
    </AdminLayout>
  );
}

function SettingSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-zinc-200">{title}</span>
        </div>
        <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
      </div>
      <div className="border-t border-zinc-800/60 pt-4">{children}</div>
    </div>
  );
}
