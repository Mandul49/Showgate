import { useState } from "react";
import { Crown, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getToken } from "@/lib/auth";

export function VipButton({ eventId, title }: { eventId: string; title: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [vips, setVips] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const headers = () => ({ Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" });

  async function save(next: { id: string; name: string }[]) {
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/vips`, { method: "PUT", headers: headers(), body: JSON.stringify({ vips: next }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setVips(json.vips);
      return true;
    } catch (err: any) {
      toast({ title: "Could not save special guests", description: err.message, variant: "destructive" });
      return false;
    } finally { setBusy(false); }
  }

  async function openDialog() {
    setOpen(true);
    try {
      const res = await fetch(`/api/events/${eventId}/vips`, { headers: headers() });
      if (res.ok) setVips((await res.json()).vips);
    } catch {}
  }

  async function add() {
    const n = name.trim();
    if (!n) return;
    if (await save([...vips, { id: crypto.randomUUID(), name: n }])) setName("");
  }

  return (
    <>
      <button
        onClick={openDialog}
        title="Special guests"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-semibold transition-colors hover:border-fuchsia-400/50 text-zinc-400 hover:text-fuchsia-400">
        <Crown className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Special Guests</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-1">
              <h3 className="text-white font-bold flex items-center gap-2"><Crown className="w-4 h-4 text-fuchsia-400" /> Special guests</h3>
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-zinc-500 text-xs mb-4 truncate">{title}. Special guests show at the top of the check-in page.</p>
            <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex gap-2 mb-4">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Guest name"
                maxLength={100}
                autoFocus
                className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-fuchsia-400/50"
              />
              <button type="submit" disabled={busy || !name.trim()}
                className="px-3 py-2 rounded-lg bg-fuchsia-500 text-white text-sm font-semibold disabled:opacity-50">Add</button>
            </form>
            {vips.length === 0 ? (
              <p className="text-zinc-600 text-sm text-center py-3">No special guests yet.</p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {vips.map((v) => (
                  <li key={v.id} className="flex items-center gap-2 rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-2">
                    <span className="flex-1 min-w-0 truncate text-sm text-white">{v.name}</span>
                    <button disabled={busy} onClick={() => save(vips.filter((x) => x.id !== v.id))} title="Remove"
                      className="text-zinc-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
