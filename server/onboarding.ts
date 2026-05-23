import type { Express } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "./auth";
import { storage } from "./storage";

const PAYSTACK_KEY = process.env.PAYSTACK_SECRET_KEY;

const setupSchema = z.object({
  businessName: z.string().min(2, "Business name must be at least 2 characters"),
  bankCode: z.string().min(1, "Bank is required"),
  bankName: z.string().min(1, "Bank name is required"),
  accountNumber: z.string().regex(/^\d{10}$/, "Account number must be exactly 10 digits"),
  bvn: z.string().regex(/^\d{11}$/, "BVN must be 11 digits").optional().or(z.literal("")),
});

let bankCache: any[] | null = null;
let bankCacheTime = 0;
const BANK_CACHE_TTL = 60 * 60 * 1000; // 1 hour

const flutterwaveSettingsSchema = z.object({
  flutterwavePublicKey: z.string().min(1, "Public key is required"),
  flutterwaveSecretKey: z.string().min(1, "Secret key is required"),
});

export function registerOnboardingRoutes(app: Express) {
  // ── List banks from Paystack ───────────────────────────────────────────────
  app.get("/api/onboarding/banks", requireAuth, async (_req, res) => {
    try {
      if (bankCache && Date.now() - bankCacheTime < BANK_CACHE_TTL) {
        return res.json(bankCache);
      }

      const r = await fetch(
        "https://api.paystack.co/bank?currency=NGN&per_page=200",
        { headers: { Authorization: `Bearer ${PAYSTACK_KEY}` } }
      );
      const data: any = await r.json();

      if (!r.ok || !data.status) {
        return res.status(502).json({ message: data.message || "Failed to fetch banks" });
      }

      bankCache = data.data || [];
      bankCacheTime = Date.now();
      return res.json(bankCache);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Check onboarding status ────────────────────────────────────────────────
  app.get("/api/onboarding/status", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.json({ completed: false });
      return res.json({
        completed: true,
        organizer: {
          id: organizer.id,
          businessName: organizer.businessName,
          subaccountCode: organizer.subaccountCode,
          bankName: organizer.bankName,
          accountNumber: organizer.accountNumber,
          tier: organizer.tier,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Create subaccount & save organizer ────────────────────────────────────
  app.post("/api/onboarding/setup", requireAuth, async (req: AuthRequest, res) => {
    try {
      const existing = await storage.getOrganizerByUserId(req.userId!);
      if (existing) {
        return res.status(409).json({
          message: "Onboarding already completed",
          organizer: {
            id: existing.id,
            businessName: existing.businessName,
            subaccountCode: existing.subaccountCode,
            bankName: existing.bankName,
            accountNumber: existing.accountNumber,
            tier: existing.tier,
          },
        });
      }

      const parsed = setupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { businessName, bankCode, bankName, accountNumber, bvn } = parsed.data;

      if (!PAYSTACK_KEY) {
        return res.status(500).json({ message: "Paystack API key not configured" });
      }

      console.log("[onboarding] PAYSTACK_KEY prefix:", PAYSTACK_KEY.slice(0, 10), "length:", PAYSTACK_KEY.length);

      // Call Paystack Create Subaccount
      const payload: Record<string, any> = {
        business_name: businessName,
        settlement_bank: bankCode,
        account_number: accountNumber,
        percentage_charge: 2.5,
      };
      if (bvn) payload.metadata = { bvn };

      const paystackRes = await fetch("https://api.paystack.co/subaccount", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PAYSTACK_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      const paystackData: any = await paystackRes.json();

      if (!paystackRes.ok || !paystackData.status) {
        return res.status(400).json({
          message: paystackData.message || "Paystack subaccount creation failed",
        });
      }

      const subaccountCode: string = paystackData.data.subaccount_code;

      const organizer = await storage.createOrganizer({
        userId: req.userId!,
        businessName,
        bankName,
        bankCode,
        accountNumber,
        subaccountCode,
        bvn: bvn || null,
        tier: "free",
      });

      return res.status(201).json({
        organizer: {
          id: organizer.id,
          businessName: organizer.businessName,
          subaccountCode: organizer.subaccountCode,
          bankName: organizer.bankName,
          accountNumber: organizer.accountNumber,
          tier: organizer.tier,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/organizer/payment-settings ────────────────────────────────────
  app.get("/api/organizer/payment-settings", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(404).json({ message: "Organizer not found" });

      return res.json({
        tier: organizer.tier,
        bankName: organizer.bankName,
        accountNumber: organizer.accountNumber,
        businessName: organizer.businessName,
        flutterwavePublicKey: organizer.flutterwavePublicKey || "",
        flutterwaveSecretKey: organizer.flutterwaveSecretKey
          ? `${organizer.flutterwaveSecretKey.slice(0, 8)}${"•".repeat(20)}`
          : "",
        hasFlutterwave: !!(organizer.flutterwavePublicKey && organizer.flutterwaveSecretKey),
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PUT /api/organizer/payment-settings ────────────────────────────────────
  app.put("/api/organizer/payment-settings", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(404).json({ message: "Organizer not found" });
      if (organizer.tier !== "pro") {
        return res.status(403).json({ message: "Flutterwave payments require Pro plan", code: "TIER_REQUIRED" });
      }

      const parsed = flutterwaveSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      await storage.updateOrganizerGateways(organizer.id, {
        flutterwavePublicKey: parsed.data.flutterwavePublicKey,
        flutterwaveSecretKey: parsed.data.flutterwaveSecretKey,
      });

      return res.json({ message: "Flutterwave keys saved" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
