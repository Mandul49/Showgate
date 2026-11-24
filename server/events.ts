import type { Express } from "express";
import { z } from "zod";
import { requireAuth, effectiveTier, type AuthRequest } from "./auth";
import { resolveBranding } from "./resolveBranding";
import { storage, generateUniqueSlug } from "./storage";
import {
  createEventSchema, updateEventSchema,
  createTicketTypeSchema, updateTicketTypeSchema,
  insertOrderSchema,
} from "@shared/schema";
import {
  checkEventTierLimits,
  checkMonthlyTicketLimit,
} from "./tierLimits";
import { sendConfirmationEmail } from "./email";
import { fulfillPaystackOrder, isEventSalesClosed, resolveTicketType, resolveDiscount } from "./paystackFulfillment";
import { getPaystackSecretKey, getPaystackPublicKey, isTestMode, getPaystackMode } from "./paystackConfig";

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

      const { getFreeMaxActiveEvents, getFreeMaxMonthlyTickets, FREE_ALLOWED_PAYMENT_METHODS } = await import("./tierLimits");
      const maxActiveEvents = await getFreeMaxActiveEvents();
      const maxMonthlyTickets = await getFreeMaxMonthlyTickets();

      const resolvedTier = effectiveTier(organizer.tier, req.userRole);

      return res.json({
        events: eventsWithTypes,
        tier: resolvedTier,
        paystackMode: getPaystackMode(),
        organizer: {
          testSubaccountCode: organizer.testSubaccountCode,
          hasTestSubaccount: !!organizer.testSubaccountCode,
          hasLiveSubaccount: !!organizer.subaccountCode,
        },
        limits: {
          maxActiveEvents: resolvedTier === "free" ? maxActiveEvents : null,
          maxMonthlyTickets: resolvedTier === "free" ? maxMonthlyTickets : null,
          allowedPaymentMethods: resolvedTier === "free" ? FREE_ALLOWED_PAYMENT_METHODS : null,
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

      const { title, date, location, maxTickets, paymentMethod, isActive, description, coverImageUrl, coverImagePositionY, instagramUrl, facebookUrl, twitterUrl, tiktokUrl } = parsed.data;

      const tierCheck = await checkEventTierLimits(organizer, {
        paymentMethod,
        activating: isActive,
        userRole: req.userRole,
      });
      if (!tierCheck.allowed) {
        return res.status(403).json({ message: tierCheck.message, code: tierCheck.code });
      }

      const slug = await generateUniqueSlug(title);
      const event = await storage.createEvent({
        organizerId: organizer.id,
        title, date, location, maxTickets, paymentMethod, isActive,
        status: isActive ? "active" : "draft",
        description: description ?? null,
        coverImageUrl: coverImageUrl ?? null,
        coverImagePositionY: coverImagePositionY ?? 50,
        slug,
        instagramUrl: instagramUrl ?? null,
        facebookUrl: facebookUrl ?? null,
        twitterUrl: twitterUrl ?? null,
        tiktokUrl: tiktokUrl ?? null,
      });

      return res.status(201).json({ ...event, ticketTypes: [] });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/events/public — no auth, must be before /:id ───────────────
  app.get("/api/events/public", async (_req, res) => {
    try {
      console.log("✅ GET /api/events/public hit");
      const evts = await storage.getPublicEvents();
      return res.json(evts);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/events/public/past — no auth, must be before /:id ──────────
  app.get("/api/events/public/past", async (_req, res) => {
    try {
      const evts = await storage.getPastPublicEvents();
      return res.json(evts);
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

      if (event.archivedAt && updates.isActive === true) {
        return res.status(400).json({ message: "Unarchive this event before activating it" });
      }

      const tierCheck = await checkEventTierLimits(organizer, {
        paymentMethod: updates.paymentMethod,
        activating: updates.isActive === true && !event.isActive,
        excludeEventId: event.id,
        userRole: req.userRole,
      });
      if (!tierCheck.allowed) {
        return res.status(403).json({ message: tierCheck.message, code: tierCheck.code });
      }

      const updated = await storage.updateEvent(event.id, {
        ...updates,
        ...(updates.isActive !== undefined
          ? { status: updates.isActive ? "active" : "inactive" }
          : {}),
        description: updates.description !== undefined ? (updates.description ?? null) : undefined,
        coverImageUrl: updates.coverImageUrl !== undefined ? (updates.coverImageUrl ?? null) : undefined,
      });

      const ticketTypes = await storage.getTicketTypesByEventId(event.id);
      return res.json({ ...updated, ticketTypes });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── DELETE /api/events/:id ────────────────────────────────────────────────
  // ── POST /api/events/:id/archive | /unarchive ─────────────────────────────
  // Archiving hides the event from the public site and stops sales (isActive=false,
  // which also frees a free-plan active-event slot). Orders and data are kept.
  // Unarchiving restores it as inactive; the organizer re-activates it manually.
  for (const action of ["archive", "unarchive"] as const) {
    app.post(`/api/events/:id/${action}`, requireAuth, async (req: AuthRequest, res) => {
      try {
        const organizer = await storage.getOrganizerByUserId(req.userId!);
        if (!organizer) return res.status(403).json({ message: "Complete onboarding first" });

        const event = await storage.getEventById(req.params.id);
        if (!event) return res.status(404).json({ message: "Event not found" });
        if (event.organizerId !== organizer.id) return res.status(403).json({ message: "Not authorized" });

        const updated = action === "archive"
          ? await storage.updateEvent(event.id, { archivedAt: new Date(), isActive: false })
          : await storage.updateEvent(event.id, { archivedAt: null });
        return res.json(updated);
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    });
  }

  // ── POST /api/events/:id/delete-request (+ /cancel) ───────────────────────
  // Events with sold tickets can't be deleted directly. The organizer files a
  // request and an admin approves (deletes) or rejects it from the admin panel.
  app.post("/api/events/:id/delete-request", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(403).json({ message: "Complete onboarding first" });
      const event = await storage.getEventById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.organizerId !== organizer.id) return res.status(403).json({ message: "Not authorized" });
      if (event.deleteRequestedAt) return res.status(409).json({ message: "Deletion already requested" });

      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 1000) : "";
      if (!reason) return res.status(400).json({ message: "Please tell us why you want to delete this event" });

      const updated = await storage.updateEvent(event.id, { deleteRequestedAt: new Date(), deleteRequestReason: reason });
      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/events/:id/delete-request/cancel", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(403).json({ message: "Complete onboarding first" });
      const event = await storage.getEventById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.organizerId !== organizer.id) return res.status(403).json({ message: "Not authorized" });
      const updated = await storage.updateEvent(event.id, { deleteRequestedAt: null, deleteRequestReason: null });
      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/events/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(403).json({ message: "Complete onboarding first" });

      const event = await storage.getEventById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.organizerId !== organizer.id) return res.status(403).json({ message: "Not authorized" });

      const ticketTypeList = await storage.getTicketTypesByEventId(event.id);
      const totalSold = ticketTypeList.reduce((sum, t) => sum + t.quantitySold, 0);
      if (totalSold > 0) {
        return res.status(409).json({
          message: "This event has purchased tickets. Request deletion and an admin will review it.",
          code: "TICKETS_SOLD",
        });
      }

      await storage.deleteEvent(event.id);
      return res.status(204).send();
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

      const { name, price, quantityAvailable, groupSize, groupLabel } = parsed.data;

      // Validate the new tier doesn't exceed the event's total capacity
      const existingTypes = await storage.getTicketTypesByEventId(event.id);
      const alreadyAllocated = existingTypes.reduce((sum, t) => sum + t.quantityAvailable, 0);
      if (alreadyAllocated + quantityAvailable > event.maxTickets) {
        const remaining = event.maxTickets - alreadyAllocated;
        return res.status(400).json({
          message: `Would exceed event capacity. Only ${remaining} ticket${remaining === 1 ? "" : "s"} remain unallocated.`,
        });
      }

      const ticketType = await storage.createTicketType({
        eventId: event.id, name, price, quantityAvailable,
        groupSize: groupSize ?? 1,
        groupLabel: groupLabel ?? null,
      });

      return res.status(201).json(ticketType);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/public/events/:id ───────────────────────────────────────────
  app.get("/api/public/events/:id", async (req, res) => {
    try {
      const param = req.params.id;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);
      const event = isUUID
        ? await storage.getEventById(param)
        : (await storage.getEventBySlug(param)) ?? (await storage.getEventById(param));
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.suspendedByAdmin || event.archivedAt || event.deletedAt) return res.status(404).json({ message: "Event is not available" });
      if (!event.isActive) {
        // Allow inactive past events only if they have at least one purchase
        const today = new Date().toISOString().split("T")[0];
        const isPastDate = event.date < today;
        if (!isPastDate) return res.status(404).json({ message: "Event is not available" });
        const hasOrders = await storage.hasEventOrders(event.id);
        if (!hasOrders) return res.status(404).json({ message: "Event is not available" });
      }

      const ticketTypes = await storage.getTicketTypesByEventId(event.id);
      const organizer = await storage.getOrganizerById(event.organizerId);
      const rb = resolveBranding(organizer, event);
      const brandingActive = rb.active;

      return res.json({
        id: event.id,
        slug: event.slug ?? null,
        title: event.title,
        date: event.date,
        startTime: event.startTime ?? null,
        location: event.location,
        maxTickets: event.maxTickets,
        paymentMethod: event.paymentMethod,
        description: event.description ?? null,
        coverImageUrl: event.coverImageUrl ?? null,
        coverImagePositionY: event.coverImagePositionY ?? 50,
        instagramUrl: event.instagramUrl ?? null,
        facebookUrl: event.facebookUrl ?? null,
        twitterUrl: event.twitterUrl ?? null,
        tiktokUrl: event.tiktokUrl ?? null,
        ticketTypes: ticketTypes.map((tt) => {
          const groupSize = tt.groupSize ?? 1;
          const remainingSeats = Math.max(0, tt.quantityAvailable - tt.quantitySold);
          return {
            id: tt.id,
            name: tt.name,
            price: tt.price,
            quantityAvailable: tt.quantityAvailable,
            quantitySold: tt.quantitySold,
            groupSize,
            groupLabel: tt.groupLabel ?? null,
            remaining: groupSize > 1 ? Math.floor(remainingSeats / groupSize) : remainingSeats,
            remainingSeats,
          };
        }),
        organizer: organizer
          ? {
              businessName: organizer.businessName,
              subaccountCode: isTestMode()
                ? (organizer.testSubaccountCode || organizer.subaccountCode)
                : organizer.subaccountCode,
              testSubaccountCode: organizer.testSubaccountCode,
              bankName: organizer.bankName,
              accountNumber: organizer.accountNumber,
            }
          : null,
        branding: {
          name: (brandingActive && rb.customBrandName) ? rb.customBrandName : (organizer?.businessName ?? "Showgate"),
          logoUrl: (brandingActive && rb.customLogoUrl) ? rb.customLogoUrl : null,
          // isPro stays tier-based (not affected by the white-label toggle)
          isPro: organizer?.tier === "pro",
          // true only when Pro AND the white-label toggle is on
          brandingEnabled: brandingActive,
          brandTheme: brandingActive ? rb.brandTheme : null,
        },
        paystackPublicKey: getPaystackPublicKey(),
        paystackEnv: isTestMode() ? "test" : "live",
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/public/events/:id/purchase/paystack ─────────────────────────
  // The webhook (checkout.ts) runs the same fulfilment, so whichever of the two
  // arrives first creates the order and the other returns it unchanged.
  app.post("/api/public/events/:id/purchase/paystack", async (req, res) => {
    try {
      const result = await fulfillPaystackOrder(req.params.id, req.body ?? {});
      return res.status(result.status).json(result.body);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });


  // ── POST /api/public/events/:id/purchase/free ────────────────────────────
  app.post("/api/public/events/:id/purchase/free", async (req, res) => {
    try {
      const event = await storage.getEventById(req.params.id);
      if (!event || !event.isActive) return res.status(404).json({ message: "Event not available" });
      if (isEventSalesClosed(event.date, event.startTime)) return res.status(410).json({ message: "Ticket sales for this event are closed" });

      const { ticketTypeId, quantity, customerName, customerEmail, customerPhone, instagramHandle, attendeeDetails, recipientEmail, gender, ageRange, heardFrom } = req.body;
      const toEmail = (recipientEmail && z.string().email().safeParse(recipientEmail).success) ? recipientEmail : customerEmail;

      const resolved = await resolveTicketType(event.id, ticketTypeId, quantity);
      if ("error" in resolved) return res.status(400).json({ message: resolved.error });
      const { ticketType, qty, totalAmount, seatDeduction } = resolved;

      if (ticketType.price !== 0) {
        return res.status(400).json({ message: "This endpoint is only for free tickets" });
      }

      const parsed = insertOrderSchema.safeParse({
        eventId: event.id,
        ticketTypeId: ticketType.id,
        customerName,
        customerEmail,
        customerPhone,
        instagramHandle: instagramHandle || null,
        ticketType: ticketType.name,
        quantity: qty,
        totalAmount: 0,
        discountCode: null,
        discountAmount: 0,
        attendeeDetails: attendeeDetails || null,
        gender: gender || null,
        ageRange: ageRange || null,
        heardFrom: heardFrom || null,
      });
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      const organizer = await storage.getOrganizerById(event.organizerId);
      const monthlyCheck = await checkMonthlyTicketLimit(organizer!, qty);
      if (!monthlyCheck.allowed) {
        return res.status(403).json({ message: monthlyCheck.message, code: monthlyCheck.code });
      }

      const order = await storage.createOrder(parsed.data, "confirmed");
      await storage.incrementTicketTypeSold(ticketType.id, seatDeduction);

      const rb = resolveBranding(organizer, event);
      const isPro = rb.active; // email branding only
      sendConfirmationEmail({
        to: toEmail,
        buyerName: customerName,
        organizerId: event.organizerId,
        eventTitle: event.title,
        eventDate: event.date,
        eventLocation: event.location,
        ticketTypeName: ticketType.name,
        quantity: qty,
        amount: 0,
        reference: order.id,
        brandName: (isPro && rb.customBrandName) ? rb.customBrandName : undefined,
        brandLogoUrl: (isPro && rb.customLogoUrl) ? rb.customLogoUrl : null,
        isPro,
      }).catch(console.error);

      return res.status(201).json(order);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/events/:id/orders ────────────────────────────────────────────
  app.get("/api/events/:id/orders", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(403).json({ message: "Complete onboarding first" });

      const event = await storage.getEventById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.organizerId !== organizer.id) return res.status(403).json({ message: "Not authorized" });

      const eventOrders = await storage.getOrdersByEventId(event.id);
      // Organizers get name, ticket type, ticket code and check-in status only: no buyer email or phone.
      const rows = eventOrders.flatMap((o) => {
        const attendees = (o.attendeeDetails as { name?: string }[] | null) ?? [];
        const seats = (o.checkedInSeats as Record<string, string> | null) ?? {};
        const total = Math.max(1, o.quantity);
        return Array.from({ length: total }, (_, i) => ({
          key: `${o.id}:${i}`,
          name: attendees[i]?.name?.trim() || o.customerName,
          ticketType: o.ticketType,
          ticketCode: o.id.toUpperCase(),
          seat: i + 1,
          of: total,
          orderStatus: o.status,
          checkedInAt: seats[String(i)] ?? null,
        }));
      });
      return res.json(rows);
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

      if (updates.quantityAvailable !== undefined && updates.quantityAvailable < ticketType.quantitySold) {
        return res.status(400).json({
          message: `Quantity cannot be lower than tickets already sold (${ticketType.quantitySold}).`,
        });
      }

      // Validate the updated quantity doesn't push total allocation above event capacity
      if (updates.quantityAvailable !== undefined) {
        const allTypes = await storage.getTicketTypesByEventId(event.id);
        const otherAllocated = allTypes
          .filter((t) => t.id !== ticketType.id)
          .reduce((sum, t) => sum + t.quantityAvailable, 0);
        if (otherAllocated + updates.quantityAvailable > event.maxTickets) {
          return res.status(400).json({
            message: `Would exceed event capacity of ${event.maxTickets} tickets.`,
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
