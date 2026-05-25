import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { storage } from "./storage";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const JWT_EXPIRES = "7d";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  userTier?: string;
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
    // Email verification gate — /api/auth/* routes are whitelisted so unverified
    // users can still change their password, resend verification, etc.
    if (!user.emailVerified && !req.path.startsWith("/api/auth/")) {
      return res.status(403).json({
        message: "Please verify your email to continue.",
        redirectTo: "/check-your-email",
      });
    }
    req.userId = payload.userId;
    req.userRole = payload.role;
    req.userTier = payload.tier;
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

      // Generate and store verification token
      const verificationToken = crypto.randomBytes(32).toString("hex");
      await storage.setEmailVerificationToken(user.id, verificationToken);

      // Send verification email (fire-and-forget, never log the token)
      const trustedBase = buildTrustedBase();
      if (trustedBase) {
        const verifyUrl = `${trustedBase}/verify-email?token=${verificationToken}`;
        sendVerificationEmail({ to: email, verifyUrl }).catch((err) =>
          console.error("[auth] Failed to send verification email:", err.message)
        );
      } else {
        console.warn("[auth] Cannot send verification email: APP_BASE_URL and REPLIT_DOMAINS are both unset");
      }

      const token = jwt.sign(
        { userId: user.id, role: user.role, tier: user.tier, emailVerified: false },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );

      return res.status(201).json({
        token,
        redirectTo: "/check-your-email",
        user: { id: user.id, email: user.email, role: user.role, tier: user.tier, emailVerified: false },
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

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = jwt.sign(
        { userId: user.id, role: user.role, tier: user.tier, emailVerified: user.emailVerified },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );

      return res.json({
        token,
        user: { id: user.id, email: user.email, role: user.role, tier: user.tier, emailVerified: user.emailVerified },
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
        user: { id: user.id, email: user.email, role: user.role, tier: user.tier, emailVerified: true },
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
        return res.status(429).json({ message: `Please wait ${wait}s before requesting another email.` });
      }

      const user = await storage.getUserByEmail(email);
      if (!user || user.emailVerified) {
        return res.json({ message: "If that email is pending verification, a new link has been sent." });
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

      return res.json({ message: "If that email is pending verification, a new link has been sent." });
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
      return res.json({ id: user.id, email: user.email, role: user.role, tier: user.tier });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
