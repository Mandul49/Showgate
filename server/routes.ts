import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertOrderSchema } from "@shared/schema";

const TOTAL_TICKETS = 250;

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/tickets/availability", async (_req, res) => {
    try {
      const sold = await storage.getTotalTicketsSold();
      return res.json({ total: TOTAL_TICKETS, sold, remaining: Math.max(0, TOTAL_TICKETS - sold) });
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

      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!secretKey) {
        return res.status(500).json({ message: "Payment configuration error" });
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
      if (sold + orderData.quantity > TOTAL_TICKETS) {
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
