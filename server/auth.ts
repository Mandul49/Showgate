import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { storage } from "./storage";
import { sendPasswordResetEmail, sendWelcomeEmail, sendVerificationEmail } from "./email";
import type { AdminRole } from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const JWT_EXPIRES = "7d";

// ─── Login rate limiter ───────────────────────────────────────────────────────
const MAX_LOGIN_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

interface LoginRecord { failures: number; lockedUntil: number | null }
const loginAttempts = new Map<string, LoginRecord>();

function checkLoginRateLimit(email: string): { locked: boolean; minutesLeft?: number } {
  const rec = loginAttempts.get(email);
  if (!rec?.lockedUntil) return { locked: false };
  if (Date.now() < rec.lockedUntil) {
    return { locked: true, minutesLeft: Math.ceil((rec.lockedUntil - Date.now()) / 60000) };
  }
  loginAttempts.delete(email);
  return { locked: false };
}

function recordLoginFailure(email: string) {
  const rec = loginAttempts.get(email) ?? { failures: 0, lockedUntil: null };
  rec.failures += 1;
  if (rec.failures >= MAX_LOGIN_FAILURES) rec.lockedUntil = Date.now() + LOCKOUT_MS;
  loginAttempts.set(email, rec);
}

function clearLoginAttempts(email: string) {
  loginAttempts.delete(email);
}

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  userTier?: string;
  userEmail?: string;
  userAdminRole?: AdminRole[] | null;
}

/** Returns true for any user that should bypass all subscription/tier gates. */
export function isAdminUser(role?: string | null, adminRole?: AdminRole[] | null): boolean {
  return role === "admin" || (Array.isArray(adminRole) && adminRole.includes("super_admin"));
}

/** Returns the effective tier for a user — always "pro" for admin accounts. */
export function effectiveTier(tier: string, role?: string | null, adminRole?: AdminRole[] | null): "free" | "pro" {
  return isAdminUser(role, adminRole) ? "pro" : (tier as "free" | "pro");
}

export function requireAdminRole(allowedRoles: AdminRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const roles = req.userAdminRole ?? [];
    if (!roles.length || !roles.some(r => allowedRoles.includes(r))) {
      res.status(403).json({ message: "Insufficient permissions for this action" });
      return;
    }
    next();
  };
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; role: string; tier: string };
    const user = await storage.getUserById(payload.userId);
    if (!user) return res.status(401).json({ message: "User not found. Please log in again." });
    if (user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    req.userId = payload.userId;
    req.userRole = user.role;
    req.userTier = user.tier;
    req.userEmail = user.email;
    req.userAdminRole = user.adminRole;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token. Please log in again." });
  }
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; role: string; tier: string };
    const user = await storage.getUserById(payload.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found. Please log in again." });
    }
    req.userId = payload.userId;
    req.userRole = user.role;
    req.userTier = effectiveTier(user.tier, user.role, user.adminRole);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token. Please log in again." });
  }
}

const signupSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// In-memory resend cooldown (60 seconds per email)
const resendCooldown = new Map<string, number>();

function buildTrustedBase(): string | null {
  return process.env.APP_BASE_URL
    || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0].trim()}` : null);
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const parsed = signupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const { email, password } = parsed.data;

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists. Please log in instead." });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await storage.createUser(email, passwordHash, "organizer", "free");

      // Generate and store email verification token
      const verificationToken = crypto.randomBytes(32).toString("hex");
      await storage.setEmailVerificationToken(user.id, verificationToken);

      // Send verification email — fire-and-forget, never blocks signup
      try {
        const verifyUrl = `${process.env.APP_BASE_URL}/verify-email?token=${verificationToken}`;
        await sendVerificationEmail({ to: email, verifyUrl });
        console.log("[signup] verification email dispatched for:", email);
      } catch (verifyErr: any) {
        console.error("[signup] verification email ERROR for:", email, "|", verifyErr.message, "|", JSON.stringify(verifyErr));
      }

      const token = jwt.sign(
        { userId: user.id, role: user.role, tier: user.tier },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );

      // Send welcome email — fire-and-forget, never blocks signup
      console.log("[signup] attempting welcome email for:", email);
      try {
        const firstName = email.split("@")[0].replace(/[._\-+]/g, " ").split(" ")[0];
        console.log("[signup] email value passed to sendWelcomeEmail:", email, "| firstName:", firstName);
        await sendWelcomeEmail(email, firstName.charAt(0).toUpperCase() + firstName.slice(1));
        console.log("[signup] welcome email dispatched successfully for:", email);
      } catch (emailErr: any) {
        console.error("[signup] welcome email ERROR for:", email, "|", emailErr.message, "|", JSON.stringify(emailErr));
      }

      return res.status(201).json({
        token,
        user: { id: user.id, email: user.email, role: user.role, tier: user.tier },
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request" });
      }
      const { email, password } = parsed.data;

      // Rate-limit check
      const rateCheck = checkLoginRateLimit(email);
      if (rateCheck.locked) {
        return res.status(429).json({
          message: `Too many failed attempts. Try again in ${rateCheck.minutesLeft} minute${rateCheck.minutesLeft === 1 ? "" : "s"}.`,
        });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        recordLoginFailure(email);
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        recordLoginFailure(email);
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (user.suspended) {
        return res.status(403).json({ message: "Your account has been suspended. Please contact support." });
      }

      clearLoginAttempts(email);
      storage.updateLastLogin(user.id).catch(err => console.error("[auth] updateLastLogin:", err));

      const token = jwt.sign(
        { userId: user.id, role: user.role, tier: user.tier, emailVerified: user.emailVerified, adminRole: user.adminRole ?? undefined },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );

      return res.json({
        token,
        user: { id: user.id, email: user.email, role: user.role, tier: effectiveTier(user.tier, user.role, user.adminRole), emailVerified: user.emailVerified, adminRole: user.adminRole ?? null },
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Verify email ─────────────────────────────────────────────────────────────
  app.get("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.query as { token?: string };
      if (!token) {
        return res.status(400).json({ message: "Verification token is missing." });
      }

      const user = await storage.getUserByEmailVerificationToken(token);
      if (!user) {
        return res.status(400).json({ message: "Invalid or already-used verification link." });
      }

      await storage.markEmailVerified(user.id);
      console.log(`[auth] Email verified for userId=${user.id}`);

      const newJwt = jwt.sign(
        { userId: user.id, role: user.role, tier: user.tier, emailVerified: true },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );

      return res.json({
        token: newJwt,
        user: { id: user.id, email: user.email, role: user.role, tier: effectiveTier(user.tier, user.role, user.adminRole), emailVerified: true },
      });
    } catch (err: any) {
      console.error("[auth] verify-email error:", err);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Resend verification email ─────────────────────────────────────────────────
  const resendSchema = z.object({ email: z.string().email() });

  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const parsed = resendSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Please provide a valid email address." });
      }
      const { email } = parsed.data;

      // Rate limit: 60 seconds between resends per email
      const lastSent = resendCooldown.get(email);
      if (lastSent && Date.now() - lastSent < 60_000) {
        const wait = Math.ceil((60_000 - (Date.now() - lastSent)) / 1000);
        return res.status(429).json({ message: `Please wait ${wait}s before requesting another email.`, retryAfter: wait });
      }

      const user = await storage.getUserByEmail(email);

      if (!user) {
        // Don't reveal whether email exists
        return res.json({ message: "If that email is pending verification, a new link has been sent." });
      }

      if (user.emailVerified) {
        return res.json({ message: "This account is already verified. Please log in.", alreadyVerified: true });
      }

      const verificationToken = crypto.randomBytes(32).toString("hex");
      await storage.setEmailVerificationToken(user.id, verificationToken);
      resendCooldown.set(email, Date.now());

      const trustedBase = buildTrustedBase();
      if (trustedBase) {
        const verifyUrl = `${trustedBase}/verify-email?token=${verificationToken}`;
        sendVerificationEmail({ to: email, verifyUrl }).catch((err) =>
          console.error("[auth] Failed to resend verification email:", err.message)
        );
      }

      return res.json({ message: "Verification email resent. Check your inbox." });
    } catch (err: any) {
      console.error("[auth] resend-verification error:", err);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Change password ─────────────────────────────────────────────────────────
  const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
  });

  app.patch("/api/auth/change-password", requireAuth, async (req: AuthRequest, res) => {
    try {
      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      const { currentPassword, newPassword } = parsed.data;

      const user = await storage.getUserById(req.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return res.status(400).json({ message: "Current password is incorrect" });

      const same = await bcrypt.compare(newPassword, user.passwordHash);
      if (same) return res.status(400).json({ message: "New password cannot be the same as your current password" });

      const hash = await bcrypt.hash(newPassword, 12);
      await storage.updateUserPassword(user.id, hash);
      console.log(`[auth] Password changed for userId=${user.id}`);
      return res.json({ message: "Password updated successfully." });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Change email ─────────────────────────────────────────────────────────────
  const changeEmailSchema = z.object({
    newEmail: z.string().email("Please enter a valid email address"),
    currentPassword: z.string().min(1, "Password is required"),
  });

  app.patch("/api/auth/change-email", requireAuth, async (req: AuthRequest, res) => {
    try {
      const parsed = changeEmailSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      const { newEmail, currentPassword } = parsed.data;

      const user = await storage.getUserById(req.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return res.status(400).json({ message: "Password is incorrect" });

      const existing = await storage.getUserByEmail(newEmail);
      if (existing && existing.id !== user.id) {
        return res.status(409).json({ message: "That email is already in use by another account" });
      }

      await storage.updateUserEmail(user.id, newEmail);
      console.log(`[auth] Email changed for userId=${user.id}`);
      return res.json({ message: "Email updated. Please log in again with your new email." });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Delete account ───────────────────────────────────────────────────────────
  const deleteAccountSchema = z.object({
    password: z.string().min(1, "Password is required"),
  });

  app.delete("/api/auth/account", requireAuth, async (req: AuthRequest, res) => {
    try {
      const parsed = deleteAccountSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      const user = await storage.getUserById(req.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });

      const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!valid) return res.status(400).json({ message: "Password is incorrect" });

      const organizer = await storage.getOrganizerByUserId(req.userId!);
      if (organizer) {
        const orgEvents = await storage.getEventsByOrganizerId(organizer.id);
        const activeEvents = orgEvents.filter((e) => e.isActive);
        for (const event of activeEvents) {
          const purchases = await storage.getTicketPurchasesByEventId(event.id);
          const confirmed = purchases.filter((p) => p.status === "confirmed" || p.status === "pending");
          if (confirmed.length > 0) {
            return res.status(400).json({
              message: "You have active events with ticket holders. Please cancel or complete those events before deleting your account.",
            });
          }
        }
      }

      await storage.deleteUserAccount(req.userId!);
      console.log(`[auth] Account deleted for userId=${req.userId}`);
      return res.json({ message: "Your account has been deleted." });
    } catch (err: any) {
      console.error("[auth] delete-account error:", err);
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Forgot password ─────────────────────────────────────────────────────────
  const forgotSchema = z.object({ email: z.string().email() });
  const GENERIC_FORGOT_MSG = "If that email is registered, a reset link has been sent.";

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const parsed = forgotSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Please enter a valid email address." });
      }
      const { email } = parsed.data;
      const user = await storage.getUserByEmail(email);

      if (user) {
        const token = crypto.randomBytes(32).toString("hex");
        const expires = new Date(Date.now() + 60 * 60 * 1000);
        await storage.setPasswordResetToken(user.id, token, expires);

        const trustedBase = buildTrustedBase();

        if (!trustedBase) {
          console.error("[auth] Cannot send reset email: neither APP_BASE_URL nor REPLIT_DOMAINS is set");
        } else {
          const resetUrl = `${trustedBase}/reset-password?token=${token}`;
          console.log(`[auth] Password reset requested for ${email} — token expires ${expires.toISOString()}`);
          await sendPasswordResetEmail({ to: email, resetUrl });
        }
      } else {
        console.log(`[auth] Password reset requested for unknown email ${email} — returning generic success`);
      }

      return res.json({ message: GENERIC_FORGOT_MSG });
    } catch (err: any) {
      console.error("[auth] forgot-password error:", err);
      return res.json({ message: GENERIC_FORGOT_MSG });
    }
  });

  // ── Reset password ──────────────────────────────────────────────────────────
  const resetSchema = z.object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const parsed = resetSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const { token, newPassword } = parsed.data;
      const user = await storage.getUserByResetToken(token);

      if (!user || !user.resetTokenExpires || user.resetTokenExpires.getTime() < Date.now()) {
        return res.status(400).json({ message: "Reset link has expired. Please request a new one." });
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await storage.updatePasswordAndClearResetToken(user.id, passwordHash);
      console.log(`[auth] Password reset complete for userId=${user.id}`);

      return res.json({ message: "Password updated. Please log in with your new password." });
    } catch (err: any) {
      console.error("[auth] reset-password error:", err);
      return res.status(500).json({ message: err.message || "Failed to reset password" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUserById(req.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({ id: user.id, email: user.email, role: user.role, tier: effectiveTier(user.tier, user.role, user.adminRole) });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
