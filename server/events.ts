import type { Express } from "express";
import { z } from "zod";
import { requireAuth, effectiveTier, type AuthRequest } from "./auth";
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

      const { title, date, location, maxTickets, paymentMethod, isActive, description, coverImageUrl, coverImagePositionY } = parsed.data;

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
      if (!event.isActive || event.suspendedByAdmin) return res.status(404).json({ message: "Event is not available" });

      const ticketTypes = await storage.getTicketTypesByEventId(event.id);
      const organizer = await storage.getOrganizerById(event.organizerId);

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
          name: (organizer?.tier === "pro" && organizer.customBrandName) ? organizer.customBrandName : (organizer?.businessName ?? "Showgate"),
          logoUrl: (organizer?.tier === "pro" && organizer.customLogoUrl) ? organizer.customLogoUrl : null,
          isPro: organizer?.tier === "pro" ?? false,
          brandTheme: (organizer?.tier === "pro") ? (organizer.brandTheme ?? null) : null,
        },
        paystackPublicKey: getPaystackPublicKey(),
        paystackEnv: isTestMode() ? "test" : "live",
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
    const groupSize = tt.groupSize ?? 1;
    const seatDeduction = qty * groupSize;
    const remaining = tt.quantityAvailable - tt.quantitySold;
    if (remaining < seatDeduction) return { error: "Not enough tickets remaining for this type" } as const;
    const totalAmount = tt.price * qty;
    return { ticketType: tt, qty, totalAmount, seatDeduction } as const;
  }

  // ── Shared helper: validate discount code and compute discounted total ────
  async function resolveDiscount(eventId: string, discountCode: string | undefined, ticketTypeId: string, baseTotal: number) {
    if (!discountCode) return { discountAmount: 0, discountCodeId: null };
    const dc = await storage.getDiscountCodeByCode(eventId, discountCode.trim().toUpperCase());
    if (!dc) return { discountAmount: 0, discountCodeId: null };
    if (dc.expiresAt && new Date() > dc.expiresAt) return { discountAmount: 0, discountCodeId: null };
    if (dc.usageLimit !== null && dc.timesUsed >= dc.usageLimit) return { discountAmount: 0, discountCodeId: null };
    if (dc.appliesTo === "specific" && dc.appliesToTicketTypeId && dc.appliesToTicketTypeId !== ticketTypeId) {
      return { discountAmount: 0, discountCodeId: null };
    }
    let discountAmount = 0;
    if (dc.type === "percent") {
      discountAmount = Math.round(baseTotal * dc.value / 100);
    } else {
      discountAmount = Math.min(baseTotal, dc.value);
    }
    return { discountAmount, discountCodeId: dc.id, discountCodeStr: dc.code };
  }

  // ── POST /api/public/events/:id/purchase/paystack ─────────────────────────
  app.post("/api/public/events/:id/purchase/paystack", async (req, res) => {
    try {
      const event = await storage.getEventById(req.params.id);
      if (!event || !event.isActive) return res.status(404).json({ message: "Event not available" });

      const { reference, ticketTypeId, quantity, customerName, customerEmail, customerPhone, instagramHandle, discountCode, attendeeDetails, recipientEmail, gender, ageRange, heardFrom } = req.body;
      if (!reference) return res.status(400).json({ message: "Missing payment reference" });
      const emailSchema = z.string().email();
      const toEmail = (recipientEmail && emailSchema.safeParse(recipientEmail).success) ? recipientEmail : customerEmail;

      const resolved = await resolveTicketType(event.id, ticketTypeId, quantity);
      if ("error" in resolved) return res.status(400).json({ message: resolved.error });
      const { ticketType, qty, totalAmount, seatDeduction } = resolved;

      const discount = await resolveDiscount(event.id, discountCode, ticketType.id, totalAmount);
      const chargedAmount = Math.max(0, totalAmount - discount.discountAmount);

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
      if (paystackData.data.amount < chargedAmount * 100)
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
        totalAmount: chargedAmount,
        discountCode: discount.discountAmount > 0 ? (discount as any).discountCodeStr : null,
        discountAmount: discount.discountAmount,
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
      if (discount.discountCodeId) await storage.incrementDiscountCodeUsed(discount.discountCodeId);

      const isPro = organizer?.tier === "pro";
      sendConfirmationEmail({
        to: toEmail,
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


  // ── POST /api/public/events/:id/purchase/bank ─────────────────────────────
  app.post("/api/public/events/:id/purchase/bank", async (req, res) => {
    try {
      const event = await storage.getEventById(req.params.id);
      if (!event || !event.isActive) return res.status(404).json({ message: "Event not available" });

      const { ticketTypeId, quantity, customerName, customerEmail, customerPhone, instagramHandle, discountCode, attendeeDetails, recipientEmail, gender, ageRange, heardFrom } = req.body;
      const toEmail = (recipientEmail && z.string().email().safeParse(recipientEmail).success) ? recipientEmail : customerEmail;

      const resolved = await resolveTicketType(event.id, ticketTypeId, quantity);
      if ("error" in resolved) return res.status(400).json({ message: resolved.error });
      const { ticketType, qty, totalAmount, seatDeduction } = resolved;

      const discount = await resolveDiscount(event.id, discountCode, ticketType.id, totalAmount);
      const chargedAmount = Math.max(0, totalAmount - discount.discountAmount);

      const parsed = insertOrderSchema.safeParse({
        eventId: event.id,
        ticketTypeId: ticketType.id,
        customerName,
        customerEmail,
        customerPhone,
        instagramHandle: instagramHandle || null,
        ticketType: ticketType.name,
        quantity: qty,
        totalAmount: chargedAmount,
        discountCode: discount.discountAmount > 0 ? (discount as any).discountCodeStr : null,
        discountAmount: discount.discountAmount,
        attendeeDetails: attendeeDetails || null,
        gender: gender || null,
        ageRange: ageRange || null,
        heardFrom: heardFrom || null,
      });
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      const order = await storage.createOrder(parsed.data, "awaiting_transfer");
      await storage.incrementTicketTypeSold(ticketType.id, seatDeduction);
      if (discount.discountCodeId) await storage.incrementDiscountCodeUsed(discount.discountCodeId);

      const organizer = await storage.getOrganizerById(event.organizerId);
      const isPro = organizer?.tier === "pro";
      sendConfirmationEmail({
        to: toEmail,
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

  // ── POST /api/public/events/:id/purchase/free ────────────────────────────
  app.post("/api/public/events/:id/purchase/free", async (req, res) => {
    try {
      const event = await storage.getEventById(req.params.id);
      if (!event || !event.isActive) return res.status(404).json({ message: "Event not available" });

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

      const isPro = organizer?.tier === "pro";
      sendConfirmationEmail({
        to: toEmail,
        buyerName: customerName,
        eventTitle: event.title,
        eventDate: event.date,
        eventLocation: event.location,
        ticketTypeName: ticketType.name,
        quantity: qty,
        amount: 0,
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

      const { transactionId, ticketTypeId, quantity, customerName, customerEmail, customerPhone, instagramHandle, discountCode, attendeeDetails, recipientEmail, gender, ageRange, heardFrom } = req.body;
      if (!transactionId) return res.status(400).json({ message: "Missing transactionId" });
      const toEmail = (recipientEmail && z.string().email().safeParse(recipientEmail).success) ? recipientEmail : customerEmail;

      const resolved = await resolveTicketType(event.id, ticketTypeId, quantity);
      if ("error" in resolved) return res.status(400).json({ message: resolved.error });
      const { ticketType, qty, totalAmount, seatDeduction } = resolved;

      const discount = await resolveDiscount(event.id, discountCode, ticketType.id, totalAmount);
      const chargedAmount = Math.max(0, totalAmount - discount.discountAmount);

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
      if (fwData.data.amount < chargedAmount) {
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
        totalAmount: chargedAmount,
        discountCode: discount.discountAmount > 0 ? (discount as any).discountCodeStr : null,
        discountAmount: discount.discountAmount,
        attendeeDetails: attendeeDetails || null,
        gender: gender || null,
        ageRange: ageRange || null,
        heardFrom: heardFrom || null,
      });
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      const order = await storage.createOrder(parsed.data, "confirmed");
      await storage.incrementTicketTypeSold(ticketType.id, seatDeduction);
      if (discount.discountCodeId) await storage.incrementDiscountCodeUsed(discount.discountCodeId);

      const isPro = organizer.tier === "pro";
      sendConfirmationEmail({
        to: toEmail,
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
