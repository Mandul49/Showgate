import { storage } from "./storage";
import type { Organizer } from "@shared/schema";

export const FREE_ALLOWED_PAYMENT_METHODS = ["paystack"];
export const PRO_PAYMENT_METHODS = ["paystack", "flutterwave", "bank_transfer"];

export async function getFreeMaxActiveEvents(): Promise<number> {
  const val = await storage.getPlatformSetting("free_max_active_events", "1");
  return parseInt(val, 10) || 1;
}

export async function getFreeMaxMonthlyTickets(): Promise<number> {
  const val = await storage.getPlatformSetting("free_max_monthly_tickets", "500");
  return parseInt(val, 10) || 500;
}

interface TierCheckResult {
  allowed: boolean;
  message?: string;
  code?: string;
}

/**
 * Check whether an organizer is allowed to create or activate an event.
 * Free tier: max 1 active event at a time; Paystack only.
 * No per-event ticket count limit — monthly purchase limit applies at purchase time.
 */
export async function checkEventTierLimits(
  organizer: Organizer,
  opts: {
    paymentMethod?: string;
    activating?: boolean;
    excludeEventId?: string;
    userRole?: string;
  }
): Promise<TierCheckResult> {
  if (opts.userRole === "admin") return { allowed: true };
  if (organizer.tier !== "free") return { allowed: true };

  const { paymentMethod, activating, excludeEventId } = opts;

  if (paymentMethod && !FREE_ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
    return {
      allowed: false,
      message: "Free plan only supports Paystack. Upgrade to Pro for Flutterwave and Bank Transfer.",
      code: "TIER_PAYMENT_METHOD",
    };
  }

  if (activating) {
    const maxActiveEvents = await getFreeMaxActiveEvents();
    const existing = await storage.getEventsByOrganizerId(organizer.id);
    const activeCount = existing.filter(
      (e) => e.isActive && e.id !== excludeEventId
    ).length;
    if (activeCount >= maxActiveEvents) {
      return {
        allowed: false,
        message: `Free plan allows ${maxActiveEvents} active event${maxActiveEvents === 1 ? "" : "s"} at a time. Upgrade to Pro for unlimited events.`,
        code: "TIER_MAX_EVENTS",
      };
    }
  }

  return { allowed: true };
}

/**
 * Check whether a free-tier organizer has remaining monthly ticket capacity
 * before fulfilling a purchase of `qty` tickets.
 */
export async function checkMonthlyTicketLimit(
  organizer: Organizer,
  qty: number,
  userRole?: string
): Promise<TierCheckResult> {
  if (userRole === "admin") return { allowed: true };
  if (organizer.tier !== "free") return { allowed: true };

  const maxMonthlyTickets = await getFreeMaxMonthlyTickets();
  const sold = await storage.getMonthlyTicketCountByOrganizerId(organizer.id);
  if (sold + qty > maxMonthlyTickets) {
    return {
      allowed: false,
      message: "This organizer has reached their monthly ticket limit. Ask them to upgrade to Pro.",
      code: "TIER_MONTHLY_LIMIT",
    };
  }

  return { allowed: true };
}
