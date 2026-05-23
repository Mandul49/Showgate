import { storage } from "./storage";
import type { Organizer, Event } from "@shared/schema";

export const FREE_MAX_ACTIVE_EVENTS = 2;
export const FREE_MAX_TICKETS_PER_EVENT = 100;
export const FREE_ALLOWED_PAYMENT_METHODS = ["paystack"];

interface TierCheckResult {
  allowed: boolean;
  message?: string;
  code?: string;
}

/**
 * Check whether an organizer (on any tier) is allowed to create or activate
 * an event with the given parameters.
 */
export async function checkEventTierLimits(
  organizer: Organizer,
  opts: {
    paymentMethod?: string;
    maxTickets?: number;
    activating?: boolean;
    excludeEventId?: string;
  }
): Promise<TierCheckResult> {
  if (organizer.tier !== "free") return { allowed: true };

  const { paymentMethod, maxTickets, activating, excludeEventId } = opts;

  if (paymentMethod && !FREE_ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
    return {
      allowed: false,
      message:
        "Free plan only supports Paystack. Upgrade to Pro for Stripe, PayPal, and Bank Transfer.",
      code: "TIER_PAYMENT_METHOD",
    };
  }

  if (maxTickets !== undefined && maxTickets > FREE_MAX_TICKETS_PER_EVENT) {
    return {
      allowed: false,
      message: `Free plan is limited to ${FREE_MAX_TICKETS_PER_EVENT} tickets per event. Upgrade to Pro for unlimited tickets.`,
      code: "TIER_MAX_TICKETS",
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
        message: `Free plan allows a maximum of ${FREE_MAX_ACTIVE_EVENTS} active events. Upgrade to Pro for unlimited events.`,
        code: "TIER_MAX_EVENTS",
      };
    }
  }

  return { allowed: true };
}

/**
 * Check whether a free-tier organizer is allowed to allocate `quantityAvailable`
 * additional tickets on an event, across all ticket types.
 * Always enforces FREE_MAX_TICKETS_PER_EVENT regardless of event.maxTickets.
 */
export async function checkTicketTypeTierLimits(
  organizer: Organizer,
  event: Event,
  opts: {
    quantityAvailable: number;
    excludeTicketTypeId?: string;
  }
): Promise<TierCheckResult> {
  if (organizer.tier !== "free") return { allowed: true };

  const allTypes = await storage.getTicketTypesByEventId(event.id);
  const otherTotal = allTypes
    .filter((t) => t.id !== opts.excludeTicketTypeId)
    .reduce((sum, t) => sum + t.quantityAvailable, 0);

  const newTotal = otherTotal + opts.quantityAvailable;
  if (newTotal > FREE_MAX_TICKETS_PER_EVENT) {
    const remaining = Math.max(0, FREE_MAX_TICKETS_PER_EVENT - otherTotal);
    return {
      allowed: false,
      message:
        remaining > 0
          ? `Free plan allows a maximum of ${FREE_MAX_TICKETS_PER_EVENT} tickets per event. You have ${otherTotal} already allocated; you can add at most ${remaining} more.`
          : `Free plan allows a maximum of ${FREE_MAX_TICKETS_PER_EVENT} tickets per event. This event is at its free-plan capacity.`,
      code: "TIER_MAX_TICKETS",
    };
  }

  return { allowed: true };
}
