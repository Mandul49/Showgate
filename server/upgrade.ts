import crypto from "crypto";
import PDFDocument from "pdfkit";
import type { Express, Request, Response } from "express";
import { requireAuth, type AuthRequest } from "./auth";
import { storage } from "./storage";
import { getPaystackSecretKey } from "./paystackConfig";

export const PLANS = {
  monthly: { amountKobo: 1_200_000, label: "Monthly", durationDays: 31 },
  yearly:  { amountKobo: 12_000_000, label: "Yearly",  durationDays: 366 },
} as const;
type PlanKey = keyof typeof PLANS;

async function getPlanAmountsFromDb(): Promise<{ monthly: number; yearly: number }> {
  const [monthlyStr, yearlyStr] = await Promise.all([
    storage.getPlatformSetting("pro_monthly_price_kobo", String(PLANS.monthly.amountKobo)),
    storage.getPlatformSetting("pro_yearly_price_kobo", String(PLANS.yearly.amountKobo)),
  ]);
  return {
    monthly: parseInt(monthlyStr, 10) || PLANS.monthly.amountKobo,
    yearly: parseInt(yearlyStr, 10) || PLANS.yearly.amountKobo,
  };
}

// ── Paystack subaccount charge update ────────────────────────────────────────

export async function updateSubaccountCharge(subaccountCode: string, percentage: number): Promise<void> {
  const PAYSTACK_KEY = getPaystackSecretKey();
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
  await storage.updateUserBillingCycle(userId, plan);

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

// ── Paystack webhook ──────────────────────────────────────────────────────────

export function registerUpgradeWebhook(app: Express): void {
  app.post("/api/upgrade/webhook", async (req: Request, res: Response) => {
    const PAYSTACK_KEY = getPaystackSecretKey();
    if (!PAYSTACK_KEY) {
      console.error("[webhook] Paystack secret key not configured — rejecting webhook");
      return res.status(500).json({ message: "Payment system not configured" });
    }

    // Validate HMAC-SHA512 signature
    const signature = req.headers["x-paystack-signature"] as string | undefined;
    const rawBody: Buffer | undefined = (req as any).rawBody;

    if (!signature || !rawBody) {
      return res.status(400).json({ message: "Missing signature or body" });
    }

    const expectedSig = crypto
      .createHmac("sha512", PAYSTACK_KEY)
      .update(rawBody)
      .digest("hex");

    if (signature !== expectedSig) {
      console.warn("[webhook] Invalid Paystack signature — ignoring");
      return res.status(401).json({ message: "Invalid signature" });
    }

    // Parse event
    let event: any;
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({ message: "Invalid JSON body" });
    }

    // Only handle charge.success events
    if (event.event !== "charge.success") {
      return res.status(200).json({ message: "Event ignored" });
    }

    const data = event.data ?? {};
    const meta = data.metadata ?? {};
    const reference: string | undefined = data.reference;

    const userId: string | undefined = meta.user_id;
    const rawPlan: string | undefined = meta.upgrade_plan;

    // Validate required metadata
    if (!userId || !reference) {
      console.warn("[webhook] charge.success missing user_id or reference — skipping");
      return res.status(200).json({ message: "Missing metadata — skipped" });
    }

    // Require upgrade_plan to be present and valid (skip ticket-purchase events)
    if (rawPlan !== "monthly" && rawPlan !== "yearly") {
      return res.status(200).json({ message: "Not a subscription event — skipped" });
    }
    const plan = rawPlan as PlanKey;

    try {
      // Idempotency: skip if reference already processed
      const alreadyUsed = await storage.hasSubscriptionReference(reference);
      if (alreadyUsed) {
        console.log(`[webhook] Reference ${reference} already processed — idempotent skip`);
        return res.status(200).json({ message: "Already processed" });
      }

      // Skip if user is already Pro (could have been activated via /verify)
      const user = await storage.getUserById(userId);
      if (!user) {
        console.warn(`[webhook] User ${userId} not found — skipping`);
        return res.status(200).json({ message: "User not found — skipped" });
      }

      if (user.tier === "pro") {
        // Still record the reference so it can't be replayed later
        await storage.recordSubscriptionReference(reference, userId, plan, PLANS[plan].amountKobo);
        console.log(`[webhook] User ${userId} already Pro — recorded reference and skipped fulfillment`);
        return res.status(200).json({ message: "Already Pro" });
      }

      await fulfillUpgrade(userId, plan);
      await storage.recordSubscriptionReference(reference, userId, plan, PLANS[plan].amountKobo);

      console.log(`[webhook] Fulfilled Pro upgrade for user ${userId} (${plan}) via webhook`);
      return res.status(200).json({ message: "Upgrade fulfilled" });
    } catch (err: any) {
      console.error("[webhook] Error fulfilling upgrade:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });
}

// ── Express routes ────────────────────────────────────────────────────────────

export function registerUpgradeRoutes(app: Express): void {
  // POST /api/upgrade/checkout — initialize Paystack payment for Pro subscription
  app.post("/api/upgrade/checkout", requireAuth, async (req: AuthRequest, res) => {
    try {
      const PAYSTACK_KEY = getPaystackSecretKey();
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
        cancelledAt: user.cancelledAt ?? null,
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

      const PAYSTACK_KEY = getPaystackSecretKey();
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
      await storage.recordSubscriptionReference(reference, userId, plan, PLANS[plan].amountKobo);

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

  // GET /api/subscription — full subscription details for the management page
  app.get("/api/subscription", requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUserById(req.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });

      const history = user.tier === "pro" ? await storage.getSubscriptionHistory(req.userId!) : [];

      const billingCycle = user.billingCycle ?? null;
      const planAmounts = await getPlanAmountsFromDb();
      const amountKobo = billingCycle === "yearly" ? planAmounts.yearly : planAmounts.monthly;

      return res.json({
        tier: user.tier,
        billingCycle,
        proExpiresAt: user.proExpiresAt ?? null,
        cancelledAt: user.cancelledAt ?? null,
        amountKobo,
        history: history.map((h) => ({
          reference: h.reference,
          plan: h.plan,
          amountKobo: h.amountKobo ?? (h.plan === "yearly" ? planAmounts.yearly : planAmounts.monthly),
          fulfilledAt: h.fulfilledAt,
        })),
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // POST /api/upgrade/cancel — immediately downgrade to free tier
  app.post("/api/upgrade/cancel", requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUserById(req.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.tier !== "pro") return res.status(400).json({ message: "No active Pro subscription" });

      const reason: string | null = typeof req.body.reason === "string" && req.body.reason.trim()
        ? req.body.reason.trim()
        : null;

      await storage.updateUserTier(req.userId!, "free", new Date());

      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (organizer) {
        await storage.updateOrganizerTier(organizer.id, "free");
        if (organizer.subaccountCode) {
          updateSubaccountCharge(organizer.subaccountCode, 2.5).catch((err) =>
            console.error("[cancel] Subaccount update failed:", err.message)
          );
        }
      }

      console.log(`[cancel] User ${req.userId!} (${user.email}) immediately downgraded to free — reason: ${reason ?? "No reason given"}`);
      return res.json({ success: true, tier: "free" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // POST /api/subscription/cancel — mark as cancelled (keeps Pro until proExpiresAt)
  app.post("/api/subscription/cancel", requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUserById(req.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.tier !== "pro") return res.status(400).json({ message: "No active Pro subscription" });
      if (user.cancelledAt) return res.status(400).json({ message: "Subscription already cancelled" });

      const reason: string | null = typeof req.body.reason === "string" && req.body.reason.trim()
        ? req.body.reason.trim()
        : null;

      const updated = await storage.cancelSubscription(req.userId!);
      console.log(`[cancel] User ${req.userId!} (${user.email}) cancelled subscription — reason: ${reason ?? "No reason given"}`);
      return res.json({ cancelledAt: updated.cancelledAt, proExpiresAt: updated.proExpiresAt });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // GET /api/upgrade/history — past subscription payments for the logged-in user
  app.get("/api/upgrade/history", requireAuth, async (req: AuthRequest, res) => {
    try {
      const history = await storage.getSubscriptionHistory(req.userId!);
      const pa = await getPlanAmountsFromDb();
      return res.json(
        history.map((h) => ({
          plan: h.plan,
          amountKobo: h.amountKobo ?? (h.plan === "yearly" ? pa.yearly : pa.monthly),
          fulfilledAt: h.fulfilledAt,
          reference: h.reference,
        }))
      );
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // GET /api/upgrade/receipt/:reference — generate and download a PDF receipt
  app.get("/api/upgrade/receipt/:reference", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { reference } = req.params;
      const userId = req.userId!;

      const record = await storage.getSubscriptionByReference(reference);
      if (!record) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      if (record.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const [user, organizer] = await Promise.all([
        storage.getUserById(userId),
        storage.getOrganizerByUserId(userId),
      ]);
      if (!user) return res.status(404).json({ message: "User not found" });

      const pa = await getPlanAmountsFromDb();
      const amountKobo = record.amountKobo ?? (record.plan === "yearly" ? pa.yearly : pa.monthly);
      const amountNaira = amountKobo / 100;
      const planLabel = record.plan === "yearly" ? "Pro Yearly" : "Pro Monthly";
      const dateStr = new Date(record.fulfilledAt).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      });
      const amountStr = new Intl.NumberFormat("en-NG", {
        style: "currency", currency: "NGN", minimumFractionDigits: 0,
      }).format(amountNaira);
      const businessName = organizer?.businessName ?? null;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="receipt-${reference.slice(-8)}.pdf"`
      );

      const doc = new PDFDocument({ size: "A4", margin: 60, bufferPages: true });
      doc.pipe(res);

      // Header bar
      doc.rect(0, 0, doc.page.width, 6).fill("#7c3aed");

      // Title
      doc.moveDown(1.5);
      doc.font("Helvetica-Bold").fontSize(22).fillColor("#1a1a1a").text("Payment Receipt", { align: "left" });
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(11).fillColor("#666666").text("Showgate Pro Subscription", { align: "left" });

      // Divider
      doc.moveDown(1.2);
      doc.moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y).strokeColor("#e5e7eb").lineWidth(1).stroke();
      doc.moveDown(1);

      // Receipt details table
      const labelX = 60;
      const valueX = 220;
      const rowH = 24;

      function row(label: string, value: string, bold = false) {
        const y = doc.y;
        doc.font("Helvetica").fontSize(10).fillColor("#888888").text(label, labelX, y);
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor("#1a1a1a").text(value, valueX, y);
        doc.moveDown(0.75);
      }

      row("Date", dateStr);
      row("Reference", reference);
      row("Plan", planLabel);
      if (businessName) row("Organizer", businessName);
      row("Email", user.email);
      doc.moveDown(0.3);

      // Amount highlight box
      doc.moveDown(0.5);
      const boxY = doc.y;
      doc.rect(labelX, boxY, doc.page.width - 120, 40).fill("#f5f3ff");
      doc.font("Helvetica").fontSize(10).fillColor("#7c3aed").text("Amount Paid", labelX + 14, boxY + 9);
      doc.font("Helvetica-Bold").fontSize(14).fillColor("#5b21b6").text(amountStr, valueX + 40, boxY + 6);
      doc.moveDown(3);

      // Status badge
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#059669").text("✓ Payment confirmed", labelX);

      // Footer
      doc.moveDown(2.5);
      doc.moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y).strokeColor("#e5e7eb").lineWidth(1).stroke();
      doc.moveDown(0.8);
      doc.font("Helvetica").fontSize(9).fillColor("#aaaaaa")
        .text("Showgate · This receipt was generated automatically and is valid without a signature.", labelX, doc.y, {
          align: "center", width: doc.page.width - 120,
        });

      doc.end();
    } catch (err: any) {
      if (!res.headersSent) {
        return res.status(500).json({ message: err.message });
      }
    }
  });

  // POST /api/subscription/reinstate — undo cancellation (resume auto-renewal)
  app.post("/api/subscription/reinstate", requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUserById(req.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.tier !== "pro") return res.status(400).json({ message: "No active Pro subscription" });
      if (!user.cancelledAt) return res.status(400).json({ message: "Subscription is not cancelled" });

      const updated = await storage.reinstateSubscription(req.userId!);
      return res.json({ cancelledAt: updated.cancelledAt, proExpiresAt: updated.proExpiresAt });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
