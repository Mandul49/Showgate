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

  app.get("/api/admin/settings", requireAdmin, async (_req: AuthRequest, res) => {
    try {
      const settings = await storage.getAllPlatformSettings();
      return res.json(settings);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/settings/:key", requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { key } = req.params;
      const { value } = req.body;
      if (typeof value !== "string") return res.status(400).json({ message: "value must be a string" });
      const allowed = ["platform_fee_percent","pro_monthly_price_kobo","pro_yearly_price_kobo","free_max_monthly_tickets","free_max_active_events","maintenance_mode"];
      if (!allowed.includes(key)) return res.status(400).json({ message: "Unknown setting key" });
      await storage.setPlatformSetting(key, value);
      return res.json({ key, value });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/env-keys", requireAdmin, async (_req: AuthRequest, res) => {
    const relevantPrefixes = ["PAYSTACK","RESEND","BREVO","STRIPE","PAYPAL","VITE_","DATABASE","OBJECT_STORAGE","REPL_","DEFAULT_OBJECT","PRIVATE_OBJECT","PUBLIC_OBJECT","NODE_ENV","PORT"];
    const keys = Object.keys(process.env).filter(k =>
      relevantPrefixes.some(p => k.startsWith(p))
    ).sort();
    return res.json({ keys });
  });

  app.get("/api/admin/analytics", requireAdmin, async (_req: AuthRequest, res) => {
    try {
      const data = await storage.getAdminAnalytics();
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/events/:id/suspend", requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { suspended } = req.body;
      if (typeof suspended !== "boolean") return res.status(400).json({ message: "suspended must be a boolean" });
      const event = await storage.adminSuspendEvent(req.params.id, suspended);
      return res.json(event);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/events/:id", requireAdmin, async (req: AuthRequest, res) => {
    try {
      await storage.adminDeleteEvent(req.params.id);
      return res.json({ message: "Event deleted" });
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

  app.get("/api/admin/subscriptions", requireAdmin, async (_req: AuthRequest, res) => {
    try {
      const data = await storage.getAdminSubscriptions();
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/subscriptions/:userId/extend", requireAdmin, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({ months: z.number().int().min(1).max(24) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      const user = await storage.extendSubscription(req.params.userId, parsed.data.months);
      return res.json(user);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/subscriptions/:userId/cancel", requireAdmin, async (req: AuthRequest, res) => {
    try {
      const user = await storage.cancelSubscription(req.params.userId);
      return res.json(user);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/subscriptions/:userId/reinstate", requireAdmin, async (req: AuthRequest, res) => {
    try {
      const user = await storage.reinstateSubscription(req.params.userId);
      return res.json(user);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/subscriptions/:userId/upgrade-yearly", requireAdmin, async (req: AuthRequest, res) => {
    try {
      const user = await storage.upgradeToYearly(req.params.userId);
      return res.json(user);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/subscriptions/:userId/grant-free", requireAdmin, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({ note: z.string().min(1, "Note is required").max(500) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      const user = await storage.grantFreePro(req.params.userId, req.userId!, parsed.data.note);
      return res.json(user);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
