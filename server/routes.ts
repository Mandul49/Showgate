import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertOrderSchema, eventConfigSchema } from "@shared/schema";
import { registerAuthRoutes, requireAuth } from "./auth";
import { registerOnboardingRoutes } from "./onboarding";
import { registerEventsRoutes } from "./events";
import { registerCheckoutRoutes } from "./checkout";
import { registerUpgradeRoutes, registerUpgradeWebhook, startSubscriptionCron } from "./upgrade";
import { registerBrandingRoutes } from "./branding";
import { getPaystackSecretKey } from "./paystackConfig";
import { registerAnalyticsRoutes } from "./analytics";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { registerOgRoutes } from "./og";
import { registerDiscountRoutes } from "./discounts";
import { registerAdminRoutes } from "./admin";
import { sendConfirmationEmail, sendTestEmail } from "./email";

export async function registerRoutes(app: Express): Promise<Server> {
  // ─── OG / Social preview (must be before Vite catch-all) ─────────────────
  registerOgRoutes(app);

  // ─── Auth ─────────────────────────────────────────────────────────────────
  registerAuthRoutes(app);

  // ─── Onboarding ───────────────────────────────────────────────────────────
  registerOnboardingRoutes(app);

  // ─── Events ───────────────────────────────────────────────────────────────
  registerEventsRoutes(app);

  // ─── Checkout & Webhooks ──────────────────────────────────────────────────
  registerCheckoutRoutes(app);

  // ─── Upgrade / Subscriptions ──────────────────────────────────────────────
  registerUpgradeWebhook(app);
  registerUpgradeRoutes(app);
  startSubscriptionCron();

  // ─── Branding ─────────────────────────────────────────────────────────────
  registerBrandingRoutes(app);

  // ─── Analytics ────────────────────────────────────────────────────────────
  registerAnalyticsRoutes(app);

  // ─── Discount Codes ───────────────────────────────────────────────────────
  registerDiscountRoutes(app);

  // ─── Admin ────────────────────────────────────────────────────────────────
  registerAdminRoutes(app);

  // ─── Object Storage (logo uploads) ───────────────────────────────────────
  registerObjectStorageRoutes(app);

  // ─── Public settings ─────────────────────────────────────────────────────
  app.get("/api/settings/public", async (_req, res) => {
    try {
      const [maintenanceVal, feeVal, proTicketFeeVal, monthlyKoboVal, yearlyKoboVal] = await Promise.all([
        storage.getPlatformSetting("maintenance_mode", "false"),
        storage.getPlatformSetting("platform_fee_percent", "2"),
        storage.getPlatformSetting("pro_ticket_fee_percent", "2"),
        storage.getPlatformSetting("pro_monthly_price_kobo", "1000000"),
        storage.getPlatformSetting("pro_yearly_price_kobo", "10000000"),
      ]);
      return res.json({
        maintenanceMode: maintenanceVal === "true",
        feePercent: parseFloat(feeVal) || 2,
        freeFeePercent: 2.5,
        proTicketFeePercent: parseFloat(proTicketFeeVal) || 2,
        proMonthlyNaira: Math.round(parseInt(monthlyKoboVal, 10) / 100) || 10000,
        proYearlyNaira: Math.round(parseInt(yearlyKoboVal, 10) / 100) || 100000,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ─── Config (public read, protected write) ────────────────────────────────

  app.get("/api/config", async (_req, res) => {
    try {
      const config = await storage.getEventConfig();
      const { paystackSecretKey: _ps, ...publicConfig } = config;
      return res.json(publicConfig);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/config/admin", requireAuth, async (_req, res) => {
    try {
      const config = await storage.getEventConfig();
      return res.json({
        ...config,
        paystackSecretKey: config.paystackSecretKey ? "__SET__" : "",
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/config", requireAuth, async (req, res) => {
    try {
      const parsed = eventConfigSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid configuration", errors: parsed.error.errors });

      // Preserve existing secret keys if the client sent back the sentinel or blank
      const existing = await storage.getEventConfig();
      const data = { ...parsed.data };
      if (!data.paystackSecretKey || data.paystackSecretKey === "__SET__") data.paystackSecretKey = existing.paystackSecretKey;
      const saved = await storage.saveEventConfig(data);
      const { paystackSecretKey: _ps, ...publicConfig } = saved;
      return res.json(publicConfig);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ─── Test email (diagnostic) ──────────────────────────────────────────────
  app.get("/api/test-email", async (_req, res) => {
    const result = await sendTestEmail("manduljohnson@gmail.com");
    console.log(`[test-email] ${result.ok ? "SUCCESS" : "FAILED"}: ${result.detail}`);
    return res.json(result);
  });

  // ─── Public Stats ──────────────────────────────────────────────────────────

  app.get("/api/stats", async (_req, res) => {
    try {
      const stats = await storage.getPublicStats();
      return res.json(stats);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ─── Availability ─────────────────────────────────────────────────────────

  app.get("/api/tickets/availability", async (_req, res) => {
    try {
      const config = await storage.getEventConfig();
      const sold = await storage.getTotalTicketsSold();
      return res.json({ total: config.totalTickets, sold, remaining: Math.max(0, config.totalTickets - sold) });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ─── Paystack ─────────────────────────────────────────────────────────────

  app.post("/api/payments/paystack/verify", async (req, res) => {
    try {
      const { reference, orderData } = req.body;
      if (!reference || !orderData) return res.status(400).json({ message: "Missing reference or order data" });

      const config = await storage.getEventConfig();
      const secretKey = config.paystackSecretKey || getPaystackSecretKey();
      if (!secretKey) return res.status(500).json({ message: "Paystack secret key not configured" });

      const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      if (!paystackRes.ok) return res.status(400).json({ message: "Payment verification failed" });

      const paystackData: any = await paystackRes.json();
      if (!paystackData.status || paystackData.data?.status !== "success")
        return res.status(400).json({ message: "Payment was not successful" });

      if (paystackData.data.amount < orderData.totalAmount * 100)
        return res.status(400).json({ message: "Payment amount mismatch" });

      const sold = await storage.getTotalTicketsSold();
      if (sold + orderData.quantity > config.totalTickets)
        return res.status(400).json({ message: "Not enough tickets remaining" });

      const parsed = insertOrderSchema.safeParse(orderData);
      if (!parsed.success) return res.status(400).json({ message: "Invalid order data" });

      const order = await storage.createOrder(parsed.data, "confirmed");

      if (order.customerEmail) {
        const event = order.eventId ? await storage.getEventById(order.eventId) : null;
        sendConfirmationEmail({
          to: order.customerEmail,
          buyerName: order.customerName,
          eventTitle: event?.title ?? "Your Event",
          eventDate: event?.date,
          eventLocation: event?.location,
          ticketTypeName: order.ticketType,
          quantity: order.quantity,
          amount: order.totalAmount,
          reference: order.id,
        }).catch(console.error);
      }

      return res.status(201).json(order);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Legacy alias
  app.post("/api/payments/verify", async (req, res) => {
    req.url = "/api/payments/paystack/verify";
    return app._router.handle(req, res, () => {});
  });

  // ─── Bank Transfer ────────────────────────────────────────────────────────

  app.post("/api/payments/bank-transfer", async (req, res) => {
    try {
      const { orderData } = req.body;
      if (!orderData) return res.status(400).json({ message: "Missing order data" });

      const config = await storage.getEventConfig();
      const sold = await storage.getTotalTicketsSold();
      if (sold + orderData.quantity > config.totalTickets)
        return res.status(400).json({ message: "Not enough tickets remaining" });

      const parsed = insertOrderSchema.safeParse(orderData);
      if (!parsed.success) return res.status(400).json({ message: "Invalid order data" });

      const order = await storage.createOrder(parsed.data, "awaiting_transfer");

      if (order.customerEmail) {
        const event = order.eventId ? await storage.getEventById(order.eventId) : null;
        sendConfirmationEmail({
          to: order.customerEmail,
          buyerName: order.customerName,
          eventTitle: event?.title ?? config.eventName ?? "Your Event",
          eventDate: event?.date ?? config.eventDate,
          eventLocation: event?.location ?? config.eventVenue,
          ticketTypeName: order.ticketType,
          quantity: order.quantity,
          amount: order.totalAmount,
          reference: order.id,
          isBankTransfer: true,
          bankName: config.bankName,
          accountNumber: config.bankAccountNumber,
          accountName: config.bankAccountName,
        }).catch(console.error);
      }

      return res.status(201).json(order);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ─── Orders ───────────────────────────────────────────────────────────────

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      return res.json(order);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
