import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertOrderSchema, eventConfigSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/config", async (_req, res) => {
    try {
      const config = await storage.getEventConfig();
      const { paystackSecretKey: _secret, ...publicConfig } = config;
      return res.json(publicConfig);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Internal server error" });
    }
  });

  app.get("/api/config/admin", async (_req, res) => {
    try {
      const config = await storage.getEventConfig();
      return res.json(config);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Internal server error" });
    }
  });

  app.post("/api/config", async (req, res) => {
    try {
      const parsed = eventConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid configuration", errors: parsed.error.errors });
      }
      const saved = await storage.saveEventConfig(parsed.data);
      const { paystackSecretKey: _secret, ...publicConfig } = saved;
      return res.json(publicConfig);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Internal server error" });
    }
  });

  app.get("/api/tickets/availability", async (_req, res) => {
    try {
      const config = await storage.getEventConfig();
      const sold = await storage.getTotalTicketsSold();
      const total = config.totalTickets;
      return res.json({ total, sold, remaining: Math.max(0, total - sold) });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Internal server error" });
    }
  });

  app.post("/api/payments/verify", async (req, res) => {
    try {
      const { reference, orderData } = req.body;
      if (!reference || !orderData) {
        return res.status(400).json({ message: "Missing reference or order data" });
      }

      const config = await storage.getEventConfig();
      const secretKey = config.paystackSecretKey || process.env.PAYSTACK_SECRET_KEY;
      if (!secretKey) {
        return res.status(500).json({ message: "Payment configuration error: secret key not set" });
      }

      const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });

      if (!paystackRes.ok) {
        return res.status(400).json({ message: "Payment verification failed" });
      }

      const paystackData: any = await paystackRes.json();

      if (!paystackData.status || paystackData.data?.status !== "success") {
        return res.status(400).json({ message: "Payment was not successful" });
      }

      const expectedAmountKobo = orderData.totalAmount * 100;
      if (paystackData.data.amount < expectedAmountKobo) {
        return res.status(400).json({ message: "Payment amount mismatch" });
      }

      const sold = await storage.getTotalTicketsSold();
      if (sold + orderData.quantity > config.totalTickets) {
        return res.status(400).json({ message: "Not enough tickets remaining" });
      }

      const parsed = insertOrderSchema.safeParse(orderData);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid order data", errors: parsed.error.errors });
      }

      const order = await storage.createOrder(parsed.data);
      return res.status(201).json(order);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Internal server error" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      return res.json(order);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
