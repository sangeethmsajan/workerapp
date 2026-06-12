import session from "express-session";
import Database from "better-sqlite3";
import BetterSqlite3SessionStoreFactory from "better-sqlite3-session-store";
import type { Request, Response, NextFunction, Express } from "express";
import { storage } from "./storage";
import type { User } from "@shared/schema";

const SqliteStore = BetterSqlite3SessionStoreFactory(session);

const sessionDbFile = process.env.NODE_ENV === "test" ? ":memory:" : "sessions.db";
const sessionsDb = new Database(sessionDbFile);
sessionsDb.pragma("journal_mode = WAL");

const sessionMiddleware = session({
  store: new SqliteStore({
    client: sessionsDb,
    expired: { clear: process.env.NODE_ENV !== "test", intervalMs: 1000 * 60 * 15 },
  }),
  name: "worktrack.sid",
  secret: process.env.SESSION_SECRET || "worktrack-dev-secret-change-me",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
  },
});

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function attachSession(app: Express) {
  app.use(sessionMiddleware);
}

/** Loads `req.user` from session.userId (if any). Doesn't reject — used for /api/auth/me. */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  if (req.session.userId) {
    const u = await storage.getUserById(req.session.userId);
    if (u && u.isActive === 1) {
      req.user = u;
    } else if (u && u.isActive === 0) {
      // Deactivated — destroy session.
      req.session.destroy(() => {});
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.role !== "super_admin") return res.status(403).json({ message: "Forbidden" });
  next();
}

export function getCurrentUser(req: Request): User | undefined {
  return req.user;
}

/**
 * If the current user is super_admin and request contains `?userId=N`,
 * returns N. Otherwise returns the current user's id.
 */
export function effectiveUserId(req: Request): number {
  if (!req.user) throw new Error("not authenticated");
  if (req.user.role === "super_admin" && req.query.userId) {
    const n = Number(req.query.userId);
    if (Number.isFinite(n)) return n;
  }
  return req.user.id;
}

/** True if super admin is "viewing as" another user — they shouldn't write data in that mode. */
export function isViewingAsOther(req: Request): boolean {
  if (!req.user) return false;
  if (req.user.role !== "super_admin") return false;
  if (!req.query.userId) return false;
  return Number(req.query.userId) !== req.user.id;
}

export function requireWritePermission(req: Request, res: Response, next: NextFunction) {
  if (isViewingAsOther(req)) {
    return res.status(403).json({ message: "Forbidden: Cannot write data while viewing as another user" });
  }
  next();
}
