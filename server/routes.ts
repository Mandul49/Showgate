import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertOrderSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/orders", async (req, res) => {
    try {
      const parsed = insertOrderSchema.safeParse(req.body);
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
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      return res.json(order);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
