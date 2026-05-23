import type { Express } from "express";
import { requireAuth } from "./auth";
import { storage } from "./storage";
import { z } from "zod";

const brandingSchema = z.object({
  customBrandName: z.string().max(80).nullable(),
  customLogoUrl: z.string().url("Must be a valid URL").nullable().or(z.literal("").transform(() => null)),
});

export function registerBrandingRoutes(app: Express) {
  // ── GET /api/branding/settings ──────────────────────────────────────────
  app.get("/api/branding/settings", requireAuth, async (req: any, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.user.id);
      if (!organizer) return res.status(404).json({ message: "Organizer not found" });
      return res.json({
        customBrandName: organizer.customBrandName,
        customLogoUrl: organizer.customLogoUrl,
        tier: organizer.tier,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PUT /api/branding/settings (Pro only) ───────────────────────────────
  app.put("/api/branding/settings", requireAuth, async (req: any, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.user.id);
      if (!organizer) return res.status(404).json({ message: "Organizer not found" });
      if (organizer.tier !== "pro") {
        return res.status(403).json({ message: "Upgrade to Pro to use custom branding" });
      }

      const parsed = brandingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const updated = await storage.updateOrganizerBranding(organizer.id, {
        customBrandName: parsed.data.customBrandName || null,
        customLogoUrl: parsed.data.customLogoUrl || null,
      });

      return res.json({
        customBrandName: updated.customBrandName,
        customLogoUrl: updated.customLogoUrl,
        tier: updated.tier,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
