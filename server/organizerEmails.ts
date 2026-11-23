import type { Express } from "express";
import { z } from "zod";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { Resend } from "resend";
import multer from "multer";
import { and, eq, gt, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "./auth";
import { storage } from "./storage";
import { db } from "./db";
import { organizerEmailSends, organizerEmailUnsubscribes } from "@shared/schema";

const MAX_SENDS_PER_24H = 3;
const BATCH_SIZE = 100;
const MAX_ATTACHMENT_BYTES = 1024 * 1024; // 1 MB
const ALLOWED_ATTACHMENTS: Record<string, string[]> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  txt: ["text/plain"],
};
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

const sendSchema = z.object({
  // plain text, single line
  subject: z.string().trim().min(1, "Subject is required").max(120, "Subject must be 120 characters or fewer")
    .refine((s) => !/[\r\n]/.test(s), "Subject must be a single line"),
  message: z.string().trim().min(1, "Message is required").max(3000, "Message must be 3000 characters or fewer"),
});

function baseUrl(): string | null {
  const b = process.env.APP_BASE_URL
    || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0].trim()}` : "")
    || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "");
  return b ? b.replace(/\/$/, "") : null;
}

function unsubToken(organizerId: string, email: string): string {
  return createHmac("sha256", SECRET).update(`unsub:${organizerId}:${email}`).digest("hex");
}
function validUnsubToken(organizerId: string, email: string, token: string): boolean {
  const a = Buffer.from(unsubToken(organizerId, email));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
function unsubUrl(base: string, organizerId: string, email: string): string {
  const e = Buffer.from(email).toString("base64url");
  return `${base}/api/email/unsubscribe?o=${encodeURIComponent(organizerId)}&e=${e}&t=${unsubToken(organizerId, email)}`;
}

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Same look as the Showgate welcome email. The organizer's message is escaped plain text. */
function renderHtml(opts: { subject: string; message: string; organizerName: string; eventTitle: string; organizerEmail: string; unsubscribeUrl: string }): string {
  const body = esc(opts.message).replace(/\r?\n/g, "<br>");
  return `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#111;color:#f5f5f5;border-radius:12px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:24px 28px;">
    <span style="font-size:18px;font-weight:900;color:#000;">Showgate</span>
    <h1 style="margin:8px 0 0;font-size:22px;color:#000;font-weight:900;">${esc(opts.subject)}</h1>
  </div>
  <div style="padding:24px 28px;">
    <p style="margin:0 0 20px;color:#a1a1aa;font-size:13px;">
      A message from <strong style="color:#fff;">${esc(opts.organizerName)}</strong> about <strong style="color:#fff;">${esc(opts.eventTitle)}</strong>
    </p>
    <div style="margin:0;color:#e4e4e7;font-size:15px;line-height:1.6;">${body}</div>
    <p style="margin:24px 0 0;font-size:12px;color:#52525b;border-top:1px solid #27272a;padding-top:16px;">
      Sent via Showgate on behalf of ${esc(opts.organizerName)} for ${esc(opts.eventTitle)}.
      Questions? Contact the organizer at <a href="mailto:${esc(opts.organizerEmail)}" style="color:#f59e0b;text-decoration:none;">${esc(opts.organizerEmail)}</a>.<br>
      <a href="${esc(opts.unsubscribeUrl)}" style="color:#f59e0b;text-decoration:none;">Unsubscribe</a>
    </p>
  </div>
</div>`;
}

// Display names go into a header: strip anything that could break out of it.
function safeDisplayName(name: string): string {
  return name.replace(/[\r\n"<>,;:\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "Organizer";
}

/** Server-side only: confirmed buyers' emails for the event, minus this organizer's unsubscribes. */
async function getRecipients(eventId: string, organizerId: string): Promise<string[]> {
  const orders = (await storage.getOrdersByEventId(eventId)).filter((o) => o.status === "confirmed");
  const unsub = await db.select({ email: organizerEmailUnsubscribes.email }).from(organizerEmailUnsubscribes)
    .where(eq(organizerEmailUnsubscribes.organizerId, organizerId));
  const blocked = new Set(unsub.map((u) => u.email));
  const out = new Set<string>();
  for (const o of orders) {
    const e = o.customerEmail?.trim().toLowerCase();
    if (e && !blocked.has(e)) out.add(e);
  }
  return Array.from(out);
}

async function recentSends(eventId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return db.select({ createdAt: organizerEmailSends.createdAt }).from(organizerEmailSends)
    .where(and(eq(organizerEmailSends.eventId, eventId), gt(organizerEmailSends.createdAt, since)))
    .orderBy(organizerEmailSends.createdAt);
}

function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:sans-serif;background:#09090b;color:#f5f5f5;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
<div style="max-width:420px;padding:32px;text-align:center"><h1 style="font-size:20px">${title}</h1>${body}</div></body></html>`;
}

export function registerOrganizerEmailRoutes(app: Express) {
  async function authorize(req: AuthRequest, res: any) {
    const organizer = await storage.getOrganizerByUserId(req.userId!);
    if (!organizer) { res.status(403).json({ message: "Complete onboarding first" }); return null; }
    const event = await storage.getEventById(req.params.id);
    if (!event) { res.status(404).json({ message: "Event not found" }); return null; }
    if (event.organizerId !== organizer.id) { res.status(403).json({ message: "Not authorized" }); return null; }
    if (organizer.tier !== "pro") { res.status(403).json({ message: "Email Attendees is available on the Pro plan" }); return null; }
    return { organizer, event };
  }

  // Counts only. Addresses are never returned to the organizer.
  app.get("/api/events/:id/email-attendees", requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await authorize(req, res);
      if (!ctx) return res;
      const sends = await recentSends(ctx.event.id);
      const recipients = await getRecipients(ctx.event.id, ctx.organizer.id);
      return res.json({
        recipientCount: recipients.length,
        sendsRemaining: Math.max(0, MAX_SENDS_PER_24H - sends.length),
        nextAvailableAt: sends.length >= MAX_SENDS_PER_24H
          ? new Date(sends[sends.length - MAX_SENDS_PER_24H].createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString()
          : null,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/events/:id/email-attendees", requireAuth, (req, res, next) => {
    upload.single("attachment")(req, res, (err: any) => {
      if (!err) return next();
      const msg = err.code === "LIMIT_FILE_SIZE" ? "Attachment must be 1 MB or smaller" : "Invalid attachment upload";
      return res.status(400).json({ message: msg });
    });
  }, async (req: AuthRequest, res) => {
    try {
      const ctx = await authorize(req, res);
      if (!ctx) return res;
      const { organizer, event } = ctx;

      const parsed = sendSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      const { subject, message } = parsed.data;

      // Optional attachment (max 1 MB, allow-listed types by extension and MIME type).
      const file = (req as any).file as { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined;
      let attachment: { filename: string; content: Buffer } | null = null;
      if (file) {
        const ext = (file.originalname.split(".").pop() ?? "").toLowerCase();
        const okMime = ALLOWED_ATTACHMENTS[ext];
        if (!okMime || !okMime.includes(file.mimetype)) {
          return res.status(400).json({ message: "Attachment must be a PDF, PNG, JPG or TXT file" });
        }
        if (file.size > MAX_ATTACHMENT_BYTES) return res.status(400).json({ message: "Attachment must be 1 MB or smaller" });
        const clean = file.originalname.replace(/[^\w.\- ]+/g, "_").replace(/^\.+/, "").slice(-100) || `attachment.${ext}`;
        attachment = { filename: clean, content: file.buffer };
      }

      const fromAddress = process.env.UPDATES_FROM_EMAIL?.trim();
      const base = baseUrl();
      if (!process.env.RESEND_API_KEY || !fromAddress || !base) {
        console.error("[organizer-email] missing RESEND_API_KEY, UPDATES_FROM_EMAIL or base URL");
        return res.status(503).json({ message: "Email sending is not configured" });
      }
      if (/[\r\n<>]/.test(fromAddress)) return res.status(503).json({ message: "Email sending is not configured" });

      const user = await storage.getUserById(req.userId!);
      if (!user?.email) return res.status(400).json({ message: "Your account has no email address" });

      const recipients = await getRecipients(event.id, organizer.id);
      if (recipients.length === 0) return res.status(400).json({ message: "No ticket buyers to email" });

      // Rate limit + log insert are atomic per event (advisory lock), so concurrent requests can't exceed 3.
      const sendId = randomUUID();
      const allowed = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"org-email:" + event.id}))`);
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [{ n }] = await tx.select({ n: sql<number>`cast(count(*) as int)` }).from(organizerEmailSends)
          .where(and(eq(organizerEmailSends.eventId, event.id), gt(organizerEmailSends.createdAt, since)));
        if (n >= MAX_SENDS_PER_24H) return false;
        await tx.insert(organizerEmailSends).values({
          id: sendId, eventId: event.id, organizerId: organizer.id, userId: req.userId!,
          subject, message, recipientCount: recipients.length, status: "sending",
          attachmentName: attachment?.filename ?? null, attachmentSize: file?.size ?? null,
        });
        return true;
      });
      if (!allowed) {
        return res.status(429).json({ message: `You can send at most ${MAX_SENDS_PER_24H} emails per event every 24 hours` });
      }

      const orgName = safeDisplayName(organizer.businessName);
      const from = `${orgName} via Showgate <${fromAddress}>`;
      const resend = new Resend(process.env.RESEND_API_KEY);
      const buildEmail = (to: string) => {
        const link = unsubUrl(base, organizer.id, to);
        return {
          from,
          to: [to],
          replyTo: user.email,
          subject,
          html: renderHtml({ subject, message, organizerName: organizer.businessName, eventTitle: event.title, organizerEmail: user.email, unsubscribeUrl: link }),
          text: `${message}\n\n--\nSent via Showgate on behalf of ${organizer.businessName} for ${event.title}\nQuestions? Contact the organizer at ${user.email}\nUnsubscribe: ${link}\n`,
          headers: {
            "List-Unsubscribe": `<${link}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        };
      };

      const deliver = async (): Promise<{ sent: number; failed: number; status: string }> => {
        let sent = 0;
        let failed = 0;
        for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
          const chunk = recipients.slice(i, i + BATCH_SIZE);
          if (!attachment) {
            // Resend's batch endpoint: up to 100 emails per call.
            try {
              const { error } = await resend.batch.send(chunk.map(buildEmail));
              if (error) { failed += chunk.length; console.error("[organizer-email] batch failed:", error.message); }
              else sent += chunk.length;
            } catch (err: any) {
              failed += chunk.length;
              console.error("[organizer-email] batch error:", err?.message ?? err);
            }
            continue;
          }
          // Resend's batch endpoint does not accept attachments, so each recipient is sent individually,
          // in throttled groups to stay under Resend's request rate limit.
          for (let g = 0; g < chunk.length; g += 4) {
            const started = Date.now();
            const results = await Promise.all(chunk.slice(g, g + 4).map(async (to) => {
              for (let attempt = 0; attempt < 2; attempt++) {
                try {
                  const { error } = await resend.emails.send({ ...buildEmail(to), attachments: [attachment!] });
                  if (!error) return true;
                  if ((error as any).name !== "rate_limit_exceeded") return false;
                } catch { return false; }
                await sleep(1100);
              }
              return false;
            }));
            for (const ok of results) ok ? sent++ : failed++;
            const wait = 1000 - (Date.now() - started);
            if (wait > 0) await sleep(wait);
          }
        }
        const status = failed === 0 ? "sent" : sent === 0 ? "failed" : "partial";
        await db.update(organizerEmailSends)
          .set({ sentCount: sent, failedCount: failed, status, completedAt: new Date() })
          .where(eq(organizerEmailSends.id, sendId));
        return { sent, failed, status };
      };

      if (attachment) {
        // Individual sends can take minutes for large lists: finish in the background, the log row tracks progress.
        deliver().catch((err) => console.error("[organizer-email] background send error:", err?.message ?? err));
        return res.status(202).json({ status: "sending", recipients: recipients.length });
      }

      const { sent, failed, status } = await deliver();
      if (status === "failed") return res.status(502).json({ message: "Emails could not be sent. Please try again later." });
      return res.json({ status, sent, failed });
    } catch (err: any) {
      console.error("[organizer-email] send error:", err?.message ?? err);
      return res.status(500).json({ message: "Could not send emails" });
    }
  });

  // ── Public unsubscribe (buyer clicks the link). GET confirms, POST performs (also one-click). ──
  function parseUnsub(q: any): { o: string; e: string } | null {
    try {
      const o = String(q.o ?? ""); const t = String(q.t ?? "");
      const e = Buffer.from(String(q.e ?? ""), "base64url").toString().toLowerCase();
      if (!o || !e || !t || !validUnsubToken(o, e, t)) return null;
      return { o, e };
    } catch { return null; }
  }

  app.get("/api/email/unsubscribe", (req, res) => {
    const p = parseUnsub(req.query);
    if (!p) return res.status(400).send(page("Invalid link", `<p style="color:#a1a1aa">This unsubscribe link is not valid.</p>`));
    const qs = new URLSearchParams({ o: String(req.query.o), e: String(req.query.e), t: String(req.query.t) }).toString();
    return res.send(page("Unsubscribe", `<p style="color:#a1a1aa">Stop receiving emails from this organizer sent through Showgate?</p>
<form method="POST" action="/api/email/unsubscribe?${qs}"><button style="background:#f59e0b;border:0;border-radius:8px;padding:10px 20px;font-weight:700;cursor:pointer">Unsubscribe</button></form>`));
  });

  app.post("/api/email/unsubscribe", async (req, res) => {
    const p = parseUnsub(req.query);
    if (!p) return res.status(400).send(page("Invalid link", `<p style="color:#a1a1aa">This unsubscribe link is not valid.</p>`));
    try {
      await db.insert(organizerEmailUnsubscribes).values({ organizerId: p.o, email: p.e }).onConflictDoNothing();
      return res.send(page("You're unsubscribed", `<p style="color:#a1a1aa">You will no longer receive emails from this organizer through Showgate.</p>`));
    } catch {
      return res.status(500).send(page("Something went wrong", `<p style="color:#a1a1aa">Please try again.</p>`));
    }
  });
}
