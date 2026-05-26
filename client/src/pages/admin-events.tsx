import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminLayout } from "@/components/admin-layout";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ShieldCheck,
  ArrowLeft,
  Search,
  MoreVertical,
  ExternalLink,
  BarChart2,
  Ban,
  Trash2,
  CheckCircle,
  Calendar,
  Ticket,
} from "lucide-react";

interface AdminEventRow {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  location: string;
  status: string;
  isActive: boolean;
  suspendedByAdmin: boolean;
  paymentMethod: string;
  maxTickets: number;
  createdAt: string;
  organizerId: string;
  businessName: string;
  organizerEmail: string;
  ticketsSold: number;
  revenue: number;
}

type StatusFilter = "all" | "active" | "inactive" | "suspended" | "past";

function derivedStatus(ev: AdminEventRow): "active" | "inactive" | "past" | "suspended" {
  if (ev.suspendedByAdmin) return "suspended";
  const today = new Date().toISOString().split("T")[0];
  if (ev.date < today) return "past";
  if (!ev.isActive) return "inactive";
  return "active";
}

function StatusBadge({ status }: { status: "active" | "inactive" | "past" | "suspended" }) {
  if (status === "active")
    return <Badge className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-medium">Active</Badge>;
  if (status === "inactive")
    return <Badge className="bg-zinc-900 text-zinc-400 border border-zinc-700 text-[10px] font-medium">Inactive</Badge>;
  if (status === "past")
    return <Badge className="bg-zinc-900 text-zinc-500 border border-zinc-800 text-[10px] font-medium">Past</Badge>;
  return <Badge className="bg-red-950 text-red-400 border border-red-800 text-[10px] font-medium">Suspended</Badge>;
}

function fmtNaira(kobo: number) {
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

export default function AdminEvents() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: me, isLoading: meLoading } = useQuery<{ id: string; role: string }>({
    queryKey: ["/api/auth/me"],
  });

  useEffect(() => {
    if (!meLoading && me?.role !== "admin") navigate("/");
  }, [me, meLoading, navigate]);

  const { data: events = [], isLoading } = useQuery<AdminEventRow[]>({
    queryKey: ["/api/admin/events"],
    enabled: me?.role === "admin",
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [confirmDelete, setConfirmDelete] = useState<AdminEventRow | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<{ ev: AdminEventRow; suspend: boolean } | null>(null);

  const suspendMutation = useMutation({
    mutationFn: ({ id, suspended }: { id: string; suspended: boolean }) =>
      apiRequest("PATCH", `/api/admin/events/${id}/suspend`, { suspended }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/events"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/events/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/events"] }),
  });

  const filtered = events.filter((ev) => {
    const ds = derivedStatus(ev);
    if (statusFilter !== "all" && ds !== statusFilter) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return ev.title.toLowerCase().includes(q) || ev.organizerEmail.toLowerCase().includes(q) || ev.businessName.toLowerCase().includes(q);
  });

  const counts: Record<StatusFilter, number> = {
    all: events.length,
    active: events.filter(e => derivedStatus(e) === "active").length,
    inactive: events.filter(e => derivedStatus(e) === "inactive").length,
    suspended: events.filter(e => derivedStatus(e) === "suspended").length,
    past: events.filter(e => derivedStatus(e) === "past").length,
  };

  if (meLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "inactive", label: "Inactive" },
    { key: "suspended", label: "Suspended" },
    { key: "past", label: "Past" },
  ];

  return (
    <AdminLayout>
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-50 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-amber-500" />
              Events
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">All events across all organizers</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-zinc-50">{events.length}</div>
            <div className="text-xs text-zinc-500">total events</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <Input
              placeholder="Search by event name or organizer…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 text-sm h-9"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {filterTabs.map(t => (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === t.key
                    ? "bg-amber-500 text-black"
                    : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                {t.label}
                <span className={`ml-1.5 text-[10px] ${statusFilter === t.key ? "text-black/70" : "text-zinc-600"}`}>
                  {counts[t.key]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-zinc-600">
              <Calendar className="w-8 h-8" />
              <p className="text-sm">No events found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/60">
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Event</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Organizer</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                      <span className="flex items-center gap-1"><Ticket className="w-3 h-3" />Tickets</span>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Revenue</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ev, i) => {
                    const ds = derivedStatus(ev);
                    return (
                      <tr
                        key={ev.id}
                        className={`border-b border-zinc-800/60 transition-colors hover:bg-zinc-900/40 ${
                          i === filtered.length - 1 ? "border-b-0" : ""
                        }`}
                      >
                        {/* Event name */}
                        <td className="px-4 py-3 max-w-[220px]">
                          <div className="font-medium text-zinc-100 truncate">{ev.title}</div>
                          <div className="text-xs text-zinc-600 truncate">{ev.location}</div>
                        </td>

                        {/* Organizer */}
                        <td className="px-4 py-3">
                          <div className="text-zinc-300 text-xs truncate max-w-[160px]">{ev.organizerEmail}</div>
                          <div className="text-zinc-600 text-[10px] truncate max-w-[160px]">{ev.businessName}</div>
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 whitespace-nowrap text-zinc-400 text-xs">
                          {fmtDate(ev.date)}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusBadge status={ds} />
                        </td>

                        {/* Tickets */}
                        <td className="px-4 py-3 text-zinc-300 text-xs tabular-nums whitespace-nowrap">
                          {ev.ticketsSold.toLocaleString()}
                          <span className="text-zinc-600"> / {ev.maxTickets.toLocaleString()}</span>
                        </td>

                        {/* Revenue */}
                        <td className="px-4 py-3 text-zinc-300 text-xs tabular-nums whitespace-nowrap font-mono">
                          {fmtNaira(ev.revenue)}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700 text-zinc-100 w-48">
                              <DropdownMenuItem
                                className="gap-2 text-xs cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800"
                                onClick={() => window.open(`/events/${ev.id}`, "_blank")}
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                                View public page
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 text-xs cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800"
                                onClick={() => window.open(`/analytics/${ev.id}`, "_blank")}
                              >
                                <BarChart2 className="w-3.5 h-3.5 text-zinc-400" />
                                View analytics
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-zinc-800" />
                              {ev.suspendedByAdmin ? (
                                <DropdownMenuItem
                                  className="gap-2 text-xs cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 text-emerald-400"
                                  onClick={() => setConfirmSuspend({ ev, suspend: false })}
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Reinstate event
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="gap-2 text-xs cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 text-amber-400"
                                  onClick={() => setConfirmSuspend({ ev, suspend: true })}
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  Suspend event
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="gap-2 text-xs cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 text-red-400"
                                onClick={() => setConfirmDelete(ev)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete event
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Suspend confirm */}
      <AlertDialog open={!!confirmSuspend} onOpenChange={() => setConfirmSuspend(null)}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-50">
              {confirmSuspend?.suspend ? "Suspend event?" : "Reinstate event?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {confirmSuspend?.suspend
                ? `"${confirmSuspend.ev.title}" will be hidden from the public immediately. The organizer's data is preserved.`
                : `"${confirmSuspend?.ev.title}" will become publicly visible again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className={confirmSuspend?.suspend
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-emerald-700 hover:bg-emerald-600 text-white"}
              onClick={() => {
                if (!confirmSuspend) return;
                suspendMutation.mutate({ id: confirmSuspend.ev.id, suspended: confirmSuspend.suspend });
                setConfirmSuspend(null);
              }}
            >
              {confirmSuspend?.suspend ? "Suspend" : "Reinstate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-50">Delete event?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This will permanently delete <span className="text-zinc-200 font-medium">"{confirmDelete?.title}"</span> and all its ticket types. Existing purchase records are preserved. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-700 hover:bg-red-600 text-white"
              onClick={() => {
                if (!confirmDelete) return;
                deleteMutation.mutate(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
