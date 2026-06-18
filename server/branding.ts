import type { Express } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { requireAuth, type AuthRequest } from "./auth";
import { storage } from "./storage";
import { z } from "zod";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BRANDING_BUCKET = "Branding";

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

async function uploadToSupabase(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BRANDING_BUCKET}/${filename}`;
  console.log(`[branding] uploading to Supabase Storage: ${uploadUrl}`);

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": mimeType,
      "x-upsert": "true",
    },
    body: buffer,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[branding] Supabase upload failed (${res.status}):`, err);
    throw new Error(`Supabase Storage upload failed: ${res.status}`);
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BRANDING_BUCKET}/${filename}`;
  console.log(`[branding] upload succeeded, public URL: ${publicUrl}`);
  return publicUrl;
}

export function registerBrandingRoutes(app: Express) {
  // ── GET /api/branding/settings ──────────────────────────────────────────
  app.get("/api/branding/settings", requireAuth, async (req: AuthRequest, res) => {
    try {
      console.log("[branding] GET settings for userId:", req.userId);
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(404).json({ message: "Organizer not found" });
      return res.json({
        customBrandName: organizer.customBrandName,
        customLogoUrl: organizer.customLogoUrl,
        brandTheme: organizer.brandTheme,
        tier: organizer.tier,
      });
    } catch (err: any) {
      console.error("[branding] GET settings error:", err);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PUT /api/branding/settings (Pro only) ───────────────────────────────
  app.put("/api/branding/settings", requireAuth, async (req: AuthRequest, res) => {
    try {
      console.log("[branding] PUT settings for userId:", req.userId);
      const organizer = await storage.getOrganizerByUserId(req.userId!);
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
      console.error("[branding] PUT settings error:", err);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/branding/logo-upload (Pro only) ───────────────────────────
  // Receives the logo file, uploads it to Supabase 'Branding' bucket,
  // persists the public URL, and returns it.
  app.post(
    "/api/branding/logo-upload",
    requireAuth,
    upload.single("logo"),
    async (req: AuthRequest, res) => {
      try {
        console.log("[branding] logo-upload for userId:", req.userId);
        const organizer = await storage.getOrganizerByUserId(req.userId!);
        if (!organizer) return res.status(404).json({ message: "Organizer not found" });
        if (organizer.tier !== "pro") {
          return res.status(403).json({ message: "Logo upload requires Pro plan", code: "TIER_REQUIRED" });
        }

        const file = req.file;
        if (!file) return res.status(400).json({ message: "No file provided" });

        const ext = file.originalname.split(".").pop()?.toLowerCase() || "png";
        const filename = `logos/${organizer.id}/${randomUUID()}.${ext}`;
        const logoUrl = await uploadToSupabase(file.buffer, file.mimetype, filename);

        await storage.updateOrganizerBranding(organizer.id, {
          customBrandName: organizer.customBrandName ?? null,
          customLogoUrl: logoUrl,
          brandTheme: organizer.brandTheme ?? null,
        });

        return res.json({ logoUrl });
      } catch (err: any) {
        console.error("[branding] logo-upload error:", err);
        return res.status(500).json({ message: err.message });
      }
    }
  );
}
