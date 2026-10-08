import { getToken, signOut } from "./auth";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export function resolveUrl(url: string): string {
  if (url.startsWith("/") && API_BASE) return `${API_BASE}${url}`;
  return url;
}

export class AuthExpiredError extends Error {
  authExpired = true;
  constructor(message = "Session expired. Please log in again.") {
    super(message);
    this.name = "AuthExpiredError";
  }
}

/**
 * Same as apiFetch but never treats 401 specially. Only use this for callers
 * that explicitly want to handle 401 themselves (e.g. `on401: "returnNull"`).
 */
export async function apiFetchRaw(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(resolveUrl(url), {
    ...init,
    headers,
    credentials: "include",
  });
}

/**
 * Shared fetch helper. Attaches the auth token and signs the user out on 401.
 * There is no refresh mechanism, so a 401 is never retried and never resolved
 * as "no data".
 */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await apiFetchRaw(url, init);
  if (res.status === 401) {
    signOut("session_expired");
    throw new AuthExpiredError();
  }
  return res;
}

export type BankStatus =
  | {
      state: "ready";
      organizer: {
        id: string;
        businessName: string;
        subaccountCode: string | null;
        hasLiveSubaccount: boolean;
        testSubaccountCode: string | null;
        hasTestSubaccount: boolean;
        bankName: string | null;
        accountNumber: string | null;
        tier: string;
      };
    }
  | { state: "no_bank_account" }
  | { state: "unknown"; reason: string };

/**
 * The ONLY function in the client that calls GET /api/onboarding/status.
 * "no_bank_account" is returned only when the server answers 200 with
 * completed === false. Every failure maps to "unknown".
 */
export async function fetchBankAccountStatus(): Promise<BankStatus> {
  try {
    const res = await apiFetch("/api/onboarding/status");
    if (res.status !== 200) return { state: "unknown", reason: "error" };
    const body = await res.json();
    if (body?.completed === true) return { state: "ready", organizer: body.organizer };
    if (body?.completed === false) return { state: "no_bank_account" };
    return { state: "unknown", reason: "error" };
  } catch (err: any) {
    if (err?.authExpired) return { state: "unknown", reason: "session" };
    return { state: "unknown", reason: "error" };
  }
}
