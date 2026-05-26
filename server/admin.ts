import type { Express, Response } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { requireAdmin, requireAdminRole, type AuthRequest } from "./auth";
import type { AdminRole } from "@shared/schema";

// ── Permission gates ──────────────────────────────────────────────────────────
const SUPER_ONLY     = requireAdminRole(["super_admin"]);
const FINANCE_ACCESS = requireAdminRole(["super_admin", "finance"]);
const SUPPORT_ACCESS = requireAdminRole(["super_admin", "admin", "support"]);

// ── Audit helper ──────────────────────────────────────────────────────────────
function audit(
  req: AuthRequest,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: Record<string, unknown>
) {
  storage
    .logAdminAction(req.userEmail!, action, targetType, targetId, details)
    .catch(err => console.error("[audit]", err));
}

function isSuperAdmin(req: AuthRequest) {
  return req.userAdminRoles?.includes("super_admin") ?? false;
}

export function registerAdminRoutes(app: Express) {

  // ── Overview & users (all admin roles) ───────────────────────────────────

  app.get("/api/admin/stats", requireAdmin, async (_req: AuthRequest, res) => {
    try { return res.json(await storage.getAdminStats()); }
    catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  app.get("/api/admin/users", requireAdmin, async (_req: AuthRequest, res) => {
    try { return res.json(await storage.getAllUsers()); }
    catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  app.get("/api/admin/env-keys", requireAdmin, async (_req: AuthRequest, res) => {
    const prefixes = ["PAYSTACK", "RESEND", "BREVO", "STRIPE", "PAYPAL", "VITE_", "DATABASE", "OBJECT_STORAGE", "REPL_", "DEFAULT_OBJECT", "PRIVATE_OBJECT", "PUBLIC_OBJECT", "NODE_ENV", "PORT"];
    const keys = Object.keys(process.env).filter(k => prefixes.some(p => k.startsWith(p))).sort();
    return res.json({ keys });
  });

  // ── Organizers & Events (super_admin + admin + support) ───────────────────

  app.get("/api/admin/organizers", requireAdmin, SUPPORT_ACCESS, async (_req: AuthRequest, res) => {
    try { return res.json(await storage.getAdminOrganizers()); }
    catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  app.get("/api/admin/organizers/:id", requireAdmin, SUPPORT_ACCESS, async (req: AuthRequest, res) => {
    try {
      const data = await storage.getAdminOrganizerDetail(req.params.id);
      if (!data) return res.status(404).json({ message: "Organizer not found" });
      return res.json(data);
    } catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  app.get("/api/admin/events", requireAdmin, SUPPORT_ACCESS, async (_req: AuthRequest, res) => {
    try { return res.json(await storage.getAllEventsAdmin()); }
    catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  // Mutations — super_admin + admin only (not support)
  app.patch("/api/admin/users/:id/tier", requireAdmin, requireAdminRole(["super_admin", "admin"]), async (req: AuthRequest, res) => {
    try {
      const schema = z.object({ tier: z.enum(["free", "pro"]), lifetime: z.boolean().optional() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      const { tier, lifetime } = parsed.data;
      const proExpiresAt = tier === "pro" && !lifetime ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null;
      const user = await storage.updateUserTier(req.params.id, tier, tier === "free" ? null : proExpiresAt);
      const organizer = await storage.getOrganizerByUserId(req.params.id);
      if (organizer) await storage.updateOrganizerTier(organizer.id, tier);
      audit(req, tier === "pro" ? "grant_pro" : "revoke_pro", "user", req.params.id, { tier, lifetime: lifetime ?? false });
      return res.json(user);
    } catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/admin/users/:id/role", requireAdmin, SUPER_ONLY, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({ role: z.enum(["organizer", "admin"]) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      if (req.params.id === req.userId) return res.status(400).json({ message: "Cannot change your own role" });
      const user = await storage.setUserRole(req.params.id, parsed.data.role);
      audit(req, "set_role", "user", req.params.id, { role: parsed.data.role });
      return res.json(user);
    } catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/admin/users/:id/suspend", requireAdmin, requireAdminRole(["super_admin", "admin"]), async (req: AuthRequest, res) => {
    try {
      const schema = z.object({ suspended: z.boolean() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      if (req.params.id === req.userId) return res.status(400).json({ message: "Cannot suspend your own account" });
      const user = await storage.suspendUser(req.params.id, parsed.data.suspended);
      audit(req, parsed.data.suspended ? "suspend_user" : "unsuspend_user", "user", req.params.id);
      return res.json(user);
    } catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/admin/users/:id", requireAdmin, SUPER_ONLY, async (req: AuthRequest, res) => {
    try {
      if (req.params.id === req.userId) return res.status(400).json({ message: "Cannot delete your own account" });
      await storage.deleteUserAccount(req.params.id);
      audit(req, "delete_user", "user", req.params.id);
      return res.json({ message: "User deleted" });
    } catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/admin/events/:id/suspend", requireAdmin, requireAdminRole(["super_admin", "admin"]), async (req: AuthRequest, res) => {
    try {
      const { suspended } = req.body;
      if (typeof suspended !== "boolean") return res.status(400).json({ message: "suspended must be a boolean" });
      const event = await storage.adminSuspendEvent(req.params.id, suspended);
      audit(req, suspended ? "suspend_event" : "unsuspend_event", "event", req.params.id);
      return res.json(event);
    } catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/admin/events/:id", requireAdmin, SUPER_ONLY, async (req: AuthRequest, res) => {
    try {
      await storage.adminDeleteEvent(req.params.id);
      audit(req, "delete_event", "event", req.params.id);
      return res.json({ message: "Event deleted" });
    } catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  // ── Analytics & Subscriptions (super_admin + finance) ─────────────────────

  app.get("/api/admin/analytics", requireAdmin, FINANCE_ACCESS, async (_req: AuthRequest, res) => {
    try { return res.json(await storage.getAdminAnalytics()); }
    catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  app.get("/api/admin/charts", requireAdmin, FINANCE_ACCESS, async (_req: AuthRequest, res) => {
    try { return res.json(await storage.getAdminChartData()); }
    catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  app.get("/api/admin/subscriptions", requireAdmin, FINANCE_ACCESS, async (_req: AuthRequest, res) => {
    try { return res.json(await storage.getAdminSubscriptions()); }
    catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/admin/subscriptions/:userId/extend", requireAdmin, FINANCE_ACCESS, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({ months: z.number().int().min(1).max(24) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      const user = await storage.extendSubscription(req.params.userId, parsed.data.months);
      audit(req, "extend_subscription", "user", req.params.userId, { months: parsed.data.months });
      return res.json(user);
    } catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/admin/subscriptions/:userId/cancel", requireAdmin, FINANCE_ACCESS, async (req: AuthRequest, res) => {
    try {
      const user = await storage.cancelSubscription(req.params.userId);
      audit(req, "cancel_subscription", "user", req.params.userId);
      return res.json(user);
    } catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/admin/subscriptions/:userId/reinstate", requireAdmin, FINANCE_ACCESS, async (req: AuthRequest, res) => {
    try {
      const user = await storage.reinstateSubscription(req.params.userId);
      audit(req, "reinstate_subscription", "user", req.params.userId);
      return res.json(user);
    } catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/admin/subscriptions/:userId/upgrade-yearly", requireAdmin, FINANCE_ACCESS, async (req: AuthRequest, res) => {
    try {
      const user = await storage.upgradeToYearly(req.params.userId);
      audit(req, "upgrade_to_yearly", "user", req.params.userId);
      return res.json(user);
    } catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  app.post("/api/admin/subscriptions/:userId/grant-free", requireAdmin, FINANCE_ACCESS, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({ note: z.string().min(1).max(500) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      const user = await storage.grantFreePro(req.params.userId, req.userId!, parsed.data.note);
      audit(req, "grant_free_pro", "user", req.params.userId, { note: parsed.data.note });
      return res.json(user);
    } catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  // ── Platform Settings (super_admin only) ──────────────────────────────────

  app.get("/api/admin/settings", requireAdmin, SUPER_ONLY, async (_req: AuthRequest, res) => {
    try { return res.json(await storage.getAllPlatformSettings()); }
    catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/admin/settings/:key", requireAdmin, SUPER_ONLY, async (req: AuthRequest, res) => {
    try {
      const { key } = req.params;
      const { value } = req.body;
      if (typeof value !== "string") return res.status(400).json({ message: "value must be a string" });
      const allowed = ["platform_fee_percent", "pro_monthly_price_kobo", "pro_yearly_price_kobo", "free_max_monthly_tickets", "free_max_active_events", "maintenance_mode"];
      if (!allowed.includes(key)) return res.status(400).json({ message: "Unknown setting key" });
      await storage.setPlatformSetting(key, value);
      audit(req, "update_setting", "setting", key, { value });
      return res.json({ key, value });
    } catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  // ── Admin Team Management (super_admin only) ──────────────────────────────

  app.get("/api/admin/team", requireAdmin, SUPER_ONLY, async (_req: AuthRequest, res) => {
    try { return res.json(await storage.getAdminTeam()); }
    catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  // Grant admin access to a user by email (or add a role if already admin)
  app.post("/api/admin/team", requireAdmin, SUPER_ONLY, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        email: z.string().email("Enter a valid email address"),
        role: z.enum(["super_admin", "admin", "support", "finance"]),
        note: z.string().max(500).optional().default(""),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      const { email, role, note } = parsed.data;

      if (role === "super_admin" && !isSuperAdmin(req)) {
        return res.status(403).json({ message: "Only super admins can grant super_admin role" });
      }

      const target = await storage.getUserByEmail(email);
      if (!target) {
        return res.status(404).json({ message: "No account found with that email. They must sign up first." });
      }

      const user = await storage.grantAdminAccess(target.id, role, req.userEmail!, note);
      audit(req, "grant_admin_access", "user", target.id, { role, note, email });
      return res.status(201).json(user);
    } catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  // Add an additional role to an existing admin (by userId)
  app.post("/api/admin/team/:userId/roles", requireAdmin, SUPER_ONLY, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        role: z.enum(["super_admin", "admin", "support", "finance"]),
        note: z.string().max(500).optional().default(""),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      const { role, note } = parsed.data;

      if (role === "super_admin" && !isSuperAdmin(req)) {
        return res.status(403).json({ message: "Only super admins can grant super_admin role" });
      }

      const target = await storage.getUserById(req.params.userId);
      if (!target || target.role !== "admin") {
        return res.status(404).json({ message: "Admin user not found" });
      }

      const user = await storage.addAdminRole(req.params.userId, role, req.userEmail!, note);
      audit(req, "add_admin_role", "user", req.params.userId, { role, note });
      return res.json(user);
    } catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  // Remove a specific role from an admin (auto-reverts to organizer if last role)
  app.delete("/api/admin/team/:userId/roles/:role", requireAdmin, SUPER_ONLY, async (req: AuthRequest, res) => {
    try {
      const role = req.params.role as AdminRole;
      const validRoles: AdminRole[] = ["super_admin", "admin", "support", "finance"];
      if (!validRoles.includes(role)) return res.status(400).json({ message: "Invalid role" });

      // Super admin cannot remove their own super_admin role
      if (req.params.userId === req.userId && role === "super_admin") {
        return res.status(400).json({ message: "Cannot remove your own super_admin role" });
      }

      const target = await storage.getUserById(req.params.userId);
      if (!target || target.role !== "admin") {
        return res.status(404).json({ message: "Admin user not found" });
      }

      const user = await storage.removeAdminRole(req.params.userId, role);
      audit(req, "remove_admin_role", "user", req.params.userId, { role, email: target.email });
      return res.json(user);
    } catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  // Remove ALL roles (reverts user to organizer)
  app.delete("/api/admin/team/:userId", requireAdmin, SUPER_ONLY, async (req: AuthRequest, res) => {
    try {
      if (req.params.userId === req.userId) {
        return res.status(400).json({ message: "Cannot remove your own admin access" });
      }
      const target = await storage.getUserById(req.params.userId);
      if (!target || target.role !== "admin") {
        return res.status(404).json({ message: "Admin user not found" });
      }
      const user = await storage.removeAdminAccess(req.params.userId);
      audit(req, "remove_admin_access", "user", req.params.userId, { email: target.email });
      return res.json(user);
    } catch (err: any) { return res.status(500).json({ message: err.message }); }
  });

  // ── Catch-all: must be last ───────────────────────────────────────────────
  app.all("/api/admin/*", requireAdmin, (_req: AuthRequest, res: Response) => {
    return res.status(404).json({ message: "Not found" });
  });
}
