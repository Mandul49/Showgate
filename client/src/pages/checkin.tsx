import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Search, UserCheck } from "lucide-react";
import { isAuthenticated } from "@/lib/auth";

type Buyer = {
  id: string; name: string; email: string; phone: string;
  ticketType: string; quantity: number; createdAt: string | null; checkedInAt: string | null;
};
type CheckInData = {
  event: { id: string; title: string; date: string; location: string };
  buyers: Buyer[];
};

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("authToken")}` });

export default function CheckIn() {
  const { eventId } = useParams<{ eventId: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const key = ["/api/analytics", eventId, "checkin"];

  useEffect(() => { if (!isAuthenticated()) navigate("/login"); }, []);

  const { data, isLoading, isError, error } = useQuery<CheckInData, Error>({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(`/api/analytics/${eventId}/checkin`, { headers: authHeaders() });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    enabled: !!eventId,
    refetchInterval: 15000,
  });

  const toggle = useMutation({
    mutationFn: async ({ id, checkedIn }: { id: string; checkedIn: boolean }) => {
      const res = await fetch(`/api/analytics/${eventId}/checkin/${id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ checkedIn }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onMutate: async ({ id, checkedIn }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CheckInData>(key);
      if (prev) qc.setQueryData<CheckInData>(key, {
        ...prev,
        buyers: prev.buyers.map((b) => b.id === id ? { ...b, checkedInAt: checkedIn ? new Date().toISOString() : null } : b),
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const buyers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (data?.buyers ?? []).filter((b) =>
      !q || [b.name, b.email, b.phone, b.ticketType, b.id].some((v) => v?.toLowerCase().includes(q)));
    // Waiting first (original order), checked-in at the bottom (most recent last)
    const waiting = list.filter((b) => !b.checkedInAt);
    const done = list.filter((b) => b.checkedInAt)
      .sort((a, b) => new Date(a.checkedInAt!).getTime() - new Date(b.checkedInAt!).getTime());
    return [...waiting, ...done];
  }, [data, search]);

  const totalTickets = (data?.buyers ?? []).reduce((s, b) => s + b.quantity, 0);
  const inTickets = (data?.buyers ?? []).filter((b) => b.checkedInAt).reduce((s, b) => s + b.quantity, 0);
  const inBuyers = (data?.buyers ?? []).filter((b) => b.checkedInAt).length;

  if (isLoading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">Loading check-in…</div>
  );
  if (isError || !data) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-center">
      <div>
        <p className="text-zinc-400 mb-2">Could not load the check-in list.</p>
        {error?.message && <p className="text-red-400 text-sm mb-4">{error.message}</p>}
        <a href="/dashboard" className="text-amber-400 text-sm hover:underline">← Back to dashboard</a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="border-b border-zinc-800 bg-zinc-900 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <a href={`/analytics/${eventId}`} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm">
            <ArrowLeft className="w-4 h-4" /> Analytics
          </a>
          <span className="text-zinc-700">/</span>
          <UserCheck className="w-4 h-4 text-amber-400" />
          <span className="text-white font-semibold text-sm">Check-in</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div>
          <h1 className="text-2xl font-black text-white">{data.event.title}</h1>
          <p className="text-zinc-500 text-xs mt-1">
            {inBuyers} of {data.buyers.length} buyers checked in · {inTickets} of {totalTickets} tickets
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone or order ref"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/50"
          />
        </div>

        {buyers.length === 0 ? (
          <p className="text-center text-zinc-600 text-sm py-12">No buyers found.</p>
        ) : (
          <ul className="space-y-2">
            {buyers.map((b) => {
              const done = !!b.checkedInAt;
              return (
                <li key={b.id}>
                  <button
                    onClick={() => toggle.mutate({ id: b.id, checkedIn: !done })}
                    aria-pressed={done}
                    className={`w-full flex items-center gap-4 text-left rounded-xl border px-4 py-3 transition-all ${
                      done
                        ? "bg-zinc-900/40 border-zinc-800/60 opacity-50"
                        : "bg-zinc-900 border-zinc-800 hover:border-amber-400/40"
                    }`}>
                    <span className={`w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center ${
                      done ? "bg-green-500 border-green-500" : "border-zinc-600"
                    }`}>
                      {done && <Check className="w-4 h-4 text-zinc-950" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block font-semibold truncate ${done ? "line-through text-zinc-500" : "text-white"}`}>{b.name}</span>
                      <span className="block text-xs text-zinc-500 truncate">{b.email} · {b.phone}</span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-xs font-semibold text-amber-400">{b.ticketType}</span>
                      <span className="block text-xs text-zinc-500">{b.quantity} ticket{b.quantity === 1 ? "" : "s"}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
