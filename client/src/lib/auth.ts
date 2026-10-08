const TOKEN_KEY = "authToken";
const USER_KEY = "authUser";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tier: string;
  adminRole?: string[] | null;
}

/** Reads the `exp` claim (seconds since epoch) from a JWT, or null if unreadable. */
function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * Returns the stored token, or null if it is missing or past its `exp` claim.
 * An expired token is cleared so isAuthenticated() is false and pages send
 * the user to /login instead of rendering or calling the API with it.
 */
export function getToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const exp = getTokenExpiry(token);
  if (exp !== null && exp * 1000 <= Date.now()) {
    clearToken();
    return null;
  }
  return token;
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function signOut(reason?: string): void {
  clearToken();
  const target = reason ? `/login?reason=${encodeURIComponent(reason)}` : "/login";
  window.location.replace(target);
}

export function saveUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function isEmailVerified(): boolean {
  const token = getToken();
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.emailVerified !== false;
  } catch {
    return true;
  }
}

