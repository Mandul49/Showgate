import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  ShieldCheck, ArrowLeft, Users, TrendingDown, DollarSign,
  ChevronDown, Crown, Ban, CheckCircle, RotateCcw, ArrowUpCircle, Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminLayout } from "@/components/admin-layout";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface SubRow {
  userId: string;
  email: string;
  businessName: string | null;
  plan: string;
  startedAt: string | null;
  expiresAt: string | null;
  status: "active" | "cancelled" | "expired" | "lifetime";
  totalPaid: number;
  cancelledAt: string | null;
  grantNote: string | null;
}

interface SubStats {
  activeSubscribers: number;
  churnedThisMonth: number;
  revenueThisMonth: number;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}
function fmtNaira(kobo: number) {
  if (!kobo) return "₦0";
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}

function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    monthly:  { label: "Monthly",  cls: "text-blue-400 bg-blue-500/15 border-blue-500/25" },
    yearly:   { label: "Yearly",   cls: "text-violet-400 bg-violet-500/15 border-violet-500/25" },
    lifetime: { label: "Lifetime", cls: "text-amber-400 bg-amber-500/15 border-amber-500/25" },
    granted:  { label: "Granted",  cls: "text-green-400 bg-green-500/15 border-green-500/25" },
  };
  const v = map[plan] ?? { label: plan, cls: "text-zinc-400 bg-zinc-800 border-zinc-700" };
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${v.cls}`}>{v.label}</span>;
}

function StatusBadge({ status }: { status: SubRow["status"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:    { label: "Active",    cls: "text-green-400 bg-green-500/15 border-green-500/25" },
    cancelled: { label: "Cancelled", cls: "text-orange-400 bg-orange-500/15 border-orange-500/25" },
    expired:   { label: "Expired",   cls: "text-red-400 bg-red-500/15 border-red-500/25" },
    lifetime:  { label: "Lifetime",  cls: "text-amber-400 bg-amber-500/15 border-amber-500/25" },
  };
  const v = map[status] ?? map.expired;
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${v.cls}`}>{v.label}</span>;
}

function StatCard({ icon: Icon, label, value, sub, accent = "amber" }: {
  icon: (p: { className?: string }) => JSX.Element;
  label: string; value: string | number; sub?: string; accent?: string;
}) {
  const cols: Record<string, string> = {
    amber: "text-amber-400 bg-amber-500/10",
    blue:  "text-blue-400 bg-blue-500/10",
    red:   "text-red-400 bg-red-500/10",
    green: "text-green-400 bg-green-500/10",
  };
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-5 flex items-center gap-3 sm:gap-4">
      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cols[accent] ?? cols.amber}`}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
      <div>
        <p className="text-zinc-500 text-[10px] sm:text-xs uppercase tracking-widest">{label}</p>
        <p className="text-white font-bold text-base sm:text-xl leading-tight">{typeof value === "number" ? value.toLocaleString() : value}</p>
        {sub && <p className="text-zinc-600 text-[10px] sm:text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AdminSubscriptions() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [confirmCancel, setConfirmCancel] = useState<SubRow | null>(null);
  const [grantModal, setGrantModal] = useState<SubRow | null>(null);
  const [grantNote, setGrantNote] = useState("");

  const { data: me, isLoading: meLoading } = useQuery<{ id: string; role: string }>({
    queryKey: ["/api/auth/me"],
  });

  const { data, isLoading } = useQuery<{ stats: SubStats; subscriptions: SubRow[] }>({
    queryKey: ["/api/admin/subscriptions"],
    enabled: me?.role === "admin",
  });

  useEffect(() => {
    if (!meLoading && me && me.role !== "admin") navigate("/dashboard");
  }, [meLoading, me, navigate]);

  const stats = data?.stats;
  const allSubs = data?.subscriptions ?? [];

  const filtered = useMemo(() => allSubs.filter(s => {
    const mp = planFilter === "all" || s.plan === planFilter;
    const ms = statusFilter === "all" || s.status === statusFilter;
    return mp && ms;
  }), [allSubs, planFilter, statusFilter]);

  const KEY = ["/api/admin/subscriptions"];

  const extendMut = useMutation({
    mutationFn: ({ userId, months }: { userId: string; months: number }) =>
      apiRequest("PATCH", `/api/admin/subscriptions/${userId}/extend`, { months }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast({ title: "Subscription extended" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const cancelMut = useMutation({
    mutationFn: (userId: string) => apiRequest("PATCH", `/api/admin/subscriptions/${userId}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: "Subscription cancelled" });
      setConfirmCancel(null);
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const reinstateMut = useMutation({
    mutationFn: (userId: string) => apiRequest("PATCH", `/api/admin/subscriptions/${userId}/reinstate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast({ title: "Subscription reinstated" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const upgradeMut = useMutation({
    mutationFn: (userId: string) => apiRequest("PATCH", `/api/admin/subscriptions/${userId}/upgrade-yearly`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast({ title: "Upgraded to yearly" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const grantMut = useMutation({
    mutationFn: ({ userId, note }: { userId: string; note: string }) =>
      apiRequest("POST", `/api/admin/subscriptions/${userId}/grant-free`, { note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: "Free Pro granted for 1 year" });
      setGrantModal(null);
      setGrantNote("");
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const isPending = extendMut.isPending || cancelMut.isPending || reinstateMut.isPending || upgradeMut.isPending;

  if (meLoading || !me) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (me.role !== "admin") return null;

  return (
    <AdminLayout>
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-5 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-50">Subscriptions</h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">{allSubs.length} Pro accounts total</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <StatCard icon={Users} label="Active Subscribers" value={stats?.activeSubscribers ?? "—"} accent="blue" />
          <StatCard icon={TrendingDown} label="Churned This Month" value={stats?.churnedThisMonth ?? "—"} accent="red" />
          <StatCard icon={DollarSign} label="Revenue This Month" value={stats ? fmtNaira(stats.revenueThisMonth) : "—"} accent="green" />
        </div>

        <div className="flex flex-wrap gap-3">
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-[150px] bg-zinc-900 border-zinc-700 text-white h-9">
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all">All plans</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
              <SelectItem value="lifetime">Lifetime</SelectItem>
              <SelectItem value="granted">Granted</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] bg-zinc-900 border-zinc-700 text-white h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="lifetime">Lifetime</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {["Organizer", "Plan", "Started", "Expires", "Status", "Amount Paid", ""].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-zinc-500 text-xs uppercase tracking-widest font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-zinc-600">No subscriptions match your filters.</td></tr>
                  )}
                  {filtered.map(s => (
                    <tr key={s.userId} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-white font-medium text-sm truncate max-w-[200px]">
                          {s.businessName ?? s.email}
                        </p>
                        {s.businessName && <p className="text-zinc-500 text-xs truncate max-w-[200px]">{s.email}</p>}
                        {s.grantNote && (
                          <p className="text-green-600 text-xs mt-0.5 truncate max-w-[200px]" title={s.grantNote}>
                            Note: {s.grantNote}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3"><PlanBadge plan={s.plan} /></td>
                      <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">{fmtDate(s.startedAt)}</td>
                      <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                        {s.status === "lifetime" ? <span className="text-amber-500">Never</span> : fmtDate(s.expiresAt)}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3 text-zinc-400 text-sm">{fmtNaira(s.totalPaid)}</td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-zinc-400 hover:text-white hover:bg-zinc-800" disabled={isPending}>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700 text-white min-w-[180px]">
                            <DropdownMenuItem className="gap-2 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 text-xs font-semibold text-zinc-500 pointer-events-none">
                              Extend subscription
                            </DropdownMenuItem>
                            {[1, 3, 6, 12].map(m => (
                              <DropdownMenuItem key={m}
                                className="gap-2 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 pl-5"
                                onClick={() => extendMut.mutate({ userId: s.userId, months: m })}>
                                <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
                                +{m} {m === 1 ? "month" : m === 12 ? "year" : "months"}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator className="bg-zinc-800" />
                            {s.plan !== "yearly" && s.plan !== "lifetime" && (
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 text-violet-400"
                                onClick={() => upgradeMut.mutate(s.userId)}>
                                <ArrowUpCircle className="w-3.5 h-3.5" /> Upgrade to Yearly
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 text-green-400"
                              onClick={() => { setGrantModal(s); setGrantNote(""); }}>
                              <Gift className="w-3.5 h-3.5" /> Grant Free Pro
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-zinc-800" />
                            {s.status === "cancelled" ? (
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 text-green-400"
                                onClick={() => reinstateMut.mutate(s.userId)}>
                                <CheckCircle className="w-3.5 h-3.5" /> Reinstate
                              </DropdownMenuItem>
                            ) : s.status !== "expired" && (
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 text-orange-400"
                                onClick={() => setConfirmCancel(s)}>
                                <Ban className="w-3.5 h-3.5" /> Cancel
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <p className="text-zinc-600 text-xs text-right">{filtered.length} of {allSubs.length} subscriptions</p>
      </main>

      <AlertDialog open={!!confirmCancel} onOpenChange={v => { if (!v) setConfirmCancel(null); }}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Cancel subscription?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              <strong className="text-white">{confirmCancel?.businessName ?? confirmCancel?.email}</strong> will keep Pro access until{" "}
              <strong className="text-white">{fmtDate(confirmCancel?.expiresAt ?? null)}</strong> but will not renew.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">Back</AlertDialogCancel>
            <AlertDialogAction className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => confirmCancel && cancelMut.mutate(confirmCancel.userId)}>
              Cancel subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!grantModal} onOpenChange={v => { if (!v) { setGrantModal(null); setGrantNote(""); } }}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Gift className="w-4 h-4 text-green-400" /> Grant Free Pro
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Grant <strong className="text-white">{grantModal?.businessName ?? grantModal?.email}</strong> complimentary Pro access for 1 year at no charge.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-zinc-400 text-sm">Reason / Note <span className="text-red-400">*</span></Label>
            <Textarea
              value={grantNote}
              onChange={e => setGrantNote(e.target.value)}
              placeholder="e.g. Referral partner, promotional campaign, key account…"
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 resize-none h-24"
              maxLength={500}
            />
            <p className="text-zinc-600 text-xs text-right">{grantNote.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="text-zinc-400 hover:text-white"
              onClick={() => { setGrantModal(null); setGrantNote(""); }}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
              disabled={!grantNote.trim() || grantMut.isPending}
              onClick={() => grantModal && grantMut.mutate({ userId: grantModal.userId, note: grantNote.trim() })}>
              <Crown className="w-4 h-4" />
              {grantMut.isPending ? "Granting…" : "Grant Pro for 1 Year"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
