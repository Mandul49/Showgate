import type { Express } from "express";
import { requireAuth } from "./auth";
import { storage } from "./storage";
import { z } from "zod";
import { ObjectStorageService } from "./replit_integrations/object_storage";

const objStorage = new ObjectStorageService();

const brandThemeSchema = z.object({
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  surface: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  text: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

const brandingSchema = z.object({
  customBrandName: z.string().max(80).nullable().optional(),
  customLogoUrl: z.string().nullable().optional(),
  brandTheme: brandThemeSchema.nullable().optional(),
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
        brandTheme: organizer.brandTheme,
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
        customBrandName: parsed.data.customBrandName ?? null,
        customLogoUrl: parsed.data.customLogoUrl ?? null,
        brandTheme: parsed.data.brandTheme ?? null,
      });

      return res.json({
        customBrandName: updated.customBrandName,
        customLogoUrl: updated.customLogoUrl,
        brandTheme: updated.brandTheme,
        tier: updated.tier,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/branding/logo-upload-url (Pro only) ───────────────────────
  // Returns a presigned PUT URL for uploading a logo directly to object storage.
  app.post("/api/branding/logo-upload-url", requireAuth, async (req: any, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.user.id);
      if (!organizer) return res.status(404).json({ message: "Organizer not found" });
      if (organizer.tier !== "pro") {
        return res.status(403).json({ message: "Logo upload requires Pro plan", code: "TIER_REQUIRED" });
      }

      const uploadURL = await objStorage.getObjectEntityUploadURL();
      const objectPath = objStorage.normalizeObjectEntityPath(uploadURL);

      return res.json({ uploadURL, objectPath });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
