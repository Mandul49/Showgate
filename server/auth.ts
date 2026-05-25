import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { storage } from "./storage";

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
