import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  ShieldCheck, ArrowLeft, Copy, Check, Crown, Users, Ticket,
  DollarSign, Calendar, Ban, CheckCircle, Trash2, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface OrgEventRow {
  id: string;
  title: string;
  date: string;
  location: string;
  status: string;
  isActive: boolean;
  paymentMethod: string;
  maxTickets: number;
  ticketsSold: number;
  revenue: number;
  createdAt: string;
}

interface OrgDetail {
  id: string;
  userId: string;
  email: string;
  businessName: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  subaccountCode: string | null;
  testSubaccountCode: string | null;
  tier: string;
  proExpiresAt: string | null;
  suspended: boolean;
  createdAt: string;
  eventCount: number;
  ticketsSold: number;
  revenue: number;
  events: OrgEventRow[];
  recentPurchases: {
    id: string;
    customerName: string;
    customerEmail: string;
    eventTitle: string;
    quantity: number;
    amount: number;
    status: string;
    createdAt: string;
  }[];
  subscriptionHistory: {
    reference: string;
    plan: string;
    amountKobo: number | null;
    fulfilledAt: string;
  }[];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtNaira(kobo: number) {
  if (!kobo) return "₦0";
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}
function fmtEventDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function CopyField({ label, value }: { label: string; value: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!value) return (
    <div>
      <p className="text-zinc-600 text-xs uppercase tracking-widest mb-1">{label}</p>
      <p className="text-zinc-600 text-sm">—</p>
    </div>
  );
  return (
    <div>
      <p className="text-zinc-600 text-xs uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        <code className="text-zinc-300 text-sm font-mono break-all">{value}</code>
        <button
          onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="text-zinc-600 hover:text-white transition-colors flex-shrink-0"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent = "amber" }: {
  icon: (props: { className?: string }) => JSX.Element; label: string; value: string | number; accent?: string;
}) {
  const colors: Record<string, string> = {
    amber: "text-amber-400 bg-amber-500/10",
    blue: "text-blue-400 bg-blue-500/10",
    green: "text-green-400 bg-green-500/10",
    violet: "text-violet-400 bg-violet-500/10",
  };
  const cls = colors[accent] ?? colors.amber;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cls}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-zinc-500 text-xs uppercase tracking-widest">{label}</p>
        <p className="text-white font-bold text-lg leading-tight">{typeof value === "number" ? value.toLocaleString() : value}</p>
      </div>
    </div>
  );
}

export default function AdminOrganizerDetail() {
  const { id: userId } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "events" | "purchases" | "subscriptions">("overview");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  const { data: me, isLoading: meLoading } = useQuery<{ id: string; email: string; role: string }>({
    queryKey: ["/api/auth/me"],
  });

  const { data: org, isLoading } = useQuery<OrgDetail>({
    queryKey: ["/api/admin/organizers", userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/organizers/${userId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!userId && me?.role === "admin",
  });

  useEffect(() => {
    if (!meLoading && me && me.role !== "admin") navigate("/dashboard");
  }, [meLoading, me, navigate]);

  const tierMutation = useMutation({
    mutationFn: ({ tier, lifetime }: { tier: string; lifetime?: boolean }) =>
      apiRequest("PATCH", `/api/admin/users/${org?.userId}/tier`, { tier, lifetime }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/organizers", userId] });
      qc.invalidateQueries({ queryKey: ["/api/admin/organizers"] });
      toast({ title: "Tier updated" });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const suspendMutation = useMutation({
    mutationFn: (suspended: boolean) =>
      apiRequest("PATCH", `/api/admin/users/${org?.userId}/suspend`, { suspended }),
    onSuccess: (_, suspended) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/organizers", userId] });
      qc.invalidateQueries({ queryKey: ["/api/admin/organizers"] });
      toast({ title: suspended ? "Account suspended" : "Account reinstated" });
      setConfirmSuspend(false);
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/admin/users/${org?.userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/organizers"] });
      toast({ title: "Account deleted" });
      navigate("/admin/organizers");
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  if (meLoading || !me) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (me.role !== "admin") return null;
  if (isLoading || !org) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => navigate("/admin")} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">Admin</button>
                <span className="text-zinc-700">/</span>
                <button onClick={() => navigate("/admin/organizers")} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">Organizers</button>
                <span className="text-zinc-700">/</span>
                <span className="text-white text-sm font-semibold truncate max-w-[160px]">{org.businessName}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1.5">
                  Actions <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700 text-white min-w-[180px]">
                {org.tier === "free" ? (
                  <>
                    <DropdownMenuItem className="gap-2 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800"
                      onClick={() => tierMutation.mutate({ tier: "pro", lifetime: true })}>
                      <Crown className="w-3.5 h-3.5 text-amber-400" /> Grant Lifetime Pro
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800"
                      onClick={() => tierMutation.mutate({ tier: "pro", lifetime: false })}>
                      <Crown className="w-3.5 h-3.5 text-amber-400" /> Grant Pro (1 yr)
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem className="gap-2 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800"
                    onClick={() => tierMutation.mutate({ tier: "free" })}>
                    <Users className="w-3.5 h-3.5 text-zinc-400" /> Revoke Pro
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-zinc-800" />
                {org.suspended ? (
                  <DropdownMenuItem className="gap-2 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 text-green-400"
                    onClick={() => suspendMutation.mutate(false)}>
                    <CheckCircle className="w-3.5 h-3.5" /> Unsuspend
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem className="gap-2 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 text-orange-400"
                    onClick={() => setConfirmSuspend(true)}>
                    <Ban className="w-3.5 h-3.5" /> Suspend account
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="gap-2 cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 text-red-400"
                  onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="w-3.5 h-3.5" /> Delete account
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-zinc-800 gap-2"
              onClick={() => navigate("/admin/organizers")}>
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-white">{org.businessName}</h2>
              {org.tier === "pro"
                ? <span className="text-xs font-bold text-amber-400 bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 rounded-full">Pro</span>
                : <span className="text-xs font-bold text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">Free</span>}
              {org.suspended && (
                <span className="text-xs font-bold text-red-400 bg-red-500/15 border border-red-500/25 px-2 py-0.5 rounded-full">Suspended</span>
              )}
            </div>
            <p className="text-zinc-500 text-sm mt-1">{org.email} · Joined {fmtDate(org.createdAt)}</p>
            {org.tier === "pro" && org.proExpiresAt && (
              <p className="text-zinc-600 text-xs mt-0.5">Pro expires {fmtDate(org.proExpiresAt)}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Calendar} label="Events" value={org.eventCount} accent="blue" />
          <StatCard icon={Ticket} label="Tickets Sold" value={org.ticketsSold} accent="amber" />
          <StatCard icon={DollarSign} label="Revenue" value={fmtNaira(org.revenue)} accent="green" />
          <StatCard icon={Users} label="Subscriptions" value={org.subscriptionHistory.length} accent="violet" />
        </div>

        <div>
          <div className="flex gap-1 border-b border-zinc-800 mb-6">
            {(["overview", "events", "purchases", "subscriptions"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                  tab === t ? "border-amber-400 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}>
                {t}
                {t === "events" && <span className="ml-1.5 text-zinc-600 text-xs">({org.events.length})</span>}
                {t === "purchases" && <span className="ml-1.5 text-zinc-600 text-xs">({org.recentPurchases.length})</span>}
                {t === "subscriptions" && <span className="ml-1.5 text-zinc-600 text-xs">({org.subscriptionHistory.length})</span>}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                <p className="text-zinc-400 text-xs uppercase tracking-widest font-medium">Business Info</p>
                <CopyField label="Business Name" value={org.businessName} />
                <CopyField label="Email" value={org.email} />
                <CopyField label="User ID" value={org.userId} />
                <CopyField label="Organizer ID" value={org.id} />
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                <p className="text-zinc-400 text-xs uppercase tracking-widest font-medium">Payment Details</p>
                <CopyField label="Bank" value={org.bankName} />
                <CopyField label="Account Number" value={org.accountNumber} />
                <CopyField label="Live Subaccount Code" value={org.subaccountCode} />
                <CopyField label="Test Subaccount Code" value={org.testSubaccountCode} />
              </div>
            </div>
          )}

          {tab === "events" && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      {["Event", "Date", "Status", "Tickets", "Revenue", "Payment", "Created"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-zinc-500 text-xs uppercase tracking-widest font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {org.events.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-10 text-center text-zinc-600">No events yet.</td></tr>
                    )}
                    {org.events.map(ev => (
                      <tr key={ev.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-white font-medium text-sm truncate max-w-[180px]">{ev.title}</p>
                          <p className="text-zinc-600 text-xs truncate max-w-[180px]">{ev.location}</p>
                        </td>
                        <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{fmtEventDate(ev.date)}</td>
                        <td className="px-4 py-3">
                          {ev.isActive
                            ? <span className="text-[10px] font-bold text-green-400 bg-green-500/15 px-1.5 py-0.5 rounded-full">Active</span>
                            : <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full">Inactive</span>}
                        </td>
                        <td className="px-4 py-3 text-zinc-400 text-sm">
                          <span className="text-white">{ev.ticketsSold}</span>
                          <span className="text-zinc-600">/{ev.maxTickets}</span>
                        </td>
                        <td className="px-4 py-3 text-zinc-400 text-sm">{fmtNaira(ev.revenue)}</td>
                        <td className="px-4 py-3 text-zinc-500 text-xs capitalize">{ev.paymentMethod.replace("_", " ")}</td>
                        <td className="px-4 py-3 text-zinc-600 text-xs whitespace-nowrap">{fmtDate(ev.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "purchases" && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      {["Customer", "Event", "Qty", "Amount", "Status", "Date"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-zinc-500 text-xs uppercase tracking-widest font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {org.recentPurchases.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-600">No purchases yet.</td></tr>
                    )}
                    {org.recentPurchases.map(p => (
                      <tr key={p.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-white text-sm font-medium truncate max-w-[160px]">{p.customerName}</p>
                          <p className="text-zinc-500 text-xs truncate max-w-[160px]">{p.customerEmail}</p>
                        </td>
                        <td className="px-4 py-3 text-zinc-400 text-xs truncate max-w-[160px]">{p.eventTitle}</td>
                        <td className="px-4 py-3 text-zinc-400 text-sm">{p.quantity}</td>
                        <td className="px-4 py-3 text-zinc-400 text-sm">{fmtNaira(p.amount)}</td>
                        <td className="px-4 py-3">
                          {p.status === "confirmed"
                            ? <span className="text-[10px] font-bold text-green-400 bg-green-500/15 px-1.5 py-0.5 rounded-full">Confirmed</span>
                            : <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full capitalize">{p.status}</span>}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 text-xs whitespace-nowrap">{fmtDateTime(p.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {org.recentPurchases.length === 50 && (
                <p className="text-zinc-600 text-xs px-4 py-2.5 border-t border-zinc-800">Showing latest 50 purchases</p>
              )}
            </div>
          )}

          {tab === "subscriptions" && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      {["Reference", "Plan", "Amount", "Date"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-zinc-500 text-xs uppercase tracking-widest font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {org.subscriptionHistory.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-10 text-center text-zinc-600">No subscription history.</td></tr>
                    )}
                    {org.subscriptionHistory.map(s => (
                      <tr key={s.reference} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <code className="text-zinc-400 text-xs font-mono truncate max-w-[180px] block">{s.reference}</code>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-amber-400 text-xs font-semibold capitalize">{s.plan}</span>
                        </td>
                        <td className="px-4 py-3 text-zinc-400 text-sm">
                          {s.amountKobo != null ? fmtNaira(s.amountKobo) : <span className="text-zinc-700">—</span>}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 text-xs whitespace-nowrap">{fmtDateTime(s.fulfilledAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={confirmSuspend} onOpenChange={v => { if (!v) setConfirmSuspend(false); }}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Suspend {org.businessName}?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This will immediately block <strong className="text-white">{org.email}</strong> from logging in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => suspendMutation.mutate(true)}>
              Suspend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={v => { if (!v) setConfirmDelete(false); }}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete {org.businessName}?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This permanently deletes the account and all events for <strong className="text-white">{org.email}</strong>. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteMutation.mutate()}>
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
