import { z } from "zod";
import { storage } from "./storage";
import { insertOrderSchema } from "@shared/schema";
import { checkMonthlyTicketLimit } from "./tierLimits";
import { sendConfirmationEmail } from "./email";
import { getPaystackSecretKey } from "./paystackConfig";

// ── Shared helper: check whether an event's sales window has closed ──────
export function isEventSalesClosed(date: string, startTime: string | null | undefined): boolean {
  const dt = startTime ? new Date(`${date}T${startTime}`) : new Date(`${date}T00:00:00`);
  return Date.now() - dt.getTime() > 4 * 60 * 60 * 1000; // > 4 hours after start
}

// ── Shared helper: resolve and validate ticket type for public purchase ──────
export async function resolveTicketType(eventId: string, ticketTypeId: unknown, quantity: unknown) {
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
export async function resolveDiscount(eventId: string, discountCode: string | undefined, ticketTypeId: string, baseTotal: number) {
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

export type FulfillResult = { status: number; body: any };

/**
 * Verifies a Paystack payment and creates the order for it, exactly once per
 * reference. Called by the browser (after the popup) and by the Paystack webhook.
 * `fromWebhook` skips the sales-window and monthly-limit gates: the buyer has
 * already paid, so they must receive a ticket.
 */
export async function fulfillPaystackOrder(
  eventId: string,
  input: Record<string, any>,
  opts: { fromWebhook?: boolean } = {},
): Promise<FulfillResult> {
  const event = await storage.getEventById(eventId);
  if (!event || !event.isActive) return { status: 404, body: { message: "Event not available" } };

  const { reference, ticketTypeId, quantity, customerName, customerEmail, customerPhone, instagramHandle, discountCode, attendeeDetails, recipientEmail, gender, ageRange, heardFrom } = input;
  if (!reference || typeof reference !== "string") return { status: 400, body: { message: "Missing payment reference" } };

  // Idempotency: the browser call and the webhook can both arrive.
  const existing = await storage.getOrderByPaymentReference(reference);
  if (existing) {
    if (existing.eventId !== event.id) return { status: 409, body: { message: "Reference already used" } };
    return { status: opts.fromWebhook ? 200 : 201, body: existing };
  }

  if (!opts.fromWebhook && isEventSalesClosed(event.date, event.startTime)) {
    return { status: 410, body: { message: "Ticket sales for this event are closed" } };
  }

  const toEmail = (recipientEmail && z.string().email().safeParse(recipientEmail).success) ? recipientEmail : customerEmail;

  const resolved = await resolveTicketType(event.id, ticketTypeId, quantity);
  if ("error" in resolved) return { status: 400, body: { message: resolved.error } };
  const { ticketType, qty, totalAmount, seatDeduction } = resolved;

  const discount = await resolveDiscount(event.id, discountCode, ticketType.id, totalAmount);
  const chargedAmount = Math.max(0, totalAmount - discount.discountAmount);

  const secretKey = getPaystackSecretKey();
  if (!secretKey) return { status: 500, body: { message: "Payment not configured" } };

  const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!paystackRes.ok) return { status: 400, body: { message: "Payment verification failed" } };

  const paystackData: any = await paystackRes.json();
  if (!paystackData.status || paystackData.data?.status !== "success")
    return { status: 400, body: { message: "Payment was not successful" } };

  // Server-authoritative amount check (Paystack amounts are in kobo)
  if (paystackData.data.amount < chargedAmount * 100)
    return { status: 400, body: { message: "Paid amount is less than ticket price" } };

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
  if (!parsed.success) return { status: 400, body: { message: parsed.error.errors[0].message } };

  const organizer = await storage.getOrganizerById(event.organizerId);
  if (!opts.fromWebhook) {
    const monthlyCheck = await checkMonthlyTicketLimit(organizer!, qty);
    if (!monthlyCheck.allowed) {
      return { status: 403, body: { message: monthlyCheck.message, code: monthlyCheck.code } };
    }
  }

  let order;
  try {
    order = await storage.createOrder(parsed.data, "confirmed", reference);
  } catch (err: any) {
    // Lost the race to the other caller (unique index on payment_reference).
    if (err?.code === "23505") {
      const winner = await storage.getOrderByPaymentReference(reference);
      if (winner) return { status: opts.fromWebhook ? 200 : 201, body: winner };
    }
    throw err;
  }
  await storage.incrementTicketTypeSold(ticketType.id, seatDeduction);
  if (discount.discountCodeId) await storage.incrementDiscountCodeUsed(discount.discountCodeId);

  const isPro = organizer?.tier === "pro" && organizer.brandingEnabled !== false; // email branding only
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

  return { status: 201, body: order };
}
