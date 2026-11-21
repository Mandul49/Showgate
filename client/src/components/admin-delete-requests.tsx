import { useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export interface DeleteRequestEvent {
  id: string;
  title: string;
  businessName: string;
  ticketsSold: number;
  deleteRequestedAt: string | null;
  deleteRequestReason: string | null;
}

export function DeleteRequests({ events }: { events: DeleteRequestEvent[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const requests = events.filter(e => e.deleteRequestedAt);
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
      apiRequest("POST", `/api/admin/events/${id}/delete-request/${action}`, {}).then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Request failed");
      }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/events"] });
      toast({ title: v.action === "approve" ? "Event deleted" : "Request rejected" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  if (requests.length === 0) return null;
  return (
    <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
      <p className="text-white font-semibold text-sm mb-3">Deletion requests ({requests.length})</p>
      <div className="space-y-3">
        {requests.map(ev => (
          <div key={ev.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg bg-zinc-900 border border-zinc-800 p-3">
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{ev.title} <span className="text-zinc-500 font-normal">· {ev.businessName}</span></p>
              <p className="text-zinc-500 text-xs mt-0.5">{ev.ticketsSold} tickets sold · requested {new Date(ev.deleteRequestedAt!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
              {ev.deleteRequestReason && <p className="text-zinc-400 text-xs mt-1 whitespace-pre-wrap">“{ev.deleteRequestReason}”</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button size="sm" variant="outline" disabled={act.isPending}
                onClick={() => act.mutate({ id: ev.id, action: "reject" })}>Reject</Button>
              <Button size="sm" disabled={act.isPending}
                className="bg-red-500 hover:bg-red-400 text-white"
                onClick={() => { if (window.confirm(`Permanently delete "${ev.title}"? ${ev.ticketsSold} tickets were sold. This cannot be undone.`)) act.mutate({ id: ev.id, action: "approve" }); }}>
                Approve &amp; delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
