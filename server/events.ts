import type { Express } from "express";
import { requireAuth, type AuthRequest } from "./auth";
import { storage } from "./storage";
import {
  createEventSchema, updateEventSchema,
  createTicketTypeSchema, updateTicketTypeSchema,
} from "@shared/schema";

const FREE_MAX_ACTIVE_EVENTS = 2;
const FREE_MAX_TICKETS_PER_EVENT = 100;
const FREE_ALLOWED_PAYMENT_METHODS = ["paystack"];

export function registerEventsRoutes(app: Express) {
  // ── GET /api/events ───────────────────────────────────────────────────────
  app.get("/api/events", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(403).json({ message: "Complete onboarding first" });

      const events = await storage.getEventsByOrganizerId(organizer.id);
      const eventsWithTypes = await Promise.all(
        events.map(async (event) => ({
          ...event,
          ticketTypes: await storage.getTicketTypesByEventId(event.id),
        }))
      );

      return res.json({
        events: eventsWithTypes,
        tier: organizer.tier,
        limits: {
          maxActiveEvents: organizer.tier === "free" ? FREE_MAX_ACTIVE_EVENTS : null,
          maxTicketsPerEvent: organizer.tier === "free" ? FREE_MAX_TICKETS_PER_EVENT : null,
          allowedPaymentMethods: organizer.tier === "free" ? FREE_ALLOWED_PAYMENT_METHODS : null,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/events ──────────────────────────────────────────────────────
  app.post("/api/events", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(403).json({ message: "Complete onboarding first" });

      const parsed = createEventSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { title, date, location, maxTickets, paymentMethod, isActive } = parsed.data;

      if (organizer.tier === "free") {
        if (!FREE_ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
          return res.status(403).json({
            message: "Free plan only supports Paystack. Upgrade to Pro for Stripe, PayPal, and Bank Transfer.",
            code: "TIER_PAYMENT_METHOD",
          });
        }
        if (maxTickets > FREE_MAX_TICKETS_PER_EVENT) {
          return res.status(403).json({
            message: `Free plan is limited to ${FREE_MAX_TICKETS_PER_EVENT} tickets per event. Upgrade to Pro for unlimited tickets.`,
            code: "TIER_MAX_TICKETS",
          });
        }
        if (isActive) {
          const existing = await storage.getEventsByOrganizerId(organizer.id);
          const activeCount = existing.filter((e) => e.isActive).length;
          if (activeCount >= FREE_MAX_ACTIVE_EVENTS) {
            return res.status(403).json({
              message: `Free plan allows a maximum of ${FREE_MAX_ACTIVE_EVENTS} active events. Upgrade to Pro for unlimited events.`,
              code: "TIER_MAX_EVENTS",
            });
          }
        }
      }

      const event = await storage.createEvent({
        organizerId: organizer.id,
        title, date, location, maxTickets, paymentMethod, isActive,
        status: isActive ? "active" : "draft",
      });

      return res.status(201).json({ ...event, ticketTypes: [] });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/events/:id ───────────────────────────────────────────────────
  app.get("/api/events/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(403).json({ message: "Complete onboarding first" });

      const event = await storage.getEventById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.organizerId !== organizer.id) return res.status(403).json({ message: "Not authorized" });

      const ticketTypes = await storage.getTicketTypesByEventId(event.id);
      return res.json({ ...event, ticketTypes });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH /api/events/:id ─────────────────────────────────────────────────
  app.patch("/api/events/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(403).json({ message: "Complete onboarding first" });

      const event = await storage.getEventById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.organizerId !== organizer.id) return res.status(403).json({ message: "Not authorized" });

      const parsed = updateEventSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const updates = parsed.data;

      if (organizer.tier === "free") {
        if (updates.paymentMethod && !FREE_ALLOWED_PAYMENT_METHODS.includes(updates.paymentMethod)) {
          return res.status(403).json({
            message: "Free plan only supports Paystack.",
            code: "TIER_PAYMENT_METHOD",
          });
        }
        if (updates.maxTickets !== undefined && updates.maxTickets > FREE_MAX_TICKETS_PER_EVENT) {
          return res.status(403).json({
            message: `Free plan is limited to ${FREE_MAX_TICKETS_PER_EVENT} tickets per event.`,
            code: "TIER_MAX_TICKETS",
          });
        }
        if (updates.isActive === true && !event.isActive) {
          const existing = await storage.getEventsByOrganizerId(organizer.id);
          const activeCount = existing.filter((e) => e.isActive && e.id !== event.id).length;
          if (activeCount >= FREE_MAX_ACTIVE_EVENTS) {
            return res.status(403).json({
              message: `Free plan allows a maximum of ${FREE_MAX_ACTIVE_EVENTS} active events.`,
              code: "TIER_MAX_EVENTS",
            });
          }
        }
      }

      const updated = await storage.updateEvent(event.id, {
        ...updates,
        ...(updates.isActive !== undefined
          ? { status: updates.isActive ? "active" : "inactive" }
          : {}),
      });

      const ticketTypes = await storage.getTicketTypesByEventId(event.id);
      return res.json({ ...updated, ticketTypes });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/events/:id/ticket-types ────────────────────────────────────
  app.post("/api/events/:id/ticket-types", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(403).json({ message: "Complete onboarding first" });

      const event = await storage.getEventById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.organizerId !== organizer.id) return res.status(403).json({ message: "Not authorized" });

      const parsed = createTicketTypeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { name, price, quantityAvailable } = parsed.data;

      const existingTypes = await storage.getTicketTypesByEventId(event.id);
      const currentTotal = existingTypes.reduce((sum, t) => sum + t.quantityAvailable, 0);

      if (currentTotal + quantityAvailable > event.maxTickets) {
        return res.status(400).json({
          message: `Adding ${quantityAvailable} tickets would exceed this event's capacity of ${event.maxTickets}. Available capacity: ${event.maxTickets - currentTotal}.`,
        });
      }

      const ticketType = await storage.createTicketType({ eventId: event.id, name, price, quantityAvailable });
      return res.status(201).json(ticketType);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH /api/events/:id/ticket-types/:typeId ────────────────────────────
  app.patch("/api/events/:id/ticket-types/:typeId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(403).json({ message: "Complete onboarding first" });

      const event = await storage.getEventById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.organizerId !== organizer.id) return res.status(403).json({ message: "Not authorized" });

      const ticketType = await storage.getTicketTypeById(req.params.typeId);
      if (!ticketType || ticketType.eventId !== event.id) {
        return res.status(404).json({ message: "Ticket type not found" });
      }

      const parsed = updateTicketTypeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const updates = parsed.data;

      if (updates.quantityAvailable !== undefined) {
        const allTypes = await storage.getTicketTypesByEventId(event.id);
        const otherTotal = allTypes
          .filter((t) => t.id !== ticketType.id)
          .reduce((sum, t) => sum + t.quantityAvailable, 0);
        if (otherTotal + updates.quantityAvailable > event.maxTickets) {
          return res.status(400).json({
            message: `Total ticket quantity cannot exceed this event's capacity of ${event.maxTickets}.`,
          });
        }
      }

      const updated = await storage.updateTicketType(ticketType.id, updates);
      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
