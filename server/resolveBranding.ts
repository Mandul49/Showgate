import type { BrandTheme, Event, Organizer } from "@shared/schema";

export interface ResolvedBranding {
  active: boolean;
  customBrandName: string | null;
  customLogoUrl: string | null;
  brandTheme: BrandTheme | null;
}

// Event-level override wins field by field; anything unset falls back to the organizer default.
export function resolveBranding(
  organizer: Organizer | null | undefined,
  event?: Pick<Event, "brandingOverride"> | null,
): ResolvedBranding {
  const active = organizer?.tier === "pro" && organizer.brandingEnabled !== false;
  const o = event?.brandingOverride;
  return {
    active,
    customBrandName: o?.customBrandName || organizer?.customBrandName || null,
    customLogoUrl: o?.customLogoUrl || organizer?.customLogoUrl || null,
    brandTheme: o?.brandTheme ?? organizer?.brandTheme ?? null,
  };
}
