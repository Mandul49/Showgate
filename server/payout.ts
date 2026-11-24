import type { Express } from "express";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { organizers, organizerSubaccounts } from "@shared/schema";
import { requireAuth, type AuthRequest } from "./auth";
import { storage } from "./storage";
import { getPaystackSecretKey, isTestMode } from "./paystackConfig";

function parsePct(v: string, fallback: number): number {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : fallback;
}

/** Platform fee percentage for a tier, from the admin settings: Free uses platform_fee_percent, Pro uses pro_ticket_fee_percent. */
export async function platformFeePctForTier(tier: string): Promise<number> {
  if (tier === "pro") return parsePct(await storage.getPlatformSetting("pro_ticket_fee_percent", "2"), 2);
  return parsePct(await storage.getPlatformSetting("platform_fee_percent", "2.5"), 2.5);
}

const accountSchema = z.object({
  bankCode: z.string().min(1, "Please select a bank"),
  accountNumber: z.string().regex(/^\d{10}$/, "Account number must be exactly 10 digits"),
});

const setSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("default") }),
  z.object({
    mode: z.literal("custom"),
    bankCode: z.string().min(1),
    bankName: z.string().min(1),
    accountNumber: z.string().regex(/^\d{10}$/, "Account number must be exactly 10 digits"),
    // Name the planner confirmed on screen; must match what Paystack resolves now.
    confirmedAccountName: z.string().min(1),
  }),
]);

async function resolveAccount(bankCode: string, accountNumber: string): Promise<{ ok: true; accountName: string } | { ok: false; message: string }> {
  const key = getPaystackSecretKey();
  if (!key) return { ok: false, message: "Payment provider is not configured" };
  const res = await fetch(
    `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.status || !data.data?.account_name) {
    return { ok: false, message: data.message || "Could not verify this account. Check the bank and account number." };
  }
  return { ok: true, accountName: String(data.data.account_name) };
}

async function createPaystackSubaccount(businessName: string, bankCode: string, accountNumber: string, pct: number): Promise<string> {
  const key = getPaystackSecretKey();
  const res = await fetch("https://api.paystack.co/subaccount", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      business_name: businessName,
      settlement_bank: bankCode,
      account_number: accountNumber,
      percentage_charge: pct,
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.status || !data.data?.subaccount_code) {
    throw new Error(data.message || "Could not create payout account");
  }
  return data.data.subaccount_code as string;
}

/** Subaccount code to charge for an event: its own payout account if set for the current mode, else the organizer default. */
export function effectiveSubaccountCode(
  event: { payoutSubaccountCode: string | null; payoutSubaccountMode: "test" | "live" | null },
  organizer: { subaccountCode: string | null; testSubaccountCode: string | null } | undefined | null,
): string | null {
  const mode = isTestMode() ? "test" : "live";
  if (event.payoutSubaccountCode && event.payoutSubaccountMode === mode) return event.payoutSubaccountCode;
  if (!organizer) return null;
  return isTestMode() ? (organizer.testSubaccountCode || organizer.subaccountCode) : organizer.subaccountCode;
}

/** Paystack subaccount codes an organizer owns for the current Paystack mode (signup account + per-event accounts). */
async function subaccountCodesFor(org: { id: string; subaccountCode: string | null; testSubaccountCode: string | null }): Promise<string[]> {
  const mode = isTestMode() ? "test" : "live";
  const codes = new Set<string>();
  const own = mode === "test" ? org.testSubaccountCode : org.subaccountCode;
  if (own) codes.add(own);
  const rows = await db.select().from(organizerSubaccounts)
    .where(and(eq(organizerSubaccounts.organizerId, org.id), eq(organizerSubaccounts.mode, mode)));
  for (const r of rows) codes.add(r.subaccountCode);
  return Array.from(codes);
}

/** Set one organizer's Paystack subaccounts to the fee for their current tier. */
export async function syncOrganizerSubaccountCharges(organizerId: string): Promise<void> {
  const organizer = await storage.getOrganizerById(organizerId);
  if (!organizer) return;
  const pct = await platformFeePctForTier(organizer.tier);
  const { updateSubaccountCharge } = await import("./upgrade");
  for (const code of await subaccountCodesFor(organizer)) {
    await updateSubaccountCharge(code, pct).catch((err) =>
      console.error("[payout] subaccount charge update failed:", code, err.message));
  }
}

/** After an admin changes a tier's fee, push it to every organizer on that tier. Runs in the background. */
export async function syncTierSubaccountCharges(tier: "free" | "pro"): Promise<void> {
  const rows = await db.select().from(organizers).where(eq(organizers.tier, tier));
  const pct = await platformFeePctForTier(tier);
  const { updateSubaccountCharge } = await import("./upgrade");
  let ok = 0, failed = 0;
  for (const org of rows) {
    let codes: string[] = [];
    try { codes = await subaccountCodesFor(org); } catch (err: any) { console.error("[fee-sync] lookup failed:", org.id, err.message); failed++; continue; }
    for (const code of codes) {
      try { await updateSubaccountCharge(code, pct); ok++; }
      catch (err: any) { failed++; console.error("[fee-sync] failed:", code, err.message); }
    }
  }
  console.log(`[fee-sync] ${tier} fee ${pct}%: ${ok} subaccount(s) updated, ${failed} failed, ${rows.length} organizer(s)`);
}

export function registerPayoutRoutes(app: Express) {
  // Step 1: look up the account name so the planner can confirm it.
  app.post("/api/organizer/payout-account/resolve", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(403).json({ message: "Complete onboarding first" });
      const parsed = accountSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      const r = await resolveAccount(parsed.data.bankCode, parsed.data.accountNumber);
      if (!r.ok) return res.status(400).json({ message: r.message });
      return res.json({ accountName: r.accountName });
    } catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  // Current payout setting for an event.
  app.get("/api/events/:id/payout-account", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(403).json({ message: "Complete onboarding first" });
      const event = await storage.getEventById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.organizerId !== organizer.id) return res.status(403).json({ message: "Not authorized" });
      if (!event.payoutSubaccountCode) return res.json({ mode: "default" });
      const [row] = await db.select().from(organizerSubaccounts).where(and(
        eq(organizerSubaccounts.organizerId, organizer.id),
        eq(organizerSubaccounts.subaccountCode, event.payoutSubaccountCode),
      ));
      if (!row) return res.json({ mode: "default" });
      return res.json({
        mode: "custom",
        bankName: row.bankName,
        accountName: row.accountName,
        accountNumberLast4: row.accountNumber.slice(-4),
      });
    } catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  // Step 2: after the planner confirms the name, reuse or create the subaccount and save it on the event.
  app.put("/api/events/:id/payout-account", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(403).json({ message: "Complete onboarding first" });
      const event = await storage.getEventById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.organizerId !== organizer.id) return res.status(403).json({ message: "Not authorized" });

      const parsed = setSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      if (parsed.data.mode === "default") {
        await storage.updateEvent(event.id, { payoutSubaccountCode: null, payoutSubaccountMode: null });
        return res.json({ mode: "default" });
      }

      const { bankCode, bankName, accountNumber, confirmedAccountName } = parsed.data;
      const resolved = await resolveAccount(bankCode, accountNumber);
      if (!resolved.ok) return res.status(400).json({ message: resolved.message });
      if (resolved.accountName.trim().toLowerCase() !== confirmedAccountName.trim().toLowerCase()) {
        return res.status(409).json({ message: "Account name changed. Please confirm again.", accountName: resolved.accountName });
      }

      const mode = isTestMode() ? "test" : "live";
      const [existing] = await db.select().from(organizerSubaccounts).where(and(
        eq(organizerSubaccounts.organizerId, organizer.id),
        eq(organizerSubaccounts.bankCode, bankCode),
        eq(organizerSubaccounts.accountNumber, accountNumber),
        eq(organizerSubaccounts.mode, mode),
      ));

      let code: string;
      let reused = true;
      if (existing) {
        code = existing.subaccountCode;
      } else {
        const defaultCode = isTestMode() ? organizer.testSubaccountCode : organizer.subaccountCode;
        if (defaultCode && organizer.bankCode === bankCode && organizer.accountNumber === accountNumber) {
          code = defaultCode; // same account as the organizer default: reuse that subaccount
        } else {
          code = await createPaystackSubaccount(organizer.businessName, bankCode, accountNumber, await platformFeePctForTier(organizer.tier));
          reused = false;
        }
        await db.insert(organizerSubaccounts).values({
          id: randomUUID(), organizerId: organizer.id, bankCode, bankName, accountNumber,
          accountName: resolved.accountName, subaccountCode: code, mode,
        }).onConflictDoNothing();
      }

      await storage.updateEvent(event.id, { payoutSubaccountCode: code, payoutSubaccountMode: mode });
      return res.json({
        mode: "custom", reused,
        bankName, accountName: resolved.accountName, accountNumberLast4: accountNumber.slice(-4),
      });
    } catch (err: any) {
      console.error("[payout] set failed:", err.message);
      return res.status(400).json({ message: `Payout account setup failed: ${err.message}` });
    }
  });
}
