import { storage } from "./storage";
import type { Organizer } from "@shared/schema";

export const FREE_MAX_ACTIVE_EVENTS = 1;
export const FREE_MAX_MONTHLY_TICKETS = 500;
export const FREE_ALLOWED_PAYMENT_METHODS = ["paystack"];
export const PRO_PAYMENT_METHODS = ["paystack", "flutterwave", "stripe", "paypal", "bank_transfer"];

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
  }
): Promise<TierCheckResult> {
  if (organizer.tier !== "free") return { allowed: true };

  const { paymentMethod, activating, excludeEventId } = opts;

  if (paymentMethod && !FREE_ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
    return {
      allowed: false,
      message: "Free plan only supports Paystack. Upgrade to Pro for Stripe, PayPal, and Bank Transfer.",
      code: "TIER_PAYMENT_METHOD",
    };
  }

  if (activating) {
    const existing = await storage.getEventsByOrganizerId(organizer.id);
    const activeCount = existing.filter(
      (e) => e.isActive && e.id !== excludeEventId
    ).length;
    if (activeCount >= FREE_MAX_ACTIVE_EVENTS) {
      return {
        allowed: false,
        message: "Free plan allows 1 active event at a time. Upgrade to Pro for unlimited events.",
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
  qty: number
): Promise<TierCheckResult> {
  if (organizer.tier !== "free") return { allowed: true };

  const sold = await storage.getMonthlyTicketCountByOrganizerId(organizer.id);
  if (sold + qty > FREE_MAX_MONTHLY_TICKETS) {
    return {
      allowed: false,
      message: "This organizer has reached their monthly ticket limit. Ask them to upgrade to Pro.",
      code: "TIER_MONTHLY_LIMIT",
    };
  }

  return { allowed: true };
}
