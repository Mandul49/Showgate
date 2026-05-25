import type { Express } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "./auth";
import { storage } from "./storage";
import { getPaystackSecretKey } from "./paystackConfig";


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

      const PAYSTACK_KEY = getPaystackSecretKey();
      if (!PAYSTACK_KEY) return res.status(500).json({ message: "Paystack API key not configured" });

      const r = await fetch(
        "https://api.paystack.co/bank?currency=NGN&per_page=200",
        { headers: { Authorization: `Bearer ${PAYSTACK_KEY}` } }
      );
      const data: any = await r.json();

      console.log(
        "[banks] Paystack response status:", r.status,
        "| banks returned:", data.data?.length ?? 0,
        "| first 3:", JSON.stringify((data.data || []).slice(0, 3).map((b: any) => ({ id: b.id, name: b.name, code: b.code })))
      );

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

      const PAYSTACK_KEY = getPaystackSecretKey();
      const paystackMode = process.env.PAYSTACK_ENV === "test" ? "test" : "live";

      console.log(`[onboarding] userId=${req.userId} mode=${paystackMode} key_present=${!!PAYSTACK_KEY} key_prefix=${PAYSTACK_KEY ? PAYSTACK_KEY.slice(0, 8) + "..." : "MISSING"}`);

      if (!PAYSTACK_KEY) {
        console.error(`[onboarding] ERROR: No Paystack ${paystackMode} secret key found. Expected env var: ${paystackMode === "live" ? "PAYSTACK_SECRET_KEY" : "PAYSTACK_TEST_SECRET_KEY"}`);
        return res.status(500).json({ message: `Paystack ${paystackMode} API key is not configured. Please contact support.` });
      }

      // Call Paystack Create Subaccount
      const payload: Record<string, any> = {
        business_name: businessName,
        settlement_bank: bankCode,
        account_number: accountNumber,
        percentage_charge: 2.5,
      };
      if (bvn) payload.metadata = { bvn };

      console.log(`[onboarding] Calling Paystack subaccount API (${paystackMode}) — business="${businessName}" bank_code="${bankCode}" account="${accountNumber}"`);

      const paystackRes = await fetch("https://api.paystack.co/subaccount", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PAYSTACK_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      const paystackData: any = await paystackRes.json();

      console.log(`[onboarding] Paystack response: HTTP ${paystackRes.status} status=${paystackData.status} message="${paystackData.message}" subaccount_code=${paystackData.data?.subaccount_code ?? "N/A"}`);

      if (!paystackRes.ok || !paystackData.status) {
        console.error(`[onboarding] Subaccount creation FAILED for userId=${req.userId}: HTTP ${paystackRes.status} — ${JSON.stringify(paystackData)}`);
        const reason = paystackData.message || `Paystack returned HTTP ${paystackRes.status}`;
        return res.status(400).json({
          message: `Payment account setup failed: ${reason}`,
        });
      }

      const subaccountCode: string = paystackData.data.subaccount_code;

      console.log(`[onboarding] Creating organizer row — userId=${req.userId} subaccountCode=${subaccountCode}`);

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

      console.log(`[onboarding] SUCCESS — organizerId=${organizer.id} userId=${organizer.userId} subaccountCode=${organizer.subaccountCode}`);

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
      console.error(`[onboarding] Unexpected error for userId=${req.userId}:`, err);
      return res.status(500).json({ message: err.message || "An unexpected error occurred during setup" });
    }
  });

  // ── POST /api/onboarding/setup-test-subaccount ────────────────────────────
  app.post("/api/onboarding/setup-test-subaccount", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(404).json({ message: "Organizer not found. Complete onboarding first." });

      const PAYSTACK_KEY = getPaystackSecretKey();
      if (!PAYSTACK_KEY) return res.status(500).json({ message: "Paystack test key not configured" });

      const payload: Record<string, any> = {
        business_name: organizer.businessName,
        settlement_bank: organizer.bankCode,
        account_number: organizer.accountNumber,
        percentage_charge: 2.5,
      };

      const paystackRes = await fetch("https://api.paystack.co/subaccount", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${PAYSTACK_KEY}` },
        body: JSON.stringify(payload),
      });

      const paystackData: any = await paystackRes.json();
      if (!paystackRes.ok || !paystackData.status) {
        return res.status(400).json({ message: paystackData.message || "Test subaccount creation failed" });
      }

      const testSubaccountCode: string = paystackData.data.subaccount_code;
      await storage.updateOrganizerTestSubaccount(organizer.id, testSubaccountCode);

      return res.json({ testSubaccountCode });
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
        bankCode: organizer.bankCode,
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

  // ── PUT /api/organizer/bank-account ─────────────────────────────────────────
  const updateBankSchema = z.object({
    bankCode: z.string().min(1, "Bank is required"),
    bankName: z.string().min(1, "Bank name is required"),
    accountNumber: z.string().regex(/^\d{10}$/, "Account number must be exactly 10 digits"),
  });

  app.put("/api/organizer/bank-account", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(404).json({ message: "Organizer not found. Complete onboarding first." });

      const parsed = updateBankSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      const { bankCode, bankName, accountNumber } = parsed.data;
      const PAYSTACK_KEY = getPaystackSecretKey();
      const paystackMode = process.env.PAYSTACK_ENV === "test" ? "test" : "live";

      if (!PAYSTACK_KEY) {
        return res.status(500).json({ message: `Paystack ${paystackMode} API key is not configured.` });
      }

      console.log(`[bank-update] userId=${req.userId} subaccountCode=${organizer.subaccountCode} bank_code=${bankCode} account=${accountNumber}`);

      const paystackRes = await fetch(`https://api.paystack.co/subaccount/${organizer.subaccountCode}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PAYSTACK_KEY}`,
        },
        body: JSON.stringify({
          settlement_bank: bankCode,
          account_number: accountNumber,
          business_name: organizer.businessName,
        }),
      });

      const paystackData: any = await paystackRes.json();
      console.log(`[bank-update] Paystack response: HTTP ${paystackRes.status} status=${paystackData.status} message="${paystackData.message}"`);

      if (!paystackRes.ok || !paystackData.status) {
        console.error(`[bank-update] FAILED for userId=${req.userId}: ${JSON.stringify(paystackData)}`);
        return res.status(400).json({
          message: `Bank account update failed: ${paystackData.message || `Paystack returned HTTP ${paystackRes.status}`}`,
        });
      }

      const updated = await storage.updateOrganizerBankAccount(organizer.id, { bankName, bankCode, accountNumber });
      console.log(`[bank-update] SUCCESS — organizerId=${organizer.id} bankName=${updated.bankName} account=${updated.accountNumber}`);

      return res.json({
        bankName: updated.bankName,
        bankCode: updated.bankCode,
        accountNumber: updated.accountNumber,
      });
    } catch (err: any) {
      console.error(`[bank-update] Unexpected error for userId=${req.userId}:`, err);
      return res.status(500).json({ message: err.message || "An unexpected error occurred" });
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
