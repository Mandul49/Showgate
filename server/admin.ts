import type { Express, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { sql, eq, desc, isNull, and, lt } from "drizzle-orm";
import { storage } from "./storage";
import {
  users, organizers, events, ticketTypes, ticketPurchases,
  subscriptionReferences, platformStats, adminSupportNotes,
} from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

export interface AdminRequest extends Request {
  adminId?: string;
}

// ── Middleware ──────────────────────────────────────────────────────────────

export async function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    if (payload.role !== "admin") return res.status(403).json({ message: "Access denied" });
    const user = await storage.getUserById(payload.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Access denied" });
    req.adminId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function last12Months(): string[] {
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

// ── Routes ──────────────────────────────────────────────────────────────────

export function registerAdminRoutes(app: Express) {

  // ── Overview ──────────────────────────────────────────────────────────────

  app.get("/api/admin/overview", requireAdmin, async (_req: AdminRequest, res) => {
    try {
      const [orgCount] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(organizers);

      const [proCount] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(users)
        .where(
          sql`${users.tier} = 'pro' AND ${users.role} = 'organizer' AND (${users.proExpiresAt} IS NULL OR ${users.proExpiresAt} > now())`
        );

      const [eventCount] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(events);

      const [statsRow] = await db.select().from(platformStats).where(eq(platformStats.id, 1));

      const [ticketCount] = await db
        .select({ total: sql<number>`cast(coalesce(sum(quantity_sold),0) as int)` })
        .from(ticketTypes);

      const [feeRow] = await db
        .select({ total: sql<string>`cast(coalesce(sum(amount),0) as bigint)` })
        .from(ticketPurchases)
        .where(eq(ticketPurchases.status, "confirmed"));

      const [subRevRow] = await db
        .select({ total: sql<string>`cast(coalesce(sum(amount_kobo),0) as bigint)` })
        .from(subscriptionReferences);

      const ticketMonthly = await db.execute<{ month: string; ticket_fees: string }>(sql`
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
               CAST(COALESCE(SUM(amount) * 0.025, 0) as bigint) as ticket_fees
        FROM ticket_purchases
        WHERE status = 'confirmed' AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month
      `);

      const subMonthly = await db.execute<{ month: string; sub_revenue: string }>(sql`
        SELECT TO_CHAR(DATE_TRUNC('month', fulfilled_at), 'YYYY-MM') as month,
               CAST(COALESCE(SUM(amount_kobo), 0) as bigint) as sub_revenue
        FROM subscription_references
        WHERE fulfilled_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', fulfilled_at)
        ORDER BY month
      `);

      const monthMap = new Map<string, { ticketFees: number; subRevenue: number }>();
      for (const m of last12Months()) monthMap.set(m, { ticketFees: 0, subRevenue: 0 });
      for (const row of ticketMonthly.rows) {
        if (monthMap.has(row.month)) monthMap.get(row.month)!.ticketFees = Number(row.ticket_fees);
      }
      for (const row of subMonthly.rows) {
        if (monthMap.has(row.month)) monthMap.get(row.month)!.subRevenue = Number(row.sub_revenue);
      }

      const monthlyRevenue = Array.from(monthMap.entries()).map(([month, d]) => ({
        month: month,
        label: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        ticketFees: d.ticketFees,
        subRevenue: d.subRevenue,
        total: d.ticketFees + d.subRevenue,
      }));

      return res.json({
        totalOrganizers: orgCount?.count ?? 0,
        activeProSubscribers: proCount?.count ?? 0,
        totalEvents: (eventCount?.count ?? 0) + (statsRow?.deletedEvents ?? 0),
        totalTicketsSold: (ticketCount?.total ?? 0) + (statsRow?.deletedTicketsSold ?? 0),
        platformFeeRevenue: Math.round(Number(feeRow?.total ?? 0) * 0.025),
        subscriptionRevenue: Number(subRevRow?.total ?? 0),
        monthlyRevenue,
      });
    } catch (err: any) {
      console.error("[admin/overview]", err);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Organizers ────────────────────────────────────────────────────────────

  app.get("/api/admin/organizers", requireAdmin, async (_req: AdminRequest, res) => {
    try {
      const rows = await db.execute<{
        id: string; user_id: string; business_name: string; subaccount_code: string | null;
        tier: string; created_at: string; email: string; suspended: boolean;
        active_event_count: string; tickets_sold: string; revenue_processed: string;
      }>(sql`
        SELECT o.id, o.user_id, o.business_name, o.subaccount_code, o.tier, o.created_at,
               u.email, u.suspended,
               (SELECT COUNT(*)::int FROM events WHERE organizer_id = o.id AND is_active = true) as active_event_count,
               (SELECT COALESCE(SUM(tt.quantity_sold), 0)::bigint
                FROM ticket_types tt JOIN events e ON e.id = tt.event_id
                WHERE e.organizer_id = o.id) as tickets_sold,
               (SELECT COALESCE(SUM(tp.amount), 0)::bigint
                FROM ticket_purchases tp
                WHERE tp.organizer_id = o.id AND tp.status = 'confirmed') as revenue_processed
        FROM organizers o
        JOIN users u ON u.id = o.user_id
        ORDER BY o.created_at DESC
      `);

      return res.json(rows.rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        businessName: r.business_name,
        subaccountCode: r.subaccount_code,
        tier: r.tier,
        createdAt: r.created_at,
        email: r.email,
        suspended: r.suspended,
        activeEventCount: Number(r.active_event_count),
        ticketsSold: Number(r.tickets_sold),
        revenueProcessed: Number(r.revenue_processed),
      })));
    } catch (err: any) {
      console.error("[admin/organizers]", err);
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/organizers/:id", requireAdmin, async (req: AdminRequest, res) => {
    try {
      const orgId = req.params.id;
      const [org] = await db.select().from(organizers).where(eq(organizers.id, orgId));
      if (!org) return res.status(404).json({ message: "Organizer not found" });

      const [user] = await db.select().from(users).where(eq(users.id, org.userId));
      const orgEvents = await db.select().from(events).where(eq(events.organizerId, orgId));
      const subRefs = await db.select().from(subscriptionReferences)
        .where(eq(subscriptionReferences.userId, org.userId))
        .orderBy(desc(subscriptionReferences.fulfilledAt));

      const recentPurchases = await db.execute<{
        id: string; customer_name: string; customer_email: string; amount: string;
        quantity: string; status: string; created_at: string; event_title: string;
      }>(sql`
        SELECT tp.id, tp.customer_name, tp.customer_email, tp.amount::bigint, tp.quantity,
               tp.status, tp.created_at, e.title as event_title
        FROM ticket_purchases tp
        JOIN events e ON e.id = tp.event_id
        WHERE tp.organizer_id = ${orgId}
        ORDER BY tp.created_at DESC
        LIMIT 20
      `);

      return res.json({
        organizer: { ...org, email: user?.email, suspended: user?.suspended },
        events: orgEvents,
        subscriptionHistory: subRefs,
        recentSales: recentPurchases.rows.map((r) => ({
          id: r.id,
          customerName: r.customer_name,
          customerEmail: r.customer_email,
          amount: Number(r.amount),
          quantity: Number(r.quantity),
          status: r.status,
          createdAt: r.created_at,
          eventTitle: r.event_title,
        })),
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/organizers/:id/upgrade-pro", requireAdmin, async (req: AdminRequest, res) => {
    try {
      const [org] = await db.select().from(organizers).where(eq(organizers.id, req.params.id));
      if (!org) return res.status(404).json({ message: "Organizer not found" });
      await db.update(users).set({ tier: "pro", proExpiresAt: null, cancelledAt: null }).where(eq(users.id, org.userId));
      await db.update(organizers).set({ tier: "pro" }).where(eq(organizers.id, org.id));
      return res.json({ message: "Upgraded to Pro (lifetime)" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/organizers/:id/downgrade-free", requireAdmin, async (req: AdminRequest, res) => {
    try {
      const [org] = await db.select().from(organizers).where(eq(organizers.id, req.params.id));
      if (!org) return res.status(404).json({ message: "Organizer not found" });
      await db.update(users).set({ tier: "free", proExpiresAt: null, cancelledAt: null }).where(eq(users.id, org.userId));
      await db.update(organizers).set({ tier: "free" }).where(eq(organizers.id, org.id));
      return res.json({ message: "Downgraded to Free" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/organizers/:id/suspend", requireAdmin, async (req: AdminRequest, res) => {
    try {
      const [org] = await db.select().from(organizers).where(eq(organizers.id, req.params.id));
      if (!org) return res.status(404).json({ message: "Organizer not found" });
      await db.update(users).set({ suspended: true } as any).where(eq(users.id, org.userId));
      return res.json({ message: "Account suspended" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/organizers/:id/reinstate", requireAdmin, async (req: AdminRequest, res) => {
    try {
      const [org] = await db.select().from(organizers).where(eq(organizers.id, req.params.id));
      if (!org) return res.status(404).json({ message: "Organizer not found" });
      await db.update(users).set({ suspended: false } as any).where(eq(users.id, org.userId));
      return res.json({ message: "Account reinstated" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Subscriptions ─────────────────────────────────────────────────────────

  app.get("/api/admin/subscriptions", requireAdmin, async (_req: AdminRequest, res) => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const rows = await db.execute<{
        user_id: string; email: string; tier: string; billing_cycle: string | null;
        pro_expires_at: string | null; cancelled_at: string | null;
        reference: string | null; plan: string | null; amount_kobo: string | null;
        fulfilled_at: string | null; business_name: string | null;
      }>(sql`
        SELECT u.id as user_id, u.email, u.tier, u.billing_cycle, u.pro_expires_at, u.cancelled_at,
               sr.reference, sr.plan, sr.amount_kobo::bigint, sr.fulfilled_at,
               o.business_name
        FROM users u
        LEFT JOIN organizers o ON o.user_id = u.id
        LEFT JOIN LATERAL (
          SELECT * FROM subscription_references WHERE user_id = u.id ORDER BY fulfilled_at DESC LIMIT 1
        ) sr ON true
        WHERE u.tier = 'pro' OR EXISTS (SELECT 1 FROM subscription_references WHERE user_id = u.id)
        ORDER BY sr.fulfilled_at DESC NULLS LAST
      `);

      const [churnRow] = await db.execute<{ count: string }>(sql`
        SELECT COUNT(*)::int as count FROM users
        WHERE cancelled_at >= ${startOfMonth} AND role = 'organizer'
      `);

      const activeRows = rows.rows.filter((r) => {
        if (r.tier !== "pro") return false;
        if (!r.pro_expires_at) return true;
        return new Date(r.pro_expires_at) > now;
      });

      const mrrKobo = activeRows.reduce((sum, r) => {
        const amount = Number(r.amount_kobo ?? 0);
        const plan = r.billing_cycle || r.plan || "";
        if (plan.includes("year")) return sum + Math.round(amount / 12);
        return sum + amount;
      }, 0);

      return res.json({
        summary: {
          activeCount: activeRows.length,
          mrrKobo: mrrKobo,
          arrKobo: mrrKobo * 12,
          churnThisMonth: Number((churnRow as any).rows?.[0]?.count ?? 0),
        },
        subscriptions: rows.rows.map((r) => {
          const isExpired = r.pro_expires_at ? new Date(r.pro_expires_at) <= now : false;
          const isCancelled = !!r.cancelled_at;
          const isActive = r.tier === "pro" && !isExpired;
          return {
            userId: r.user_id,
            email: r.email,
            businessName: r.business_name,
            plan: r.billing_cycle || r.plan || "—",
            startedAt: r.fulfilled_at,
            expiresAt: r.pro_expires_at,
            amountKobo: Number(r.amount_kobo ?? 0),
            status: isActive ? (isCancelled ? "cancelled" : "active") : "expired",
          };
        }),
      });
    } catch (err: any) {
      console.error("[admin/subscriptions]", err);
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/subscriptions/:userId/cancel", requireAdmin, async (req: AdminRequest, res) => {
    try {
      await db.update(users).set({ cancelledAt: new Date() }).where(eq(users.id, req.params.userId));
      return res.json({ message: "Subscription cancelled" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/subscriptions/:userId/extend", requireAdmin, async (req: AdminRequest, res) => {
    try {
      const days = Number(req.body.days ?? 30);
      await db.execute(sql`
        UPDATE users SET pro_expires_at = GREATEST(COALESCE(pro_expires_at, NOW()), NOW()) + INTERVAL '${sql.raw(String(days))} days'
        WHERE id = ${req.params.userId}
      `);
      return res.json({ message: `Extended by ${days} days` });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Events ────────────────────────────────────────────────────────────────

  app.get("/api/admin/events", requireAdmin, async (_req: AdminRequest, res) => {
    try {
      const rows = await db.execute<{
        id: string; title: string; date: string; status: string; is_active: boolean;
        max_tickets: string; organizer_id: string; business_name: string;
        tickets_sold: string; revenue: string;
      }>(sql`
        SELECT e.id, e.title, e.date, e.status, e.is_active, e.max_tickets::int,
               e.organizer_id, o.business_name,
               COALESCE(SUM(tt.quantity_sold), 0)::bigint as tickets_sold,
               COALESCE((
                 SELECT SUM(tp.amount) FROM ticket_purchases tp
                 WHERE tp.event_id = e.id AND tp.status = 'confirmed'
               ), 0)::bigint as revenue
        FROM events e
        LEFT JOIN organizers o ON o.id = e.organizer_id
        LEFT JOIN ticket_types tt ON tt.event_id = e.id
        GROUP BY e.id, o.business_name
        ORDER BY e.created_at DESC
      `);

      return res.json(rows.rows.map((r) => ({
        id: r.id,
        title: r.title,
        date: r.date,
        status: r.status,
        isActive: r.is_active,
        maxTickets: Number(r.max_tickets),
        organizerId: r.organizer_id,
        organizerName: r.business_name,
        ticketsSold: Number(r.tickets_sold),
        revenue: Number(r.revenue),
      })));
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/events/:id/suspend", requireAdmin, async (req: AdminRequest, res) => {
    try {
      await db.update(events).set({ isActive: false, status: "inactive" }).where(eq(events.id, req.params.id));
      return res.json({ message: "Event suspended" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Analytics ─────────────────────────────────────────────────────────────

  app.get("/api/admin/analytics", requireAdmin, async (_req: AdminRequest, res) => {
    try {
      const signupsByMonth = await db.execute<{ month: string; count: string }>(sql`
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month, COUNT(*)::int as count
        FROM users WHERE role = 'organizer' AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', created_at) ORDER BY month
      `);

      const salesByMonth = await db.execute<{ month: string; count: string; revenue: string }>(sql`
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
               COUNT(*)::int as count,
               COALESCE(SUM(amount), 0)::bigint as revenue
        FROM ticket_purchases WHERE status = 'confirmed' AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', created_at) ORDER BY month
      `);

      const [feeTotal] = await db.execute<{ total: string }>(sql`
        SELECT CAST(COALESCE(SUM(amount) * 0.025, 0) as bigint) as total FROM ticket_purchases WHERE status = 'confirmed'
      `);
      const [subTotal] = await db.execute<{ total: string }>(sql`
        SELECT CAST(COALESCE(SUM(amount_kobo), 0) as bigint) as total FROM subscription_references
      `);

      const topEvents = await db.execute<{ id: string; title: string; tickets_sold: string; revenue: string }>(sql`
        SELECT e.id, e.title,
               COALESCE(SUM(tt.quantity_sold), 0)::int as tickets_sold,
               COALESCE((SELECT SUM(amount) FROM ticket_purchases WHERE event_id = e.id AND status = 'confirmed'), 0)::bigint as revenue
        FROM events e LEFT JOIN ticket_types tt ON tt.event_id = e.id
        GROUP BY e.id ORDER BY tickets_sold DESC LIMIT 5
      `);

      const topOrganizers = await db.execute<{ id: string; business_name: string; revenue: string; tickets: string }>(sql`
        SELECT o.id, o.business_name,
               COALESCE(SUM(tp.amount), 0)::bigint as revenue,
               COALESCE(SUM(tp.quantity), 0)::int as tickets
        FROM organizers o
        LEFT JOIN ticket_purchases tp ON tp.organizer_id = o.id AND tp.status = 'confirmed'
        GROUP BY o.id ORDER BY revenue DESC LIMIT 5
      `);

      const [avgRow] = await db.execute<{ avg: string }>(sql`
        SELECT COALESCE(AVG(sub.sold), 0) as avg
        FROM (SELECT COALESCE(SUM(quantity_sold), 0) as sold FROM ticket_types GROUP BY event_id) sub
      `);

      const [totalOrgs] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(organizers);
      const [upgradedOrgs] = await db.execute<{ count: string }>(sql`
        SELECT COUNT(DISTINCT user_id)::int as count FROM subscription_references
      `);

      const monthMap = new Map<string, { signups: number; sales: number; revenue: number }>();
      for (const m of last12Months()) monthMap.set(m, { signups: 0, sales: 0, revenue: 0 });
      for (const r of signupsByMonth.rows) {
        if (monthMap.has(r.month)) monthMap.get(r.month)!.signups = Number(r.count);
      }
      for (const r of salesByMonth.rows) {
        if (monthMap.has(r.month)) {
          monthMap.get(r.month)!.sales = Number(r.count);
          monthMap.get(r.month)!.revenue = Number(r.revenue);
        }
      }

      return res.json({
        monthlyData: Array.from(monthMap.entries()).map(([month, d]) => ({
          month,
          label: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
          signups: d.signups,
          sales: d.sales,
          revenue: d.revenue,
        })),
        revenueBreakdown: {
          ticketFees: Math.round(Number((feeTotal as any).rows?.[0]?.total ?? 0)),
          subscriptions: Number((subTotal as any).rows?.[0]?.total ?? 0),
        },
        topEvents: topEvents.rows.map((r) => ({
          id: r.id, title: r.title,
          ticketsSold: Number(r.tickets_sold), revenue: Number(r.revenue),
        })),
        topOrganizers: topOrganizers.rows.map((r) => ({
          id: r.id, businessName: r.business_name,
          revenue: Number(r.revenue), tickets: Number(r.tickets),
        })),
        avgTicketsPerEvent: Math.round(Number((avgRow as any).rows?.[0]?.avg ?? 0)),
        conversionRate: totalOrgs?.count > 0
          ? Math.round((Number((upgradedOrgs as any).rows?.[0]?.count ?? 0) / totalOrgs.count) * 100)
          : 0,
      });
    } catch (err: any) {
      console.error("[admin/analytics]", err);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Support ───────────────────────────────────────────────────────────────

  app.get("/api/admin/support", requireAdmin, async (_req: AdminRequest, res) => {
    try {
      const failedSubaccounts = await db.execute<{ id: string; business_name: string; email: string; created_at: string }>(sql`
        SELECT o.id, o.business_name, u.email, o.created_at
        FROM organizers o JOIN users u ON u.id = o.user_id
        WHERE o.subaccount_code IS NULL AND o.test_subaccount_code IS NULL
        ORDER BY o.created_at DESC
      `);

      const unverifiedEmails = await db.execute<{ id: string; email: string; created_at: string }>(sql`
        SELECT id, email, created_at FROM users
        WHERE email_verified = false AND role = 'organizer'
        ORDER BY created_at DESC
      `);

      const emptyActiveEvents = await db.execute<{ id: string; title: string; business_name: string; created_at: string }>(sql`
        SELECT e.id, e.title, o.business_name, e.created_at
        FROM events e
        LEFT JOIN organizers o ON o.id = e.organizer_id
        WHERE e.is_active = true
          AND e.created_at < NOW() - INTERVAL '7 days'
          AND NOT EXISTS (
            SELECT 1 FROM ticket_types tt WHERE tt.event_id = e.id AND tt.quantity_sold > 0
          )
        ORDER BY e.created_at DESC
      `);

      const incompleteOnboarding = await db.execute<{ id: string; email: string; created_at: string }>(sql`
        SELECT u.id, u.email, u.created_at FROM users u
        WHERE u.role = 'organizer'
          AND NOT EXISTS (SELECT 1 FROM organizers o WHERE o.user_id = u.id)
        ORDER BY u.created_at DESC
      `);

      const allNotes = await db.select().from(adminSupportNotes);
      const noteMap = new Map(allNotes.map((n) => [n.id, n]));

      const buildFlags = (items: any[], type: string, descFn: (r: any) => string, entityFn: (r: any) => string) =>
        items.map((r) => {
          const key = `${type}:${entityFn(r)}`;
          const noteRow = noteMap.get(key);
          return { key, type, description: descFn(r), entityId: entityFn(r), createdAt: r.created_at, note: noteRow?.note ?? null, resolved: noteRow?.resolved ?? false };
        });

      return res.json([
        ...buildFlags(failedSubaccounts.rows, "failed_subaccount",
          (r) => `${r.business_name} (${r.email}) — missing Paystack subaccount`, (r) => r.id),
        ...buildFlags(unverifiedEmails.rows, "unverified_email",
          (r) => `${r.email} — unverified email`, (r) => r.id),
        ...buildFlags(emptyActiveEvents.rows, "empty_active_event",
          (r) => `"${r.title}" (${r.business_name ?? "Unknown"}) — 0 tickets sold, active >7 days`, (r) => r.id),
        ...buildFlags(incompleteOnboarding.rows, "incomplete_onboarding",
          (r) => `${r.email} — signed up but never completed onboarding`, (r) => r.id),
      ]);
    } catch (err: any) {
      console.error("[admin/support]", err);
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/support/note", requireAdmin, async (req: AdminRequest, res) => {
    try {
      const { key, note, resolved } = req.body as { key: string; note: string; resolved: boolean };
      if (!key) return res.status(400).json({ message: "Key is required" });
      await db
        .insert(adminSupportNotes)
        .values({ id: key, note: note ?? null, resolved: resolved ?? false, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: adminSupportNotes.id,
          set: { note: note ?? null, resolved: resolved ?? false, updatedAt: new Date() },
        });
      return res.json({ message: "Note saved" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
