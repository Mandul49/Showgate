import type { Express } from "express";
import Stripe from "stripe";
import { requireAuth, type AuthRequest } from "./auth";
import { storage } from "./storage";
import {
  createEventSchema, updateEventSchema,
  createTicketTypeSchema, updateTicketTypeSchema,
  insertOrderSchema,
} from "@shared/schema";
import {
  checkEventTierLimits,
  checkMonthlyTicketLimit,
  FREE_MAX_MONTHLY_TICKETS,
} from "./tierLimits";
import { sendConfirmationEmail } from "./email";
import { getPaystackSecretKey, getPaystackPublicKey, isTestMode, getPaystackMode, setPaystackMode } from "./paystackConfig";

export function registerEventsRoutes(app: Express) {

  // ── POST /api/admin/paystack-mode ─────────────────────────────────────────
  app.post("/api/admin/paystack-mode", requireAuth, async (req: AuthRequest, res) => {
    const { mode } = req.body;
    if (mode !== "test" && mode !== "live") {
      return res.status(400).json({ message: "mode must be 'test' or 'live'" });
    }
    setPaystackMode(mode);
    return res.json({ paystackMode: mode });
  });

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

      const { FREE_MAX_ACTIVE_EVENTS, FREE_MAX_MONTHLY_TICKETS: FREE_MONTHLY, FREE_ALLOWED_PAYMENT_METHODS } = await import("./tierLimits");

      return res.json({
        events: eventsWithTypes,
        tier: organizer.tier,
        paystackMode: getPaystackMode(),
        organizer: {
          testSubaccountCode: organizer.testSubaccountCode,
          hasTestSubaccount: !!organizer.testSubaccountCode,
        },
        limits: {
          maxActiveEvents: organizer.tier === "free" ? FREE_MAX_ACTIVE_EVENTS : null,
          maxMonthlyTickets: organizer.tier === "free" ? FREE_MONTHLY : null,
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

      const { title, date, location, maxTickets, paymentMethod, isActive, description, coverImageUrl } = parsed.data;

      const tierCheck = await checkEventTierLimits(organizer, {
        paymentMethod,
        activating: isActive,
      });
      if (!tierCheck.allowed) {
        return res.status(403).json({ message: tierCheck.message, code: tierCheck.code });
      }

      const event = await storage.createEvent({
        organizerId: organizer.id,
        title, date, location, maxTickets, paymentMethod, isActive,
        status: isActive ? "active" : "draft",
        description: description ?? null,
        coverImageUrl: coverImageUrl ?? null,
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

      const tierCheck = await checkEventTierLimits(organizer, {
        paymentMethod: updates.paymentMethod,
        activating: updates.isActive === true && !event.isActive,
        excludeEventId: event.id,
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
          message: "Cannot delete an event with purchased tickets. Archive it instead.",
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

      const { name, price, quantityAvailable } = parsed.data;

      // Capacity check: cannot exceed event.maxTickets (all tiers)
      const existingTypes = await storage.getTicketTypesByEventId(event.id);
      const currentTotal = existingTypes.reduce((sum, t) => sum + t.quantityAvailable, 0);
      if (currentTotal + quantityAvailable > event.maxTickets) {
        return res.status(400).json({
          message: `Adding ${quantityAvailable} tickets would exceed this event's capacity of ${event.maxTickets}. Available: ${event.maxTickets - currentTotal}.`,
        });
      }

      const ticketType = await storage.createTicketType({ eventId: event.id, name, price, quantityAvailable });
      return res.status(201).json(ticketType);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/public/events/:id ───────────────────────────────────────────
  app.get("/api/public/events/:id", async (req, res) => {
    try {
      const event = await storage.getEventById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (!event.isActive) return res.status(404).json({ message: "Event is not available" });

      const ticketTypes = await storage.getTicketTypesByEventId(event.id);
      const organizer = await storage.getOrganizerById(event.organizerId);

      return res.json({
        id: event.id,
        title: event.title,
        date: event.date,
        location: event.location,
        maxTickets: event.maxTickets,
        paymentMethod: event.paymentMethod,
        description: event.description ?? null,
        coverImageUrl: event.coverImageUrl ?? null,
        ticketTypes: ticketTypes.map((tt) => ({
          id: tt.id,
          name: tt.name,
          price: tt.price,
          quantityAvailable: tt.quantityAvailable,
          quantitySold: tt.quantitySold,
          remaining: Math.max(0, tt.quantityAvailable - tt.quantitySold),
        })),
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
          name: (organizer?.tier === "pro" && organizer.customBrandName) ? organizer.customBrandName : (organizer?.businessName ?? "Showgate"),
          logoUrl: (organizer?.tier === "pro" && organizer.customLogoUrl) ? organizer.customLogoUrl : null,
          isPro: organizer?.tier === "pro" ?? false,
          brandTheme: (organizer?.tier === "pro") ? (organizer.brandTheme ?? null) : null,
        },
        paystackPublicKey: getPaystackPublicKey(),
        paystackEnv: isTestMode() ? "test" : "live",
        stripePublicKey: process.env.STRIPE_PUBLIC_KEY || "",
        flutterwavePublicKey: (organizer?.tier === "pro" && organizer.flutterwavePublicKey) ? organizer.flutterwavePublicKey : "",
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Shared helper: resolve and validate ticket type for public purchase ──────
  async function resolveTicketType(eventId: string, ticketTypeId: unknown, quantity: unknown) {
    if (!ticketTypeId || typeof ticketTypeId !== "string") {
      return { error: "ticketTypeId is required" } as const;
    }
    const qty = typeof quantity === "number" ? quantity : parseInt(String(quantity), 10);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
      return { error: "quantity must be an integer between 1 and 20" } as const;
    }
    const tt = await storage.getTicketTypeById(ticketTypeId);
    if (!tt) return { error: "Ticket type not found" } as const;
    if (tt.eventId !== eventId) return { error: "Ticket type does not belong to this event" } as const;
    const remaining = tt.quantityAvailable - tt.quantitySold;
    if (remaining < qty) return { error: "Not enough tickets remaining for this type" } as const;
    const totalAmount = tt.price * qty;
    return { ticketType: tt, qty, totalAmount } as const;
  }

  // ── POST /api/public/events/:id/purchase/paystack ─────────────────────────
  app.post("/api/public/events/:id/purchase/paystack", async (req, res) => {
    try {
      const event = await storage.getEventById(req.params.id);
      if (!event || !event.isActive) return res.status(404).json({ message: "Event not available" });

      const { reference, ticketTypeId, quantity, customerName, customerEmail, customerPhone, instagramHandle } = req.body;
      if (!reference) return res.status(400).json({ message: "Missing payment reference" });

      const resolved = await resolveTicketType(event.id, ticketTypeId, quantity);
      if ("error" in resolved) return res.status(400).json({ message: resolved.error });
      const { ticketType, qty, totalAmount } = resolved;

      const secretKey = getPaystackSecretKey();
      if (!secretKey) return res.status(500).json({ message: "Payment not configured" });

      const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      if (!paystackRes.ok) return res.status(400).json({ message: "Payment verification failed" });

      const paystackData: any = await paystackRes.json();
      if (!paystackData.status || paystackData.data?.status !== "success")
        return res.status(400).json({ message: "Payment was not successful" });

      // Server-authoritative amount check (Paystack amounts are in kobo)
      if (paystackData.data.amount < totalAmount * 100)
        return res.status(400).json({ message: "Paid amount is less than ticket price" });

      const parsed = insertOrderSchema.safeParse({
        eventId: event.id,
        ticketTypeId: ticketType.id,
        customerName,
        customerEmail,
        customerPhone,
        instagramHandle: instagramHandle || null,
        ticketType: ticketType.name,
        quantity: qty,
        totalAmount,
      });
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      const organizer = await storage.getOrganizerById(event.organizerId);
      const monthlyCheck = await checkMonthlyTicketLimit(organizer!, qty);
      if (!monthlyCheck.allowed) {
        return res.status(403).json({ message: monthlyCheck.message, code: monthlyCheck.code });
      }

      const order = await storage.createOrder(parsed.data, "confirmed");
      await storage.incrementTicketTypeSold(ticketType.id, qty);

      const isPro = organizer?.tier === "pro";
      sendConfirmationEmail({
        to: customerEmail,
        buyerName: customerName,
        eventTitle: event.title,
        eventDate: event.date,
        eventLocation: event.location,
        ticketTypeName: ticketType.name,
        quantity: qty,
        amount: totalAmount,
        reference: order.id,
        brandName: (isPro && organizer?.customBrandName) ? organizer.customBrandName : undefined,
        brandLogoUrl: (isPro && organizer?.customLogoUrl) ? organizer.customLogoUrl : null,
        isPro,
      }).catch(console.error);

      return res.status(201).json(order);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/public/events/:id/purchase/stripe-intent ────────────────────
  // Amount is computed server-side from ticket price × quantity — never trusted from client.
  app.post("/api/public/events/:id/purchase/stripe-intent", async (req, res) => {
    try {
      const event = await storage.getEventById(req.params.id);
      if (!event || !event.isActive) return res.status(404).json({ message: "Event not available" });

      const { ticketTypeId, quantity, customerEmail } = req.body;

      const resolved = await resolveTicketType(event.id, ticketTypeId, quantity);
      if ("error" in resolved) return res.status(400).json({ message: resolved.error });
      const { qty, totalAmount } = resolved;

      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey) return res.status(500).json({ message: "Stripe not configured" });

      const stripe = new Stripe(secretKey);
      const intent = await stripe.paymentIntents.create({
        // Amount is authoritative: computed from DB price, not client-provided
        amount: Math.round(totalAmount * 100),
        currency: "usd",
        receipt_email: customerEmail || undefined,
        metadata: {
          eventId: event.id,
          ticketTypeId: String(ticketTypeId),
          quantity: String(qty),
        },
      });

      return res.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/public/events/:id/purchase/stripe ───────────────────────────
  app.post("/api/public/events/:id/purchase/stripe", async (req, res) => {
    try {
      const event = await storage.getEventById(req.params.id);
      if (!event || !event.isActive) return res.status(404).json({ message: "Event not available" });

      const { paymentIntentId, ticketTypeId, quantity, customerName, customerEmail, customerPhone, instagramHandle } = req.body;
      if (!paymentIntentId) return res.status(400).json({ message: "Missing paymentIntentId" });

      const resolved = await resolveTicketType(event.id, ticketTypeId, quantity);
      if ("error" in resolved) return res.status(400).json({ message: resolved.error });
      const { ticketType, qty, totalAmount } = resolved;

      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey) return res.status(500).json({ message: "Stripe not configured" });

      const stripe = new Stripe(secretKey);
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (intent.status !== "succeeded") return res.status(400).json({ message: "Payment not completed" });

      // Verify paid amount matches server-authoritative total
      if (intent.amount < Math.round(totalAmount * 100))
        return res.status(400).json({ message: "Paid amount is less than ticket price" });

      // Verify the intent's metadata event/ticket type matches (if metadata was set by our intent endpoint)
      if (intent.metadata.eventId && intent.metadata.eventId !== event.id)
        return res.status(400).json({ message: "Payment intent event mismatch" });

      const parsed = insertOrderSchema.safeParse({
        eventId: event.id,
        ticketTypeId: ticketType.id,
        customerName,
        customerEmail,
        customerPhone,
        instagramHandle: instagramHandle || null,
        ticketType: ticketType.name,
        quantity: qty,
        totalAmount,
      });
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      const stripeOrganizer = await storage.getOrganizerById(event.organizerId);
      const monthlyCheck = await checkMonthlyTicketLimit(stripeOrganizer!, qty);
      if (!monthlyCheck.allowed) {
        return res.status(403).json({ message: monthlyCheck.message, code: monthlyCheck.code });
      }

      const order = await storage.createOrder(parsed.data, "confirmed");
      await storage.incrementTicketTypeSold(ticketType.id, qty);

      const isPro = stripeOrganizer?.tier === "pro";
      sendConfirmationEmail({
        to: customerEmail,
        buyerName: customerName,
        eventTitle: event.title,
        eventDate: event.date,
        eventLocation: event.location,
        ticketTypeName: ticketType.name,
        quantity: qty,
        amount: totalAmount,
        reference: order.id,
        brandName: (isPro && stripeOrganizer?.customBrandName) ? stripeOrganizer.customBrandName : undefined,
        brandLogoUrl: (isPro && stripeOrganizer?.customLogoUrl) ? stripeOrganizer.customLogoUrl : null,
        isPro,
      }).catch(console.error);

      return res.status(201).json(order);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/public/events/:id/purchase/bank ─────────────────────────────
  app.post("/api/public/events/:id/purchase/bank", async (req, res) => {
    try {
      const event = await storage.getEventById(req.params.id);
      if (!event || !event.isActive) return res.status(404).json({ message: "Event not available" });

      const { ticketTypeId, quantity, customerName, customerEmail, customerPhone, instagramHandle } = req.body;

      const resolved = await resolveTicketType(event.id, ticketTypeId, quantity);
      if ("error" in resolved) return res.status(400).json({ message: resolved.error });
      const { ticketType, qty, totalAmount } = resolved;

      const parsed = insertOrderSchema.safeParse({
        eventId: event.id,
        ticketTypeId: ticketType.id,
        customerName,
        customerEmail,
        customerPhone,
        instagramHandle: instagramHandle || null,
        ticketType: ticketType.name,
        quantity: qty,
        totalAmount,
      });
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      const order = await storage.createOrder(parsed.data, "awaiting_transfer");
      await storage.incrementTicketTypeSold(ticketType.id, qty);

      const organizer = await storage.getOrganizerById(event.organizerId);
      const isPro = organizer?.tier === "pro";
      sendConfirmationEmail({
        to: customerEmail,
        buyerName: customerName,
        eventTitle: event.title,
        eventDate: event.date,
        eventLocation: event.location,
        ticketTypeName: ticketType.name,
        quantity: qty,
        amount: totalAmount,
        reference: order.id,
        brandName: (isPro && organizer?.customBrandName) ? organizer.customBrandName : undefined,
        brandLogoUrl: (isPro && organizer?.customLogoUrl) ? organizer.customLogoUrl : null,
        isPro,
        isBankTransfer: true,
        bankName: organizer?.bankName,
        accountNumber: organizer?.accountNumber,
        accountName: organizer?.businessName,
      }).catch(console.error);

      return res.status(201).json(order);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/public/events/:id/purchase/flutterwave ─────────────────────
  app.post("/api/public/events/:id/purchase/flutterwave", async (req, res) => {
    try {
      const event = await storage.getEventById(req.params.id);
      if (!event || !event.isActive) return res.status(404).json({ message: "Event not available" });

      const organizer = await storage.getOrganizerById(event.organizerId);
      if (!organizer || organizer.tier !== "pro") {
        return res.status(403).json({ message: "Flutterwave payments not available for this event" });
      }
      if (!organizer.flutterwaveSecretKey) {
        return res.status(503).json({ message: "Flutterwave not configured for this event" });
      }

      const { transactionId, ticketTypeId, quantity, customerName, customerEmail, customerPhone, instagramHandle } = req.body;
      if (!transactionId) return res.status(400).json({ message: "Missing transactionId" });

      const resolved = await resolveTicketType(event.id, ticketTypeId, quantity);
      if ("error" in resolved) return res.status(400).json({ message: resolved.error });
      const { ticketType, qty, totalAmount } = resolved;

      // Verify with Flutterwave using organizer's secret key
      const fwRes = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
        headers: { Authorization: `Bearer ${organizer.flutterwaveSecretKey}` },
      });
      if (!fwRes.ok) return res.status(400).json({ message: "Flutterwave verification failed" });

      const fwData: any = await fwRes.json();
      if (fwData.status !== "success" || fwData.data?.status !== "successful") {
        return res.status(400).json({ message: "Payment was not successful" });
      }

      // Server-authoritative amount check (FW amounts are in full units, not kobo)
      if (fwData.data.amount < totalAmount) {
        return res.status(400).json({ message: "Paid amount is less than ticket price" });
      }

      const fwMonthlyCheck = await checkMonthlyTicketLimit(organizer, qty);
      if (!fwMonthlyCheck.allowed) {
        return res.status(403).json({ message: fwMonthlyCheck.message, code: fwMonthlyCheck.code });
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
        totalAmount,
      });
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      const order = await storage.createOrder(parsed.data, "confirmed");
      await storage.incrementTicketTypeSold(ticketType.id, qty);

      const isPro = organizer.tier === "pro";
      sendConfirmationEmail({
        to: customerEmail,
        buyerName: customerName,
        eventTitle: event.title,
        eventDate: event.date,
        eventLocation: event.location,
        ticketTypeName: ticketType.name,
        quantity: qty,
        amount: totalAmount,
        reference: order.id,
        brandName: (isPro && organizer.customBrandName) ? organizer.customBrandName : undefined,
        brandLogoUrl: (isPro && organizer.customLogoUrl) ? organizer.customLogoUrl : null,
        isPro,
      }).catch(console.error);

      return res.status(201).json(order);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/orders/pending-transfers ─────────────────────────────────────
  app.get("/api/orders/pending-transfers", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(403).json({ message: "Complete onboarding first" });

      const orgEvents = await storage.getEventsByOrganizerId(organizer.id);
      const eventIds = new Set(orgEvents.map((e) => e.id));

      const allOrders = await storage.getAllOrders();
      const pending = allOrders
        .filter((o) => o.status === "awaiting_transfer" && o.eventId && eventIds.has(o.eventId))
        .map((o) => ({
          ...o,
          eventTitle: orgEvents.find((e) => e.id === o.eventId)?.title ?? "Unknown event",
        }))
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());

      return res.json(pending);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH /api/orders/:orderId/confirm-transfer ────────────────────────────
  app.patch("/api/orders/:orderId/confirm-transfer", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(403).json({ message: "Complete onboarding first" });

      const order = await storage.getOrder(req.params.orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (!order.eventId) return res.status(400).json({ message: "Order has no associated event" });

      const event = await storage.getEventById(order.eventId);
      if (!event || event.organizerId !== organizer.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (order.status !== "awaiting_transfer") {
        return res.status(400).json({ message: "Order is not awaiting transfer" });
      }

      await storage.updateOrderStatus(order.id, "confirmed");
      return res.json({ message: "Transfer confirmed" });
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
      return res.json(eventOrders);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── PATCH /api/events/:id/orders/:orderId/confirm ─────────────────────────
  app.patch("/api/events/:id/orders/:orderId/confirm", requireAuth, async (req: AuthRequest, res) => {
    try {
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer) return res.status(403).json({ message: "Complete onboarding first" });

      const event = await storage.getEventById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.organizerId !== organizer.id) return res.status(403).json({ message: "Not authorized" });

      const order = await storage.getOrder(req.params.orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.eventId !== event.id) return res.status(403).json({ message: "Order does not belong to this event" });
      if (order.status !== "awaiting_transfer") {
        return res.status(400).json({ message: "Order is not awaiting transfer confirmation" });
      }

      const updated = await storage.updateOrderStatus(order.id, "confirmed");
      return res.json(updated);
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

      if (updates.quantityAvailable !== undefined) {
        // Capacity check: all tiers
        const allTypes = await storage.getTicketTypesByEventId(event.id);
        const otherTotal = allTypes
          .filter((t) => t.id !== ticketType.id)
          .reduce((sum, t) => sum + t.quantityAvailable, 0);
        if (otherTotal + updates.quantityAvailable > event.maxTickets) {
          return res.status(400).json({
            message: `Total ticket quantity cannot exceed this event's capacity of ${event.maxTickets}.`,
          });
        }

        // Free-tier hard cap (independent of event.maxTickets)
        const tierCheck = await checkTicketTypeTierLimits(organizer, event, {
          quantityAvailable: updates.quantityAvailable,
          excludeTicketTypeId: ticketType.id,
        });
        if (!tierCheck.allowed) {
          return res.status(403).json({ message: tierCheck.message, code: tierCheck.code });
        }
      }

      const updated = await storage.updateTicketType(ticketType.id, updates);
      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
