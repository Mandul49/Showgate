import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { storage } from "./storage";
import { sendPasswordResetEmail } from "./email";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const JWT_EXPIRES = "7d";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  userTier?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; role: string; tier: string };
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

      const token = jwt.sign(
        { userId: user.id, role: user.role, tier: user.tier },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );

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

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = jwt.sign(
        { userId: user.id, role: user.role, tier: user.tier },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );

      return res.json({
        token,
        user: { id: user.id, email: user.email, role: user.role, tier: user.tier },
      });
    } catch (err: any) {
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

        // Build reset URL ONLY from trusted server-side config — never from request headers,
        // to prevent Host/Origin header poisoning attacks that would email attacker-controlled links.
        const trustedBase = process.env.APP_BASE_URL
          || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0].trim()}` : null);

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
