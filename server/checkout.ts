import type { Express } from "express";
import crypto from "crypto";
import { storage } from "./storage";
import { checkoutSchema } from "@shared/schema";
import { fulfillUpgrade } from "./upgrade";

const PAYSTACK_KEY = process.env.PICATIC_API_KEY;
const PLATFORM_FEE_PCT = 0.025; // 2.5% charged to organizer's subaccount on free tier

async function sendConfirmationEmail(opts: {
  to: string;
  buyerName: string;
  eventTitle: string;
  ticketTypeName: string;
  quantity: number;
  amount: number;
  reference: string;
  brandName?: string;
  brandLogoUrl?: string | null;
  isPro?: boolean;
}): Promise<void> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass) {
    console.log(`[email] Confirmation for ${opts.to} — ref: ${opts.reference} (set SMTP_HOST/SMTP_USER/SMTP_PASS to enable emails)`);
    return;
  }

  const brandName = opts.brandName || "Showgate";
  const isPro = opts.isPro ?? false;
  const logoHtml = (isPro && opts.brandLogoUrl)
    ? `<img src="${opts.brandLogoUrl}" alt="${brandName}" style="height:36px;max-width:160px;object-fit:contain;display:block;margin-bottom:10px;" />`
    : `<span style="font-size:18px;font-weight:900;color:#000;">${brandName}</span>`;

  const poweredBy = isPro
    ? ""
    : `<p style="margin:24px 0 0;font-size:12px;color:#52525b;">Show this reference at the gate. Powered by Showgate.</p>`;

  try {
    const nodemailer = (await import("nodemailer")).default;
    const transporter = nodemailer.createTransport({ host, port: 587, secure: false, auth: { user, pass } });
    await transporter.sendMail({
      from: `"${brandName}" <${from}>`,
      to: opts.to,
      subject: `✅ Your ticket for ${opts.eventTitle} is confirmed`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#111;color:#f5f5f5;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:28px 32px;">
            ${logoHtml}
            <h1 style="margin:0;font-size:22px;color:#000;font-weight:900;">You're in, ${opts.buyerName.split(" ")[0]}! 🎉</h1>
          </div>
          <div style="padding:28px 32px;">
            <p style="margin:0 0 20px;color:#a1a1aa;">Your ticket for <strong style="color:#fff">${opts.eventTitle}</strong> is confirmed.</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:10px 0;border-bottom:1px solid #27272a;color:#71717a;font-size:13px;">Ticket</td><td style="padding:10px 0;border-bottom:1px solid #27272a;color:#fff;font-weight:600;text-align:right;">${opts.ticketTypeName}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #27272a;color:#71717a;font-size:13px;">Qty</td><td style="padding:10px 0;border-bottom:1px solid #27272a;color:#fff;font-weight:600;text-align:right;">${opts.quantity}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #27272a;color:#71717a;font-size:13px;">Amount</td><td style="padding:10px 0;border-bottom:1px solid #27272a;color:#f59e0b;font-weight:900;text-align:right;">₦${opts.amount.toLocaleString()}</td></tr>
              <tr><td style="padding:10px 0;color:#71717a;font-size:13px;">Reference</td><td style="padding:10px 0;color:#fff;font-family:monospace;text-align:right;">${opts.reference.toUpperCase()}</td></tr>
            </table>
            ${poweredBy}
          </div>
        </div>`,
    });
    console.log(`[email] Confirmation sent to ${opts.to}`);
  } catch (err: any) {
    console.error(`[email] Send failed:`, err.message);
  }
}

export function registerCheckoutRoutes(app: Express) {
  // ── GET /api/events/:id/public ────────────────────────────────────────────
  app.get("/api/events/:id/public", async (req, res) => {
    try {
      const event = await storage.getEventById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (!event.isActive) return res.status(404).json({ message: "This event is not currently active" });

      const [organizer, ticketTypes] = await Promise.all([
        storage.getOrganizerById(event.organizerId),
        storage.getTicketTypesByEventId(event.id),
      ]);

      return res.json({
        id: event.id,
        title: event.title,
        date: event.date,
        location: event.location,
        organizerName: organizer?.businessName || "Event Organizer",
        ticketTypes: ticketTypes.map((tt) => ({
          id: tt.id,
          name: tt.name,
          price: tt.price,
          available: Math.max(0, tt.quantityAvailable - tt.quantitySold),
          quantityAvailable: tt.quantityAvailable,
          quantitySold: tt.quantitySold,
          soldOut: tt.quantitySold >= tt.quantityAvailable,
        })),
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /api/checkout ────────────────────────────────────────────────────
  app.post("/api/checkout", async (req, res) => {
    try {
      if (!PAYSTACK_KEY) {
        return res.status(500).json({ message: "Payment system not configured" });
      }

      const parsed = checkoutSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { eventId, ticketTypeId, buyerName, buyerEmail, buyerPhone, quantity } = parsed.data;

      const event = await storage.getEventById(eventId);
      if (!event || !event.isActive) {
        return res.status(404).json({ message: "Event not found or inactive" });
      }

      const ticketType = await storage.getTicketTypeById(ticketTypeId);
      if (!ticketType || ticketType.eventId !== eventId) {
        return res.status(404).json({ message: "Ticket type not found" });
      }

      const available = ticketType.quantityAvailable - ticketType.quantitySold;
      if (available < quantity) {
        return res.status(400).json({
          message: available === 0
            ? "This ticket type is sold out"
            : `Only ${available} ticket(s) remaining`,
        });
      }

      const organizer = await storage.getOrganizerById(event.organizerId);
      if (!organizer?.subaccountCode) {
        return res.status(500).json({ message: "Organizer payment account not set up" });
      }

      const amountKobo = ticketType.price * quantity * 100;
      const platformFeeKobo = organizer.tier === "free" ? Math.round(amountKobo * PLATFORM_FEE_PCT) : 0;
      const callbackUrl = `${req.protocol}://${req.get("host")}/purchase-success`;

      const payload: Record<string, any> = {
        email: buyerEmail,
        amount: amountKobo,
        subaccount: organizer.subaccountCode,
        bearer: "subaccount",
        callback_url: callbackUrl,
        metadata: {
          custom_fields: [
            { display_name: "Buyer", variable_name: "buyer_name", value: buyerName },
            { display_name: "Ticket", variable_name: "ticket_type", value: ticketType.name },
            { display_name: "Qty", variable_name: "quantity", value: String(quantity) },
          ],
          event_id: eventId,
          ticket_type_id: ticketTypeId,
          buyer_name: buyerName,
          buyer_email: buyerEmail,
          buyer_phone: buyerPhone,
          quantity,
        },
      };

      if (platformFeeKobo > 0) {
        payload.transaction_charge = platformFeeKobo;
      }

      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PAYSTACK_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      const paystackData: any = await paystackRes.json();
      if (!paystackRes.ok || !paystackData.status) {
        return res.status(502).json({ message: paystackData.message || "Failed to initialize payment" });
      }

      return res.json({
        authorization_url: paystackData.data.authorization_url,
        reference: paystackData.data.reference,
        access_code: paystackData.data.access_code,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── POST /webhook/paystack ────────────────────────────────────────────────
  app.post("/webhook/paystack", async (req: any, res) => {
    try {
      if (!PAYSTACK_KEY) return res.sendStatus(200);

      // req.rawBody is captured in server/index.ts via express.json() verify callback
      const rawBody: Buffer | string = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
      const expectedSig = crypto
        .createHmac("sha512", PAYSTACK_KEY)
        .update(rawBody)
        .digest("hex");

      if (expectedSig !== req.headers["x-paystack-signature"]) {
        console.warn("[webhook] Invalid Paystack signature — ignoring");
        return res.sendStatus(401);
      }

      const webhookEvent = req.body;
      if (webhookEvent.event !== "charge.success") return res.sendStatus(200);

      const { reference, metadata, amount, customer } = webhookEvent.data;

      // ── Route: subscription upgrade ────────────────────────────────────────
      if (metadata?.upgrade_plan && metadata?.user_id) {
        const plan: "monthly" | "yearly" = metadata.upgrade_plan === "yearly" ? "yearly" : "monthly";
        await fulfillUpgrade(metadata.user_id, plan);
        console.log(`[webhook] Upgrade fulfilled: ${metadata.user_id} → Pro (${plan})`);
        return res.sendStatus(200);
      }

      // Verify with Paystack before fulfilling
      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_KEY}` },
      });
      const verifyData: any = await verifyRes.json();
      if (!verifyRes.ok || verifyData.data?.status !== "success") {
        console.warn("[webhook] Transaction not verified:", reference);
        return res.sendStatus(200);
      }

      // Idempotency — skip if already processed
      const existing = await storage.getTicketPurchaseByReference(reference);
      if (existing) return res.sendStatus(200);

      const { event_id, ticket_type_id, buyer_name, buyer_email, buyer_phone, quantity } = metadata ?? {};
      if (!event_id || !ticket_type_id) {
        console.warn("[webhook] Missing metadata on charge.success:", reference);
        return res.sendStatus(200);
      }

      const [eventRecord, ticketType] = await Promise.all([
        storage.getEventById(event_id),
        storage.getTicketTypeById(ticket_type_id),
      ]);

      if (!eventRecord || !ticketType) {
        console.warn("[webhook] Event/TicketType missing:", { event_id, ticket_type_id });
        return res.sendStatus(200);
      }

      const qty = Number(quantity) || 1;

      const purchase = await storage.createTicketPurchase({
        eventId: event_id,
        ticketTypeId: ticket_type_id,
        buyerEmail: buyer_email || customer?.email || "",
        buyerName: buyer_name || customer?.first_name || "Buyer",
        buyerPhone: buyer_phone || "",
        quantity: qty,
        amount: Math.round(amount / 100),
        reference,
        status: "confirmed",
      });

      await storage.incrementTicketTypeSold(ticket_type_id, qty);

      // Resolve organizer branding for confirmation email
      const organizer = await storage.getOrganizerById(eventRecord.organizerId);
      const isPro = organizer?.tier === "pro";
      const brandName = (isPro && organizer?.customBrandName) ? organizer.customBrandName : undefined;
      const brandLogoUrl = (isPro && organizer?.customLogoUrl) ? organizer.customLogoUrl : null;

      // Fire-and-forget confirmation email
      sendConfirmationEmail({
        to: purchase.buyerEmail,
        buyerName: purchase.buyerName,
        eventTitle: eventRecord.title,
        ticketTypeName: ticketType.name,
        quantity: purchase.quantity,
        amount: purchase.amount,
        reference: purchase.reference,
        brandName,
        brandLogoUrl,
        isPro,
      }).catch(console.error);

      console.log(`[webhook] Purchase fulfilled: ${reference} (${qty}× ${ticketType.name})`);
      return res.sendStatus(200);
    } catch (err: any) {
      console.error("[webhook] Error:", err.message);
      return res.sendStatus(200); // Always 200 to Paystack
    }
  });

  // ── GET /api/purchase/:reference ─────────────────────────────────────────
  app.get("/api/purchase/:reference", async (req, res) => {
    try {
      const purchase = await storage.getTicketPurchaseByReference(req.params.reference);
      if (!purchase) return res.status(404).json({ message: "Purchase not found" });

      const [eventRecord, ticketType] = await Promise.all([
        storage.getEventById(purchase.eventId),
        storage.getTicketTypeById(purchase.ticketTypeId),
      ]);

      return res.json({
        ...purchase,
        eventTitle: eventRecord?.title ?? "Event",
        eventDate: eventRecord?.date ?? null,
        eventLocation: eventRecord?.location ?? null,
        ticketTypeName: ticketType?.name ?? "Ticket",
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
