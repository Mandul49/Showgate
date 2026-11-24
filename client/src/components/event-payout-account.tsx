import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Check, Landmark } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export type PayoutSelection =
  | { mode: "unchanged" }
  | { mode: "default" }
  | { mode: "custom"; pending: true }
  | {
      mode: "custom";
      pending: false;
      bankCode: string;
      bankName: string;
      accountNumber: string;
      confirmedAccountName: string;
    };

interface Bank { id: number; name: string; code: string }
interface Current { mode: "default" | "custom"; bankName?: string; accountName?: string; accountNumberLast4?: string }

const input = "w-full bg-zinc-800 border border-zinc-600 text-white rounded-lg px-3 h-9 text-sm outline-none focus:border-amber-400 transition-colors placeholder:text-zinc-600";

/** True when the planner chose a new account but has not confirmed the resolved name yet. */
export function payoutBlocksSave(sel: PayoutSelection) {
  return sel.mode === "custom" && sel.pending;
}

/** Persist the selection for an event. No-op for "unchanged". */
export async function savePayoutSelection(eventId: string, sel: PayoutSelection) {
  if (sel.mode === "unchanged") return;
  if (sel.mode === "custom" && sel.pending) throw new Error("Confirm the payout account name first");
  const res = await apiRequest("PUT", `/api/events/${eventId}/payout-account`, sel.mode === "default" ? { mode: "default" } : {
    mode: "custom",
    bankCode: (sel as any).bankCode,
    bankName: (sel as any).bankName,
    accountNumber: (sel as any).accountNumber,
    confirmedAccountName: (sel as any).confirmedAccountName,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Could not save payout account");
}

export function EventPayoutAccount({
  eventId, value, onChange,
}: { eventId?: string; value: PayoutSelection; onChange: (v: PayoutSelection) => void }) {
  const custom = value.mode === "custom";
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: current } = useQuery<Current>({
    queryKey: [`/api/events/${eventId}/payout-account`],
    enabled: !!eventId,
  });
  const { data: banks = [], isLoading: banksLoading } = useQuery<Bank[]>({
    queryKey: ["/api/onboarding/banks"],
    staleTime: 60 * 60 * 1000,
    enabled: custom,
  });

  const bankName = banks.find((b) => b.code === bankCode)?.name ?? "";
  const confirmed = value.mode === "custom" && !value.pending;

  async function verify() {
    setError(null);
    setResolvedName(null);
    if (!bankCode) return setError("Select a bank");
    if (!/^\d{10}$/.test(accountNumber)) return setError("Account number must be 10 digits");
    setResolving(true);
    try {
      const res = await apiRequest("POST", "/api/organizer/payout-account/resolve", { bankCode, accountNumber });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Could not verify account");
      setResolvedName(json.accountName);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setResolving(false);
    }
  }

  function edited() {
    setResolvedName(null);
    if (confirmed) onChange({ mode: "custom", pending: true });
  }

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-3 space-y-3">
      <div className="flex items-center gap-2 text-zinc-300 text-sm font-semibold">
        <Landmark className="w-3.5 h-3.5 text-amber-400" /> Payout account
      </div>

      {current?.mode === "custom" && value.mode === "unchanged" && (
        <p className="text-xs text-zinc-400">
          Currently paying out to {current.accountName} ({current.bankName} ••••{current.accountNumberLast4}).
        </p>
      )}

      <div className="space-y-1.5 text-sm text-zinc-300">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" className="accent-amber-400" name={`payout-${eventId ?? "new"}`}
            checked={value.mode === "default" || (value.mode === "unchanged" && current?.mode !== "custom")}
            onChange={() => { setResolvedName(null); onChange({ mode: "default" }); }} />
          Use my default account
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" className="accent-amber-400" name={`payout-${eventId ?? "new"}`}
            checked={custom || (value.mode === "unchanged" && current?.mode === "custom")}
            onChange={() => onChange({ mode: "custom", pending: true })} />
          Use a different account for this event
        </label>
      </div>

      {custom && (
        <div className="space-y-2">
          <select className={input} value={bankCode} disabled={banksLoading}
            onChange={(e) => { setBankCode(e.target.value); edited(); }}>
            <option value="">{banksLoading ? "Loading banks…" : "Select bank"}</option>
            {banks.map((b) => <option key={b.id} value={b.code}>{b.name}</option>)}
          </select>
          <input className={input} inputMode="numeric" maxLength={10} placeholder="10-digit account number"
            value={accountNumber}
            onChange={(e) => { setAccountNumber(e.target.value.replace(/\D/g, "")); edited(); }} />

          {!resolvedName && !confirmed && (
            <button type="button" onClick={verify} disabled={resolving}
              className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-semibold disabled:opacity-60 flex items-center gap-1.5">
              {resolving && <Loader2 className="w-3 h-3 animate-spin" />} Verify account
            </button>
          )}

          {resolvedName && !confirmed && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-2.5 text-sm">
              <p className="text-zinc-300">Is this the right account?</p>
              <p className="text-white font-bold tracking-wide my-1">{resolvedName}</p>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => onChange({ mode: "custom", pending: false, bankCode, bankName, accountNumber, confirmedAccountName: resolvedName })}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold">
                  Yes, use this account
                </button>
                <button type="button" onClick={() => { setResolvedName(null); setAccountNumber(""); }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-semibold">
                  No, change
                </button>
              </div>
            </div>
          )}

          {confirmed && (
            <p className="text-xs text-green-400 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> {(value as any).confirmedAccountName} confirmed. Saved when you save the event.
            </p>
          )}
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
      )}
    </div>
  );
}
