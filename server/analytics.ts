import type { Express } from "express";
import { requireAuth, type AuthRequest } from "./auth";
import { storage } from "./storage";

export function registerAnalyticsRoutes(app: Express) {
  // ── GET /api/analytics/:eventId ─────────────────────────────────────────
  app.get("/api/analytics/:eventId", requireAuth, async (req: any, res) => {
    try {
      const { eventId } = req.params;

      const event = await storage.getEventById(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });

      const organizer = await storage.getOrganizerByUserId(req.user.id);
      if (!organizer || organizer.id !== event.organizerId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const [ticketTypes, purchases] = await Promise.all([
        storage.getTicketTypesByEventId(eventId),
        storage.getTicketPurchasesByEventId(eventId),
      ]);

      const confirmed = purchases.filter((p) => p.status === "confirmed");

      const totalSold = confirmed.reduce((s, p) => s + p.quantity, 0);
      const totalRevenue = confirmed.reduce((s, p) => s + p.amount, 0);
      const remaining = ticketTypes.reduce((s, tt) => s + Math.max(0, tt.quantityAvailable - tt.quantitySold), 0);

      const ticketTypeMap = new Map(ticketTypes.map((tt) => [tt.id, tt]));

      const ticketTypeSummary = ticketTypes.map((tt) => {
        const sales = confirmed.filter((p) => p.ticketTypeId === tt.id);
        const sold = sales.reduce((s, p) => s + p.quantity, 0);
        const revenue = sales.reduce((s, p) => s + p.amount, 0);
        return {
          id: tt.id,
          name: tt.name,
          price: tt.price,
          quantityAvailable: tt.quantityAvailable,
          sold,
          remaining: Math.max(0, tt.quantityAvailable - tt.quantitySold),
          revenue,
          pct: totalSold > 0 ? Math.round((sold / totalSold) * 100) : 0,
        };
      });

      // ── Free tier: 3 basic metrics + ticket type table ────────────────────
      const base = {
        tier: organizer.tier,
        event: {
          id: event.id,
          title: event.title,
          date: event.date,
          location: event.location,
          paymentMethod: event.paymentMethod,
          maxTickets: event.maxTickets,
          isActive: event.isActive,
        },
        totalSold,
        totalRevenue,
        remaining,
        ticketTypeSummary,
      };

      if (organizer.tier !== "pro") {
        return res.json(base);
      }

      // ── Pro tier: add time series, buyer list, multi-event comparison ─────

      // Group purchases by date (day)
      const byDay = new Map<string, { count: number; revenue: number }>();
      for (const p of confirmed) {
        const day = new Date(p.createdAt).toISOString().slice(0, 10);
        const prev = byDay.get(day) ?? { count: 0, revenue: 0 };
        byDay.set(day, { count: prev.count + p.quantity, revenue: prev.revenue + p.amount });
      }
      const salesOverTime = Array.from(byDay.entries())
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Unique buyers
      const uniqueEmails = new Set(confirmed.map((p) => p.buyerEmail.toLowerCase()));
      const uniqueBuyers = uniqueEmails.size;

      // Repeat buyers (bought more than once across this event's purchases)
      const emailCount = new Map<string, number>();
      for (const p of confirmed) {
        const key = p.buyerEmail.toLowerCase();
        emailCount.set(key, (emailCount.get(key) ?? 0) + 1);
      }
      const repeatBuyers = Array.from(emailCount.values()).filter((v) => v > 1).length;

      // Recent buyers (for table + CSV), newest first, max 200
      const recentBuyers = confirmed
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 200)
        .map((p) => ({
          name: p.buyerName,
          email: p.buyerEmail,
          phone: p.buyerPhone,
          ticketType: ticketTypeMap.get(p.ticketTypeId)?.name ?? "—",
          quantity: p.quantity,
          amount: p.amount,
          reference: p.reference,
          date: new Date(p.createdAt).toISOString(),
          status: p.status,
        }));

      // Multi-event comparison (all events for this organizer)
      const allEvents = await storage.getEventsByOrganizerId(organizer.id);
      const allEventsSummary = await Promise.all(
        allEvents.map(async (ev) => {
          const evPurchases = await storage.getTicketPurchasesByEventId(ev.id);
          const evConfirmed = evPurchases.filter((p) => p.status === "confirmed");
          return {
            id: ev.id,
            title: ev.title,
            date: ev.date,
            isActive: ev.isActive,
            totalSold: evConfirmed.reduce((s, p) => s + p.quantity, 0),
            totalRevenue: evConfirmed.reduce((s, p) => s + p.amount, 0),
          };
        })
      );

      return res.json({
        ...base,
        salesOverTime,
        uniqueBuyers,
        repeatBuyers,
        recentBuyers,
        allEventsSummary,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
