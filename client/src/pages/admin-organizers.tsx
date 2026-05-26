import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  ShieldCheck, ArrowLeft, Search, Copy, Check, ChevronDown,
  Eye, Ban, Trash2, Crown, Users, CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminLayout } from "@/components/admin-layout";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface OrgRow {
  id: string;
  userId: string;
  email: string;
  businessName: string;
  tier: string;
  proExpiresAt: string | null;
  subaccountCode: string | null;
  eventCount: number;
  activeEventCount: number;
  ticketsSold: number;
  revenue: number;
  suspended: boolean;
  createdAt: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}
function fmtNaira(kobo: number) {
  if (!kobo) return "₦0";
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}

function TierBadge({ tier }: { tier: string }) {
  return tier === "pro"
    ? <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.5 rounded-full">Pro</span>
    : <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded-full">Free</span>;
}

function MaskedCode({ code }: { code: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!code) return <span className="text-zinc-700 text-xs">—</span>;
  const masked = code.length > 12 ? code.slice(0, 6) + "•••" + code.slice(-4) : code;
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center gap-1.5">
      <code className="text-zinc-400 text-xs font-mono">{masked}</code>
      <button onClick={handleCopy} className="text-zinc-600 hover:text-white transition-colors flex-shrink-0">
        {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}

export default function AdminOrganizers() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [confirmDelete, setConfirmDelete] = useState<OrgRow | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<OrgRow | null>(null);

  const { data: me, isLoading: meLoading } = useQuery<{ id: string; email: string; role: string }>({
    queryKey: ["/api/auth/me"],
  });

  const { data = [], isLoading } = useQuery<OrgRow[]>({
    queryKey: ["/api/admin/organizers"],
    enabled: me?.role === "admin",
  });

  useEffect(() => {
    if (!meLoading && me && me.role !== "admin") navigate("/dashboard");
  }, [meLoading, me, navigate]);

  const tierMutation = useMutation({
    mutationFn: ({ userId, tier, lifetime }: { userId: string; tier: string; lifetime?: boolean }) =>
      apiRequest("PATCH", `/api/admin/users/${userId}/tier`, { tier, lifetime }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/organizers"] });
      toast({ title: "Tier updated" });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ userId, suspended }: { userId: string; suspended: boolean }) =>
      apiRequest("PATCH", `/api/admin/users/${userId}/suspend`, { suspended }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/organizers"] });
      toast({ title: vars.suspended ? "Account suspended" : "Account reinstated" });
      setConfirmSuspend(null);
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => apiRequest("DELETE", `/api/admin/users/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/organizers"] });
      toast({ title: "Account deleted" });
      setConfirmDelete(null);
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter(o => {
      const matchesSearch = !q ||
        o.businessName.toLowerCase().includes(q) ||
        o.email.toLowerCase().includes(q);
      const matchesTier = tierFilter === "all" || o.tier === tierFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active_events" && o.activeEventCount > 0) ||
        (statusFilter === "no_active_events" && o.activeEventCount === 0) ||
        (statusFilter === "suspended" && o.suspended);
      return matchesSearch && matchesTier && matchesStatus;
    });
  }, [data, search, tierFilter, statusFilter]);

  if (meLoading || !me) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (me.role !== "admin") return null;

  return (
    <AdminLayout>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Organizers</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{data.length} total registered</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="pl-9 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 h-9"
            />
          </div>
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-[130px] bg-zinc-900 border-zinc-700 text-white h-9">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all">All tiers</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-zinc-900 border-zinc-700 text-white h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active_events">Has active events</SelectItem>
              <SelectItem value="no_active_events">No active events</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
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
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {["Name / Email", "Tier", "Pro Expires", "Subaccount", "Events", "Tickets", "Revenue", "Joined", ""].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-zinc-500 text-xs uppercase tracking-widest font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-zinc-600">No organizers match your filters.</td>
                    </tr>
                  )}
                  {filtered.map(o => (
                    <tr key={o.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-white font-medium text-sm truncate max-w-[180px]">{o.businessName}</p>
                            {o.suspended && (
                              <span className="text-[9px] font-bold text-red-400 bg-red-500/15 border border-red-500/25 px-1 py-0.5 rounded-full flex-shrink-0">
                                SUSPENDED
                              </span>
                            )}
                          </div>
                          <p className="text-zinc-500 text-xs truncate max-w-[180px]">{o.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3"><TierBadge tier={o.tier} /></td>
                      <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                        {o.tier === "pro" && o.proExpiresAt
                          ? fmtDate(o.proExpiresAt)
                          : <span className="text-zinc-700">—</span>}
                      </td>
                      <td className="px-4 py-3"><MaskedCode code={o.subaccountCode} /></td>
                      <td className="px-4 py-3">
                        <span className="text-white font-medium">{o.eventCount}</span>
                        {o.activeEventCount > 0 && (
                          <span className="text-zinc-600 text-xs ml-1">({o.activeEventCount} active)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-sm">{o.ticketsSold.toLocaleString()}</td>
                      <td className="px-4 py-3 text-zinc-400 text-sm">{fmtNaira(o.revenue)}</td>
                      <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">{fmtDate(o.createdAt)}</td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-zinc-400 hover:text-white hover:bg-zinc-800">
                              <ChevronDown className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700 text-white min-w-[160px]">
                            <DropdownMenuItem
                              className="text-sm cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 gap-2"
                              onClick={() => navigate(`/admin/organizers/${o.userId}`)}>
                              <Eye className="w-3.5 h-3.5 text-zinc-400" /> View details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-zinc-800" />
                            {o.tier === "free" ? (
                              <>
                                <DropdownMenuItem
                                  className="text-sm cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 gap-2"
                                  onClick={() => tierMutation.mutate({ userId: o.userId, tier: "pro", lifetime: true })}>
                                  <Crown className="w-3.5 h-3.5 text-amber-400" /> Grant Lifetime Pro
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-sm cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 gap-2"
                                  onClick={() => tierMutation.mutate({ userId: o.userId, tier: "pro", lifetime: false })}>
                                  <Crown className="w-3.5 h-3.5 text-amber-400" /> Grant Pro (1 yr)
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem
                                className="text-sm cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 gap-2"
                                onClick={() => tierMutation.mutate({ userId: o.userId, tier: "free" })}>
                                <Users className="w-3.5 h-3.5 text-zinc-400" /> Revoke Pro
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator className="bg-zinc-800" />
                            {o.suspended ? (
                              <DropdownMenuItem
                                className="text-sm cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 gap-2 text-green-400"
                                onClick={() => suspendMutation.mutate({ userId: o.userId, suspended: false })}>
                                <CheckCircle className="w-3.5 h-3.5" /> Unsuspend
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-sm cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 gap-2 text-orange-400"
                                onClick={() => setConfirmSuspend(o)}>
                                <Ban className="w-3.5 h-3.5" /> Suspend
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-sm cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 gap-2 text-red-400"
                              onClick={() => setConfirmDelete(o)}>
                              <Trash2 className="w-3.5 h-3.5" /> Delete account
                            </DropdownMenuItem>
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
        <p className="text-zinc-600 text-xs text-right">{filtered.length} of {data.length} organizers</p>
      </main>

      <AlertDialog open={!!confirmSuspend} onOpenChange={v => { if (!v) setConfirmSuspend(null); }}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Suspend account?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              <strong className="text-white">{confirmSuspend?.businessName}</strong> ({confirmSuspend?.email}) will be immediately blocked from logging in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => confirmSuspend && suspendMutation.mutate({ userId: confirmSuspend.userId, suspended: true })}>
              Suspend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={v => { if (!v) setConfirmDelete(null); }}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete account?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This permanently deletes <strong className="text-white">{confirmDelete?.businessName}</strong> and all their events. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.userId)}>
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
