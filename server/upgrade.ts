import type { Express } from "express";
import { requireAuth, type AuthRequest } from "./auth";
import { storage } from "./storage";

const PAYSTACK_KEY = process.env.PAYSTACK_SECRET_KEY;

export const PLANS = {
  monthly: { amountKobo: 1_200_000, label: "Monthly", durationDays: 31 },
  yearly:  { amountKobo: 12_000_000, label: "Yearly",  durationDays: 366 },
} as const;
type PlanKey = keyof typeof PLANS;

// ── Paystack subaccount charge update ────────────────────────────────────────

export async function updateSubaccountCharge(subaccountCode: string, percentage: number): Promise<void> {
  if (!PAYSTACK_KEY) return;
  const res = await fetch(`https://api.paystack.co/subaccount/${subaccountCode}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PAYSTACK_KEY}`,
    },
    body: JSON.stringify({ percentage_charge: percentage }),
  });
  const data: any = await res.json();
  if (!res.ok || !data.status) {
    throw new Error(data.message || "Subaccount update failed");
  }
  console.log(`[upgrade] Subaccount ${subaccountCode} → ${percentage}% platform fee`);
}

// ── Fulfill upgrade (called by webhook) ──────────────────────────────────────

export async function fulfillUpgrade(userId: string, plan: PlanKey): Promise<void> {
  const { durationDays } = PLANS[plan];
  const proExpiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

  const user = await storage.updateUserTier(userId, "pro", proExpiresAt);

  const organizer = await storage.getOrganizerByUserId(userId);
  if (organizer) {
    await storage.updateOrganizerTier(organizer.id, "pro");
    if (organizer.subaccountCode) {
      updateSubaccountCharge(organizer.subaccountCode, 0).catch((err) =>
        console.error("[upgrade] Subaccount update failed:", err.message)
      );
    }
  }

  console.log(
    `[upgrade] ${user.email} → Pro (${plan}), expires ${proExpiresAt.toLocaleDateString()}`
  );
}

// ── Daily cron — downgrade expired subscribers ────────────────────────────────

export function startSubscriptionCron(): void {
  const check = async () => {
    try {
      const expired = await storage.getUsersWithExpiredPro();
      if (expired.length > 0) {
        console.log(`[cron] Downgrading ${expired.length} expired Pro user(s)`);
      }
      for (const user of expired) {
        await storage.updateUserTier(user.id, "free", null);
        const organizer = await storage.getOrganizerByUserId(user.id);
        if (organizer) {
          await storage.updateOrganizerTier(organizer.id, "free");
          if (organizer.subaccountCode) {
            updateSubaccountCharge(organizer.subaccountCode, 2.5).catch(console.error);
          }
        }
        console.log(`[cron] Downgraded ${user.email} → free`);
      }
    } catch (err: any) {
      console.error("[cron] Subscription check error:", err.message);
    }
  };

  // Run once on startup, then every 24 h
  check();
  setInterval(check, 24 * 60 * 60 * 1000);
}

// ── Express routes ────────────────────────────────────────────────────────────

export function registerUpgradeRoutes(app: Express): void {
  // POST /api/upgrade/checkout — initialize Paystack payment for Pro subscription
  app.post("/api/upgrade/checkout", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!PAYSTACK_KEY) {
        return res.status(500).json({ message: "Payment system not configured" });
      }

      const plan: PlanKey = req.body.plan === "yearly" ? "yearly" : "monthly";
      const { amountKobo, label } = PLANS[plan];
      const userId = req.userId!;

      const user = await storage.getUserById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const callbackUrl = `${req.protocol}://${req.get("host")}/upgrade-success`;

      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PAYSTACK_KEY}`,
        },
        body: JSON.stringify({
          email: user.email,
          amount: amountKobo,
          callback_url: callbackUrl,
          metadata: {
            custom_fields: [
              { display_name: "Plan",    variable_name: "plan",         value: label },
              { display_name: "Type",    variable_name: "payment_type", value: "subscription" },
            ],
            upgrade_plan: plan,
            user_id: userId,
          },
        }),
      });

      const paystackData: any = await paystackRes.json();
      if (!paystackRes.ok || !paystackData.status) {
        return res.status(502).json({ message: paystackData.message || "Failed to start payment" });
      }

      return res.json({
        authorization_url: paystackData.data.authorization_url,
        reference: paystackData.data.reference,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // GET /api/upgrade/status — current tier info
  app.get("/api/upgrade/status", requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUserById(req.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({
        tier: user.tier,
        proExpiresAt: user.proExpiresAt ?? null,
        isPro: user.tier === "pro",
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // POST /api/upgrade/verify — verify a Paystack payment reference and fulfill upgrade
  app.post("/api/upgrade/verify", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { reference } = req.body;
      if (!reference) {
        return res.status(400).json({ message: "Missing payment reference" });
      }

      if (!PAYSTACK_KEY) {
        return res.status(500).json({ message: "Payment system not configured" });
      }

      const userId = req.userId!;
      const user = await storage.getUserById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Check if this reference was already consumed by anyone
      const alreadyUsed = await storage.hasSubscriptionReference(reference);
      if (alreadyUsed) {
        // Idempotent: if it was used by THIS user and they're still Pro, return success
        if (user.tier === "pro") {
          return res.json({ success: true, tier: "pro", proExpiresAt: user.proExpiresAt });
        }
        // The reference was already used (possibly by this user previously when Pro, then expired)
        return res.status(409).json({ message: "This payment reference has already been used to activate a subscription." });
      }

      // If already Pro (via a different reference), just return success
      if (user.tier === "pro") {
        return res.json({ success: true, tier: "pro", proExpiresAt: user.proExpiresAt });
      }

      // Verify the transaction with Paystack
      const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_KEY}` },
      });

      const paystackData: any = await paystackRes.json();

      if (!paystackRes.ok || !paystackData.status || paystackData.data?.status !== "success") {
        return res.status(400).json({ message: "Payment not confirmed. Please wait a moment and try again." });
      }

      const meta = paystackData.data?.metadata ?? {};

      // Strictly require user_id in metadata and that it matches the authenticated user
      if (!meta.user_id || meta.user_id !== userId) {
        return res.status(403).json({ message: "Payment reference does not belong to this account" });
      }

      // Require the payment to be tagged as a subscription upgrade (prevents reuse of ticket-purchase references)
      const customFields: any[] = meta.custom_fields ?? [];
      const paymentTypeField = customFields.find((f: any) => f.variable_name === "payment_type");
      if (!paymentTypeField || paymentTypeField.value !== "subscription") {
        return res.status(400).json({ message: "Payment reference is not for a Pro subscription" });
      }

      // Extract and validate plan from metadata
      const rawPlan = meta.upgrade_plan;
      if (rawPlan !== "monthly" && rawPlan !== "yearly") {
        return res.status(400).json({ message: "Invalid or missing plan in payment metadata" });
      }
      const plan: PlanKey = rawPlan;

      // Ensure the amount exactly matches the plan price
      const expectedKobo = PLANS[plan].amountKobo;
      if (paystackData.data.amount < expectedKobo) {
        return res.status(400).json({ message: "Payment amount insufficient for this plan" });
      }

      await fulfillUpgrade(userId, plan);
      // Record the reference so it can never be replayed for another upgrade
      await storage.recordSubscriptionReference(reference, userId, plan);

      const updatedUser = await storage.getUserById(userId);
      return res.json({
        success: true,
        tier: "pro",
        proExpiresAt: updatedUser?.proExpiresAt ?? null,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
