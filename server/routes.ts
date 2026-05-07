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

  app.post("/api/orders", async (req, res) => {
    try {
      const parsed = insertOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid order data", errors: parsed.error.errors });
      }
      const sold = await storage.getTotalTicketsSold();
      if (sold + parsed.data.quantity > TOTAL_TICKETS) {
        return res.status(400).json({ message: "Not enough tickets remaining" });
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
