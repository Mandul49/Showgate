import type { Express } from "express";
import { requireAuth, type AuthRequest } from "./auth";
import { storage } from "./storage";
import { createDiscountCodeSchema } from "@shared/schema";

export function registerDiscountRoutes(app: Express) {

  // ── GET /api/events/:id/discount-codes ────────────────────────────────────
  app.get("/api/events/:id/discount-codes", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(403).json({ message: "Complete onboarding first" });

      const event = await storage.getEventById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.organizerId !== organizer.id) return res.status(403).json({ message: "Not authorized" });

      const codes = await storage.getDiscountCodesByEventId(event.id);
      return res.json(codes);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/events/:id/discount-codes ───────────────────────────────────
  app.post("/api/events/:id/discount-codes", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(403).json({ message: "Complete onboarding first" });

      const event = await storage.getEventById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.organizerId !== organizer.id) return res.status(403).json({ message: "Not authorized" });

      const parsed = createDiscountCodeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { code, type, value, appliesTo, appliesToTicketTypeId, usageLimit, expiresAt } = parsed.data;

      // Validate percent range
      if (type === "percent" && (value < 1 || value > 100)) {
        return res.status(400).json({ message: "Percentage discount must be between 1 and 100" });
      }

      const existingCodes = await storage.getDiscountCodesByEventId(event.id);
      const duplicate = existingCodes.find((c) => c.code === code.toUpperCase());
      if (duplicate) {
        return res.status(409).json({ message: `Code "${code}" already exists for this event` });
      }

      const newCode = await storage.createDiscountCode({
        eventId: event.id,
        code: code.toUpperCase(),
        type,
        value,
        appliesTo,
        appliesToTicketTypeId: appliesToTicketTypeId ?? null,
        usageLimit: usageLimit ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      return res.status(201).json(newCode);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE /api/discount-codes/:id ────────────────────────────────────────
  app.delete("/api/discount-codes/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(403).json({ message: "Complete onboarding first" });

      const dc = await storage.getDiscountCodeById(req.params.id);
      if (!dc) return res.status(404).json({ message: "Discount code not found" });

      const event = await storage.getEventById(dc.eventId);
      if (!event || event.organizerId !== organizer.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await storage.deleteDiscountCode(req.params.id);
      return res.status(204).send();
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/discount/validate (public) ──────────────────────────────────
  app.post("/api/discount/validate", async (req, res) => {
    try {
      const { code, eventId, ticketTypeId, baseTotal } = req.body;
      if (!code || !eventId) {
        return res.status(400).json({ message: "code and eventId are required" });
      }

      const dc = await storage.getDiscountCodeByCode(eventId, code.trim().toUpperCase());
      if (!dc) {
        return res.status(404).json({ message: "Invalid discount code" });
      }

      if (dc.expiresAt && new Date() > dc.expiresAt) {
        return res.status(400).json({ message: "This discount code has expired" });
      }

      if (dc.usageLimit !== null && dc.timesUsed >= dc.usageLimit) {
        return res.status(400).json({ message: "This discount code has reached its usage limit" });
      }

      if (dc.appliesTo === "specific" && dc.appliesToTicketTypeId && ticketTypeId && dc.appliesToTicketTypeId !== ticketTypeId) {
        return res.status(400).json({ message: "This discount code does not apply to the selected ticket type" });
      }

      const total = typeof baseTotal === "number" ? baseTotal : 0;
      let discountAmount = 0;
      if (dc.type === "percent") {
        discountAmount = Math.round(total * dc.value / 100);
      } else {
        discountAmount = Math.min(total, dc.value);
      }
      const newTotal = Math.max(0, total - discountAmount);

      return res.json({
        valid: true,
        codeId: dc.id,
        code: dc.code,
        type: dc.type,
        value: dc.value,
        discountAmount,
        newTotal,
        description: dc.type === "percent" ? `${dc.value}% off` : `₦${dc.value.toLocaleString()} off`,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
