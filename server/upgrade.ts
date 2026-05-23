import type { Express } from "express";
import { requireAuth, type AuthRequest } from "./auth";
import { storage } from "./storage";

const PAYSTACK_KEY = process.env.PICATIC_API_KEY;

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
}
