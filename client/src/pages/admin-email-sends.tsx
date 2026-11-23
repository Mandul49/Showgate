import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Ban, CheckCircle, ChevronDown, ChevronUp, Paperclip } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

interface SendRow {
  id: string;
  organizerId: string;
  organizerName: string | null;
  organizerEmail: string | null;
  canSendEmails: boolean | null;
  eventTitle: string | null;
  subject: string;
  message: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: string;
  attachmentName: string | null;
  attachmentSize: number | null;
  createdAt: string;
}

interface OrgRow { id: string; name: string | null; email: string | null; canSendEmails: boolean | null }

const STATUS_CLS: Record<string, string> = {
  sent: "text-green-400 bg-green-400/10 border-green-400/20",
  sending: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  partial: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  failed: "text-red-400 bg-red-400/10 border-red-400/20",
};

export default function AdminEmailSends() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [openOrg, setOpenOrg] = useState<string | null>(null);

  const { data: me, isLoading: meLoading } = useQuery<{ id: string; role: string }>({ queryKey: ["/api/auth/me"] });
  useEffect(() => {
    if (!meLoading && me?.role !== "admin") navigate("/");
  }, [me, meLoading, navigate]);

  const { data: sends = [], isLoading } = useQuery<SendRow[]>({
    queryKey: ["/api/admin/email-sends"],
    enabled: me?.role === "admin",
  });

  const { data: orgs = [], isLoading: orgsLoading } = useQuery<OrgRow[]>({
    queryKey: ["/api/admin/email-organizers"],
    enabled: me?.role === "admin",
  });

  const groups = orgs.map((o) => ({ ...o, sends: sends.filter((s) => s.organizerId === o.id) }))
    .sort((a, b) => b.sends.length - a.sends.length || (a.name ?? "").localeCompare(b.name ?? ""));

  const toggle = useMutation({
    mutationFn: ({ organizerId, enabled }: { organizerId: string; enabled: boolean }) =>
      apiRequest("PATCH", `/api/admin/organizers/${organizerId}/email-sending`, { enabled }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/email-sends"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/email-organizers"] });
      toast({ title: v.enabled ? "Email sending re-enabled" : "Email sending blocked for this organizer" });
    },
    onError: (e: any) => toast({ title: "Could not update", description: e.message, variant: "destructive" }),
  });

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-50">Email sends</h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">Every Email Attendees message sent by organizers. Block an organizer to stop spam or scams immediately.</p>
        </div>

        {isLoading || orgsLoading ? (
          <p className="text-zinc-500 text-sm">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="text-zinc-600 text-sm py-8 text-center">No organisers yet.</p>
        ) : (
          <div className="space-y-2">
            {groups.map((g) => {
              const gOpen = openOrg === g.id;
              const blocked = g.canSendEmails === false;
              return (
                <div key={g.id} className="bg-zinc-900 border border-zinc-800 rounded-xl">
                  <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
                    <button onClick={() => setOpenOrg(gOpen ? null : g.id)} className="flex-1 min-w-[220px] text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-zinc-100 font-semibold text-sm">{g.name ?? "Unknown organiser"}</span>
                        {blocked && <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold text-red-400 bg-red-400/10 border-red-400/20">blocked</span>}
                      </div>
                      <p className="text-zinc-500 text-xs mt-0.5">{g.email ?? "—"} · {g.sends.length} email{g.sends.length === 1 ? "" : "s"} sent</p>
                    </button>
                    <button
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ organizerId: g.id, enabled: blocked })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                        blocked
                          ? "border-green-500/40 text-green-400 hover:bg-green-500/10"
                          : "border-red-500/40 text-red-400 hover:bg-red-500/10"
                      }`}>
                      {blocked ? <><CheckCircle className="w-3.5 h-3.5" /> Allow emails</> : <><Ban className="w-3.5 h-3.5" /> Block</>}
                    </button>
                    <button onClick={() => setOpenOrg(gOpen ? null : g.id)} className="text-zinc-600">
                      {gOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                  {gOpen && (
                    <div className="border-t border-zinc-800 p-3 space-y-2">
                      {g.sends.length === 0 && <p className="text-zinc-600 text-xs px-1">No emails sent by this organiser.</p>}
                      {g.sends.map((s) => {
                        const open = openId === s.id;
                        return (
                          <div key={s.id} className="bg-zinc-950 border border-zinc-800 rounded-lg">
                            <div className="flex items-center gap-3 px-3 py-2 flex-wrap">
                              <button onClick={() => setOpenId(open ? null : s.id)} className="flex-1 min-w-[200px] text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-zinc-100 font-semibold text-sm">{s.subject}</span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${STATUS_CLS[s.status] ?? "text-zinc-400 border-zinc-700"}`}>{s.status}</span>
                                  {s.attachmentName && <Paperclip className="w-3 h-3 text-zinc-500" />}
                                </div>
                                <p className="text-zinc-500 text-xs mt-0.5">{s.eventTitle ?? "Deleted event"}</p>
                              </button>
                              <div className="text-right text-xs text-zinc-400">
                                <div>{s.sentCount}/{s.recipientCount} sent{s.failedCount ? `, ${s.failedCount} failed` : ""}</div>
                                <div className="text-zinc-600">{new Date(s.createdAt).toLocaleString("en-GB")}</div>
                              </div>
                              <button onClick={() => setOpenId(open ? null : s.id)} className="text-zinc-600">
                                {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>
                            {open && (
                              <div className="px-3 pb-3 border-t border-zinc-800 pt-3">
                                <p className="text-zinc-300 text-sm whitespace-pre-wrap break-words">{s.message}</p>
                                {s.attachmentName && (
                                  <p className="text-zinc-500 text-xs mt-3">Attachment: {s.attachmentName}{s.attachmentSize ? ` (${Math.ceil(s.attachmentSize / 1024)} KB)` : ""}</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
