import type { Express } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { requireAdmin, type AuthRequest } from "./auth";

export function registerAdminRoutes(app: Express) {

  app.get("/api/admin/stats", requireAdmin, async (_req: AuthRequest, res) => {
    try {
      const stats = await storage.getAdminStats();
      return res.json(stats);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (_req: AuthRequest, res) => {
    try {
      const users = await storage.getAllUsers();
      return res.json(users);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/users/:id/tier", requireAdmin, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        tier: z.enum(["free", "pro"]),
        lifetime: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      const { tier, lifetime } = parsed.data;
      const proExpiresAt = tier === "pro" && !lifetime
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        : null;
      const user = await storage.updateUserTier(req.params.id, tier, tier === "free" ? null : proExpiresAt);
      const organizer = await storage.getOrganizerByUserId(req.params.id);
      if (organizer) await storage.updateOrganizerTier(organizer.id, tier);
      return res.json(user);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/users/:id/role", requireAdmin, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({ role: z.enum(["organizer", "admin"]) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      if (req.params.id === req.userId) {
        return res.status(400).json({ message: "Cannot change your own role" });
      }
      const user = await storage.setUserRole(req.params.id, parsed.data.role);
      return res.json(user);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req: AuthRequest, res) => {
    try {
      if (req.params.id === req.userId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      await storage.deleteUserAccount(req.params.id);
      return res.json({ message: "User deleted" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/events", requireAdmin, async (_req: AuthRequest, res) => {
    try {
      const events = await storage.getAllEventsAdmin();
      return res.json(events);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/charts", requireAdmin, async (_req: AuthRequest, res) => {
    try {
      const data = await storage.getAdminChartData();
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/organizers", requireAdmin, async (_req: AuthRequest, res) => {
    try {
      const data = await storage.getAdminOrganizers();
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/organizers/:id", requireAdmin, async (req: AuthRequest, res) => {
    try {
      const data = await storage.getAdminOrganizerDetail(req.params.id);
      if (!data) return res.status(404).json({ message: "Organizer not found" });
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/users/:id/suspend", requireAdmin, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({ suspended: z.boolean() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      if (req.params.id === req.userId) {
        return res.status(400).json({ message: "Cannot suspend your own account" });
      }
      const user = await storage.suspendUser(req.params.id, parsed.data.suspended);
      return res.json(user);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
