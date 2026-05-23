import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import { insertOrderSchema, eventConfigSchema } from "@shared/schema";
import { registerAuthRoutes, requireAuth } from "./auth";
import { registerOnboardingRoutes } from "./onboarding";
import { registerEventsRoutes } from "./events";
import { registerCheckoutRoutes } from "./checkout";
import { registerUpgradeRoutes, startSubscriptionCron } from "./upgrade";
import { registerBrandingRoutes } from "./branding";

async function getPaypalAccessToken(clientId: string, secret: string): Promise<string> {
  const res = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  const data: any = await res.json();
  if (!data.access_token) throw new Error("Failed to get PayPal access token");
  return data.access_token;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ─── Auth ─────────────────────────────────────────────────────────────────
  registerAuthRoutes(app);

  // ─── Onboarding ───────────────────────────────────────────────────────────
  registerOnboardingRoutes(app);

  // ─── Events ───────────────────────────────────────────────────────────────
  registerEventsRoutes(app);

  // ─── Checkout & Webhooks ──────────────────────────────────────────────────
  registerCheckoutRoutes(app);

  // ─── Upgrade / Subscriptions ──────────────────────────────────────────────
  registerUpgradeRoutes(app);
  startSubscriptionCron();

  // ─── Branding ─────────────────────────────────────────────────────────────
  registerBrandingRoutes(app);

  // ─── Config (public read, protected write) ────────────────────────────────

  app.get("/api/config", async (_req, res) => {
    try {
      const config = await storage.getEventConfig();
      const { paystackSecretKey: _ps, stripeSecretKey: _ss, paypalSecretKey: _pp, ...publicConfig } = config;
      return res.json(publicConfig);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/config/admin", requireAuth, async (_req, res) => {
    try {
      return res.json(await storage.getEventConfig());
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/config", requireAuth, async (req, res) => {
    try {
      const parsed = eventConfigSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid configuration", errors: parsed.error.errors });
      const saved = await storage.saveEventConfig(parsed.data);
      const { paystackSecretKey: _ps, stripeSecretKey: _ss, paypalSecretKey: _pp, ...publicConfig } = saved;
      return res.json(publicConfig);
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
      const secretKey = config.paystackSecretKey || process.env.PAYSTACK_SECRET_KEY;
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

  // ─── Stripe ───────────────────────────────────────────────────────────────

  app.post("/api/payments/stripe/create-intent", async (req, res) => {
    try {
      const { amount, currency, customerEmail, metadata } = req.body;
      const config = await storage.getEventConfig();
      const secretKey = config.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
      if (!secretKey) return res.status(500).json({ message: "Stripe secret key not configured" });

      const stripe = new Stripe(secretKey);
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: (currency || "usd").toLowerCase(),
        receipt_email: customerEmail,
        metadata,
      });

      return res.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/payments/stripe/verify", async (req, res) => {
    try {
      const { paymentIntentId, orderData } = req.body;
      if (!paymentIntentId || !orderData) return res.status(400).json({ message: "Missing data" });

      const config = await storage.getEventConfig();
      const secretKey = config.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
      if (!secretKey) return res.status(500).json({ message: "Stripe secret key not configured" });

      const stripe = new Stripe(secretKey);
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (intent.status !== "succeeded") return res.status(400).json({ message: "Payment not completed" });

      const sold = await storage.getTotalTicketsSold();
      if (sold + orderData.quantity > config.totalTickets)
        return res.status(400).json({ message: "Not enough tickets remaining" });

      const parsed = insertOrderSchema.safeParse(orderData);
      if (!parsed.success) return res.status(400).json({ message: "Invalid order data" });

      const order = await storage.createOrder(parsed.data, "confirmed");
      return res.status(201).json(order);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ─── PayPal ───────────────────────────────────────────────────────────────

  app.post("/api/payments/paypal/create-order", async (req, res) => {
    try {
      const { amount, currency } = req.body;
      const config = await storage.getEventConfig();
      const clientId = config.paypalClientId || process.env.PAYPAL_CLIENT_ID;
      const secret = config.paypalSecretKey || process.env.PAYPAL_SECRET_KEY;
      if (!clientId || !secret) return res.status(500).json({ message: "PayPal not configured" });

      const accessToken = await getPaypalAccessToken(clientId, secret);
      const orderRes = await fetch("https://api-m.paypal.com/v2/checkout/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{ amount: { currency_code: (currency || "USD").toUpperCase(), value: amount.toFixed(2) } }],
        }),
      });

      const orderData: any = await orderRes.json();
      if (!orderRes.ok) return res.status(400).json({ message: orderData.message || "Failed to create PayPal order" });
      return res.json({ id: orderData.id });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/payments/paypal/capture", async (req, res) => {
    try {
      const { paypalOrderId, orderData } = req.body;
      if (!paypalOrderId || !orderData) return res.status(400).json({ message: "Missing data" });

      const config = await storage.getEventConfig();
      const clientId = config.paypalClientId || process.env.PAYPAL_CLIENT_ID;
      const secret = config.paypalSecretKey || process.env.PAYPAL_SECRET_KEY;
      if (!clientId || !secret) return res.status(500).json({ message: "PayPal not configured" });

      const accessToken = await getPaypalAccessToken(clientId, secret);
      const captureRes = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${paypalOrderId}/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      });

      const captureData: any = await captureRes.json();
      if (!captureRes.ok || captureData.status !== "COMPLETED")
        return res.status(400).json({ message: "PayPal payment not completed" });

      const sold = await storage.getTotalTicketsSold();
      if (sold + orderData.quantity > config.totalTickets)
        return res.status(400).json({ message: "Not enough tickets remaining" });

      const parsed = insertOrderSchema.safeParse(orderData);
      if (!parsed.success) return res.status(400).json({ message: "Invalid order data" });

      const order = await storage.createOrder(parsed.data, "confirmed");
      return res.status(201).json(order);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
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
