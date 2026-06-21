import type { Express } from "express";
import { requireAuth, isAdminUser, type AuthRequest } from "./auth";
import { storage } from "./storage";

export function registerAnalyticsRoutes(app: Express) {
  // ── GET /api/organizer/events/:eventId/purchases/export ──────────────────
  app.get("/api/organizer/events/:eventId/purchases/export", requireAuth, async (req: any, res) => {
    try {
      const { eventId } = req.params;

      const event = await storage.getEventById(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });

      const isAdmin = isAdminUser(req.userRole);
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!isAdmin && (!organizer || organizer.id !== event.organizerId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Admins always get Pro-tier analytics; resolve the organizer's event list by the event's owner
      const analyticsOrganizerId = organizer?.id ?? event.organizerId;
      const analyticsTier: "free" | "pro" = isAdmin ? "pro" : (organizer!.tier as "free" | "pro");

      const ticketTypeList = await storage.getTicketTypesByEventId(eventId);
      const groupSizeMap = new Map(ticketTypeList.map((tt) => [tt.id, tt.groupSize]));

      const allOrders = await storage.getOrdersByEventId(eventId);
      const confirmed = allOrders.filter((o) => o.status === "confirmed");

      // Expand group tickets — one row per attendee
      const rows: string[][] = [];
      for (const o of confirmed.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())) {
        const attendees = (o.attendeeDetails as { name: string; email?: string }[] | null) ?? [];
        const groupSize = o.ticketTypeId ? (groupSizeMap.get(o.ticketTypeId) ?? 1) : 1;

        if (attendees.length > 0) {
          attendees.forEach((a, i) => {
            rows.push([
              o.id.toUpperCase(),
              o.customerName,
              o.customerEmail,
              o.customerPhone,
              o.ticketType,
              String(o.quantity),
              String(o.totalAmount),
              new Date(o.createdAt!).toLocaleString("en-GB"),
              event.title,
              a.name || "",
              a.email || "",
              String(i + 1),
              String(groupSize),
            ]);
          });
        } else {
          rows.push([
            o.id.toUpperCase(),
            o.customerName,
            o.customerEmail,
            o.customerPhone,
            o.ticketType,
            String(o.quantity),
            String(o.totalAmount),
            new Date(o.createdAt!).toLocaleString("en-GB"),
            event.title,
            o.customerName,
            o.customerEmail,
            "1",
            String(groupSize),
          ]);
        }
      }

      const header = [
        "Order Reference",
        "Buyer Name",
        "Buyer Email",
        "Buyer Phone",
        "Ticket Type",
        "Tickets Purchased",
        "Amount Paid",
        "Purchase Date",
        "Event Name",
        "Attendee Name",
        "Attendee Email",
        "Attendee #",
        "Group Size",
      ];

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

      const isAdmin = isAdminUser(req.userRole);
      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (!isAdmin && (!organizer || organizer.id !== event.organizerId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Admins always get Pro-tier analytics; resolve the organizer's event list by the event's owner
      const analyticsOrganizerId = organizer?.id ?? event.organizerId;
      const analyticsTier: "free" | "pro" = isAdmin ? "pro" : (organizer!.tier as "free" | "pro");

      const [ticketTypeList, allOrders, discountCodeList] = await Promise.all([
        storage.getTicketTypesByEventId(eventId),
        storage.getOrdersByEventId(eventId),
        storage.getDiscountCodesByEventId(eventId),
      ]);

      // Source of truth: orders table (confirmed status)
      const confirmed = allOrders.filter((o) => o.status === "confirmed");

      const totalSold = confirmed.reduce((s, o) => s + o.quantity, 0);
      const totalRevenue = confirmed.reduce((s, o) => s + o.totalAmount, 0);
      const totalDiscountGiven = confirmed.reduce((s, o) => s + (o.discountAmount ?? 0), 0);
      const remaining = ticketTypeList.reduce((s, tt) => s + Math.max(0, tt.quantityAvailable - tt.quantitySold), 0);

      // Per-ticket-type breakdown: join orders to ticket types via ticketTypeId or ticketType name
      const ticketTypeSummary = ticketTypeList.map((tt) => {
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
          groupSize: tt.groupSize,
          groupLabel: tt.groupLabel,
          sold,
          remaining: Math.max(0, tt.quantityAvailable - tt.quantitySold),
          revenue,
          pct: totalSold > 0 ? Math.round((sold / totalSold) * 100) : 0,
        };
      });

      // Discount code usage stats
      const discountStats = discountCodeList.map((dc) => {
        const usedOrders = confirmed.filter((o) => o.discountCode === dc.code);
        const totalDiscount = usedOrders.reduce((s, o) => s + (o.discountAmount ?? 0), 0);
        return {
          id: dc.id,
          code: dc.code,
          type: dc.type,
          value: dc.value,
          timesUsed: dc.timesUsed,
          usageLimit: dc.usageLimit,
          totalDiscountGiven: totalDiscount,
          expiresAt: dc.expiresAt ? dc.expiresAt.toISOString() : null,
        };
      });

      const base = {
        tier: analyticsTier,
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
        totalDiscountGiven,
        remaining,
        ticketTypeSummary,
        discountStats,
      };

      if (analyticsTier !== "pro") {
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
          discountCode: o.discountCode ?? null,
          discountAmount: o.discountAmount ?? 0,
          attendeeDetails: (o.attendeeDetails as { name: string; email?: string }[] | null) ?? [],
          reference: o.id,
          date: new Date(o.createdAt!).toISOString(),
          status: o.status,
        }));

      // Survey breakdown (Pro only)
      function buildBreakdown(field: "gender" | "ageRange" | "heardFrom") {
        const counts = new Map<string, number>();
        for (const o of confirmed) {
          const val = (o as any)[field];
          if (val) counts.set(val, (counts.get(val) ?? 0) + 1);
        }
        const total = Array.from(counts.values()).reduce((s, v) => s + v, 0);
        return Array.from(counts.entries())
          .map(([label, count]) => ({ label, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
          .sort((a, b) => b.count - a.count);
      }
      const genderBreakdown = buildBreakdown("gender");
      const ageRangeBreakdown = buildBreakdown("ageRange");
      const heardFromBreakdown = buildBreakdown("heardFrom");
      const surveyRespondents = confirmed.filter((o) => (o as any).gender || (o as any).ageRange || (o as any).heardFrom).length;
      const surveyResponseRate = confirmed.length > 0 ? Math.round((surveyRespondents / confirmed.length) * 100) : 0;

      const allEvents = await storage.getEventsByOrganizerId(analyticsOrganizerId);
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
        genderBreakdown,
        ageRangeBreakdown,
        heardFromBreakdown,
        surveyResponseRate,
        allEventsSummary,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
