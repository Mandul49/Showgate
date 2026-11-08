import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Crown, Search, UserCheck } from "lucide-react";
import { isAuthenticated } from "@/lib/auth";

type Buyer = {
  key: string; orderId: string; seat: number; of: number; name: string; buyerName: string;
  email: string; phone: string; ticketType: string; createdAt: string | null; checkedInAt: string | null;
};
type CheckInData = {
  event: { id: string; title: string; date: string; location: string };
  tickets: Buyer[];
  vips?: { id: string; name: string; checkedInAt?: string | null }[];
};

type Pending = { id: string; seat: number; checkedIn: boolean; vip?: boolean };
const readJson = <T,>(k: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(k) ?? "") as T; } catch { return fallback; }
};

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("authToken")}` });

export default function CheckIn() {
  const { eventId } = useParams<{ eventId: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const key = ["/api/analytics", eventId, "checkin"];
  const cacheKey = `checkin:${eventId}`;
  const queueKey = `checkin-queue:${eventId}`;
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState<Pending[]>(() => readJson<Pending[]>(queueKey, []));

  useEffect(() => { if (!isAuthenticated()) navigate("/login"); }, []);

  // Service worker keeps the page itself loadable offline
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  const savePending = (list: Pending[]) => {
    localStorage.setItem(queueKey, JSON.stringify(list));
    setPending(list);
  };

  const sendToggle = async ({ id, seat, checkedIn, vip }: Pending) => {
    const res = await fetch(vip ? `/api/analytics/${eventId}/vip-checkin/${id}` : `/api/analytics/${eventId}/checkin/${id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ seat, checkedIn }),
    });
    if (!res.ok) throw new Error((await res.json()).message);
    return res.json();
  };

  // Push check-ins made offline once we are back online
  const flushing = useRef(false);
  const flush = async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      let queue = readJson<Pending[]>(queueKey, []);
      while (queue.length) {
        try { await sendToggle(queue[0]); } catch (e) {
          if (e instanceof TypeError) break; // still offline, keep the rest
        }
        queue = queue.slice(1);
        savePending(queue);
      }
    } finally { flushing.current = false; }
    qc.invalidateQueries({ queryKey: key });
  };

  useEffect(() => {
    const up = () => { setOnline(true); flush(); };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    if (navigator.onLine) flush();
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, [eventId]);

  const { data, isLoading, isError, error } = useQuery<CheckInData, Error>({
    queryKey: key,
    queryFn: async () => {
      // Never overwrite local offline check-ins with stale server data
      if (readJson<Pending[]>(queueKey, []).length) await flush();
      try {
        const res = await fetch(`/api/analytics/${eventId}/checkin`, { headers: authHeaders() });
        if (!res.ok) throw new Error((await res.json()).message);
        const json = await res.json();
        localStorage.setItem(cacheKey, JSON.stringify(json));
        return json;
      } catch (e) {
        const cached = readJson<CheckInData | null>(cacheKey, null);
        if (e instanceof TypeError && cached) return cached; // offline: use last loaded list
        throw e;
      }
    },
    initialData: () => readJson<CheckInData | undefined>(cacheKey, undefined),
    initialDataUpdatedAt: 0,
    enabled: !!eventId,
    refetchInterval: 15000,
    networkMode: "always",
  });

  const toggle = useMutation({
    networkMode: "always",
    mutationFn: async (p: Pending) => {
      try {
        return await sendToggle(p);
      } catch (e) {
        if (!(e instanceof TypeError)) throw e;
        // Offline: queue it (latest action per seat wins) and keep the optimistic state
        savePending([...readJson<Pending[]>(queueKey, []).filter((q) => !(q.id === p.id && q.seat === p.seat && !q.vip === !p.vip)), p]);
        return null;
      }
    },
    onMutate: async ({ id, seat, checkedIn, vip }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CheckInData>(key);
      if (prev) {
        const next = {
          ...prev,
          vips: (prev.vips ?? []).map((v) => vip && v.id === id ? { ...v, checkedInAt: checkedIn ? new Date().toISOString() : null } : v),
          tickets: vip ? prev.tickets : prev.tickets.map((b) => b.orderId === id && b.seat === seat ? { ...b, checkedInAt: checkedIn ? new Date().toISOString() : null } : b),
        };
        qc.setQueryData<CheckInData>(key, next);
        localStorage.setItem(cacheKey, JSON.stringify(next));
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSettled: () => { if (!readJson<Pending[]>(queueKey, []).length) qc.invalidateQueries({ queryKey: key }); },
  });

  const buyers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (data?.tickets ?? []).filter((b) =>
      !q || [b.name, b.buyerName, b.email, b.phone, b.ticketType, b.orderId].some((v) => v?.toLowerCase().includes(q)));
    // Waiting first (original order), checked-in at the bottom (most recent last)
    const waiting = list.filter((b) => !b.checkedInAt);
    const done = list.filter((b) => b.checkedInAt)
      .sort((a, b) => new Date(a.checkedInAt!).getTime() - new Date(b.checkedInAt!).getTime());
    return [...waiting, ...done];
  }, [data, search]);

  const vips = data?.vips ?? [];
  const totalTickets = (data?.tickets ?? []).length + vips.length;
  const inTickets = (data?.tickets ?? []).filter((b) => b.checkedInAt).length + vips.filter((v) => v.checkedInAt).length;

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

      {(!online || pending.length > 0) && (
        <div className="bg-amber-400/10 border-b border-amber-400/30 text-amber-300 text-xs text-center py-2 px-4">
          {!online ? "You're offline. Showing the last loaded list." : "Syncing check-ins…"}
          {pending.length > 0 && ` ${pending.length} check-in${pending.length > 1 ? "s" : ""} will sync when you're back online.`}
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div>
          <h1 className="text-2xl font-black text-white">{data.event.title}</h1>
          <p className="text-zinc-500 text-xs mt-1">
            {inTickets} of {totalTickets} tickets checked in
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

        {vips.length > 0 && (
          <ul className="space-y-2">
            {vips.map((v) => {
              const done = !!v.checkedInAt;
              return (
                <li key={v.id}>
                  <button
                    onClick={() => toggle.mutate({ id: v.id, seat: 0, checkedIn: !done, vip: true })}
                    aria-pressed={done}
                    className={`w-full flex items-center gap-4 text-left rounded-xl border px-4 py-3 transition-all ${
                      done ? "bg-zinc-900/40 border-amber-400/30 opacity-50" : "bg-zinc-900 border-amber-400/70 hover:border-amber-400"
                    }`}>
                    <span className={`w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center ${
                      done ? "bg-green-500 border-green-500" : "border-zinc-600"
                    }`}>
                      {done && <Check className="w-4 h-4 text-zinc-950" strokeWidth={3} />}
                    </span>
                    <span className={`min-w-0 flex-1 font-semibold truncate ${done ? "line-through text-zinc-500" : "text-white"}`}>{v.name}</span>
                    <Crown className="w-6 h-6 shrink-0 text-amber-400" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {buyers.length === 0 ? (
          <p className="text-center text-zinc-600 text-sm py-12">No buyers found.</p>
        ) : (
          <ul className="space-y-2">
            {buyers.map((b) => {
              const done = !!b.checkedInAt;
              return (
                <li key={b.key}>
                  <button
                    onClick={() => toggle.mutate({ id: b.orderId, seat: b.seat, checkedIn: !done })}
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
                      <span className={`block font-semibold truncate ${done ? "line-through text-zinc-500" : "text-white"}`}>
                        {b.name}
                        {b.of > 1 && <span className="ml-2 align-middle text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 no-underline">{b.seat + 1}/{b.of}</span>}
                      </span>
                      <span className="block text-xs text-zinc-500 truncate">{b.name !== b.buyerName ? `Buyer: ${b.buyerName} · ` : ""}{b.email} · {b.phone}</span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-xs font-semibold text-amber-400">{b.ticketType}</span>
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
