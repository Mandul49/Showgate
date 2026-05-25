import type { Express } from "express";
import { requireAuth, type AuthRequest } from "./auth";
import { storage } from "./storage";

export function registerAnalyticsRoutes(app: Express) {
  // ── GET /api/organizer/events/:eventId/purchases/export ──────────────────
  app.get("/api/organizer/events/:eventId/purchases/export", requireAuth, async (req: any, res) => {
    try {
      const { eventId } = req.params;

      const event = await storage.getEventById(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });

      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer || organizer.id !== event.organizerId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const orders = await storage.getOrdersByEventId(eventId);
      const confirmed = orders.filter((o) => o.status === "confirmed");

      const header = [
        "Order Reference",
        "Buyer Name",
        "Buyer Email",
        "Buyer Phone",
        "Ticket Type",
        "Quantity",
        "Amount Paid",
        "Purchase Date",
        "Event Name",
      ];

      const rows = confirmed
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
        .map((o) => [
          o.id.toUpperCase(),
          o.customerName,
          o.customerEmail,
          o.customerPhone,
          o.ticketType,
          o.quantity,
          o.totalAmount,
          new Date(o.createdAt!).toLocaleString("en-GB"),
          event.title,
        ]);

      const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const csv = [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");

      const filename = `${event.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_purchases.csv`;
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(csv);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── GET /api/analytics/:eventId ─────────────────────────────────────────
  app.get("/api/analytics/:eventId", requireAuth, async (req: any, res) => {
    try {
      const { eventId } = req.params;

      const event = await storage.getEventById(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });

      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!organizer || organizer.id !== event.organizerId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const [ticketTypes, orders] = await Promise.all([
        storage.getTicketTypesByEventId(eventId),
        storage.getOrdersByEventId(eventId),
      ]);

      // Source of truth: orders table (confirmed status)
      const confirmed = orders.filter((o) => o.status === "confirmed");

      const totalSold = confirmed.reduce((s, o) => s + o.quantity, 0);
      const totalRevenue = confirmed.reduce((s, o) => s + o.totalAmount, 0);
      const remaining = ticketTypes.reduce((s, tt) => s + Math.max(0, tt.quantityAvailable - tt.quantitySold), 0);

      // Per-ticket-type breakdown: join orders to ticket types via ticketTypeId or ticketType name
      const ticketTypeSummary = ticketTypes.map((tt) => {
        const sales = confirmed.filter((o) =>
          o.ticketTypeId === tt.id || o.ticketType === tt.name
        );
        const sold = sales.reduce((s, o) => s + o.quantity, 0);
        const revenue = sales.reduce((s, o) => s + o.totalAmount, 0);
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

      console.log("[analytics] Final response for event", eventId, {
        totalSold,
        totalRevenue,
        confirmedOrders: confirmed.length,
        ticketTypeSummary: ticketTypeSummary.map((t) => ({ name: t.name, sold: t.sold, revenue: t.revenue })),
      });

      if (organizer.tier !== "pro") {
        return res.json(base);
      }

      // ── Pro tier: time series, buyer list, multi-event comparison ─────────

      const byDay = new Map<string, { count: number; revenue: number }>();
      for (const o of confirmed) {
        const day = new Date(o.createdAt!).toISOString().slice(0, 10);
        const prev = byDay.get(day) ?? { count: 0, revenue: 0 };
        byDay.set(day, { count: prev.count + o.quantity, revenue: prev.revenue + o.totalAmount });
      }
      const salesOverTime = Array.from(byDay.entries())
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const uniqueEmails = new Set(confirmed.map((o) => o.customerEmail.toLowerCase()));
      const uniqueBuyers = uniqueEmails.size;

      const emailCount = new Map<string, number>();
      for (const o of confirmed) {
        const key = o.customerEmail.toLowerCase();
        emailCount.set(key, (emailCount.get(key) ?? 0) + 1);
      }
      const repeatBuyers = Array.from(emailCount.values()).filter((v) => v > 1).length;

      const recentBuyers = confirmed
        .slice()
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
        .slice(0, 200)
        .map((o) => ({
          name: o.customerName,
          email: o.customerEmail,
          phone: o.customerPhone,
          ticketType: o.ticketType,
          quantity: o.quantity,
          amount: o.totalAmount,
          reference: o.id,
          date: new Date(o.createdAt!).toISOString(),
          status: o.status,
        }));

      const allEvents = await storage.getEventsByOrganizerId(organizer.id);
      const allEventsSummary = await Promise.all(
        allEvents.map(async (ev) => {
          const evOrders = await storage.getOrdersByEventId(ev.id);
          const evConfirmed = evOrders.filter((o) => o.status === "confirmed");
          return {
            id: ev.id,
            title: ev.title,
            date: ev.date,
            isActive: ev.isActive,
            totalSold: evConfirmed.reduce((s, o) => s + o.quantity, 0),
            totalRevenue: evConfirmed.reduce((s, o) => s + o.totalAmount, 0),
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
