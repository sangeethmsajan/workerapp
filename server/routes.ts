import type { Express, Request, Response } from "express";
import type { Server } from "node:http";
import { storage, seedNewUserData } from "./storage";
import {
  insertProjectSchema, insertWorkerSchema, insertTaskSchema,
  insertAttendanceSchema, insertExpenseSchema, insertInvoiceSchema, insertSettingsSchema,
} from "@shared/schema";
import type { ZodSchema } from "zod";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { attachSession, loadUser, requireAuth, requireAdmin, effectiveUserId, requireWritePermission } from "./auth";

function asyncH(fn: (req: Request, res: Response) => Promise<any>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      console.error(err);
      res.status(500).json({ message: err?.message || "Internal error" });
    });
  };
}

function validate<T>(schema: ZodSchema<T>, body: any, res: Response): T | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    res.status(400).json({ message: "Validation failed", errors: result.error.flatten() });
    return null;
  }
  return result.data;
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

function publicUser(u: { id: number; email: string; name: string; role: string; googleId: string | null; avatar: string | null; passwordHash: string | null; createdAt: string; isActive: number }) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    googleId: u.googleId,
    avatar: u.avatar,
    hasPassword: !!u.passwordHash,
    createdAt: u.createdAt,
    isActive: u.isActive,
  };
}

async function verifyGoogleCredential(credential: string) {
  if (!googleClient) throw new Error("Google Sign-In not configured");
  const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) throw new Error("Invalid Google token");
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email,
    picture: payload.picture || null,
  };
}

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
const googleSchema = z.object({ credential: z.string().min(1) });
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});
const updateUserSchema = z.object({
  isActive: z.number().int().min(0).max(1).optional(),
  role: z.enum(["super_admin", "user"]).optional(),
  name: z.string().min(1).optional(),
});

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Sessions + loadUser BEFORE any route.
  attachSession(app);
  app.use(loadUser);

  // ----- auth (public) -----
  app.post("/api/auth/signup", asyncH(async (req, res) => {
    const data = validate(signupSchema, req.body, res); if (!data) return;
    const existing = await storage.getUserByEmail(data.email);
    if (existing) return res.status(409).json({ message: "Email already registered" });
    const passwordHash = bcrypt.hashSync(data.password, 10);
    const user = await storage.createUser({
      email: data.email,
      passwordHash,
      name: data.name,
      role: "user",
      googleId: null,
      avatar: null,
      createdAt: new Date().toISOString(),
      isActive: 1,
    });
    await seedNewUserData(user.id, data.name);
    req.session.userId = user.id;
    res.json(publicUser(user));
  }));

  app.post("/api/auth/login", asyncH(async (req, res) => {
    const data = validate(loginSchema, req.body, res); if (!data) return;
    const user = await storage.getUserByEmail(data.email);
    if (!user || user.isActive !== 1 || !user.passwordHash) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    if (!bcrypt.compareSync(data.password, user.passwordHash)) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    req.session.userId = user.id;
    res.json(publicUser(user));
  }));

  app.post("/api/auth/logout", asyncH(async (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("worktrack.sid");
      res.json({ ok: true });
    });
  }));

  app.get("/api/auth/me", asyncH(async (req, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    res.json(publicUser(req.user));
  }));

  app.post("/api/auth/google", asyncH(async (req, res) => {
    const data = validate(googleSchema, req.body, res); if (!data) return;
    if (!googleClient) return res.status(503).json({ message: "Google Sign-In not configured on server" });
    let info;
    try {
      info = await verifyGoogleCredential(data.credential);
    } catch (e: any) {
      return res.status(401).json({ message: e?.message || "Invalid Google token" });
    }
    // 1) Match by googleId
    let user = await storage.getUserByGoogleId(info.sub);
    if (!user) {
      // 2) Match by email — link
      user = await storage.getUserByEmail(info.email);
      if (user) {
        user = await storage.updateUser(user.id, { googleId: info.sub, avatar: info.picture || user.avatar });
      }
    }
    if (!user) {
      // 3) Create new
      user = await storage.createUser({
        email: info.email,
        passwordHash: null,
        name: info.name,
        role: "user",
        googleId: info.sub,
        avatar: info.picture,
        createdAt: new Date().toISOString(),
        isActive: 1,
      });
      await seedNewUserData(user.id, info.name);
    }
    if (!user || user.isActive !== 1) {
      return res.status(403).json({ message: "Account disabled" });
    }
    req.session.userId = user.id;
    res.json(publicUser(user));
  }));

  app.post("/api/auth/change-password", requireAuth, asyncH(async (req, res) => {
    const data = validate(changePasswordSchema, req.body, res); if (!data) return;
    const u = req.user!;
    if (!u.passwordHash) {
      // First-time setting password
      const hash = bcrypt.hashSync(data.newPassword, 10);
      const updated = await storage.updateUser(u.id, { passwordHash: hash });
      return res.json(publicUser(updated!));
    }
    if (!bcrypt.compareSync(data.currentPassword, u.passwordHash)) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }
    const hash = bcrypt.hashSync(data.newPassword, 10);
    const updated = await storage.updateUser(u.id, { passwordHash: hash });
    res.json(publicUser(updated!));
  }));

  app.post("/api/auth/link-google", requireAuth, asyncH(async (req, res) => {
    const data = validate(googleSchema, req.body, res); if (!data) return;
    if (!googleClient) return res.status(503).json({ message: "Google Sign-In not configured" });
    let info;
    try { info = await verifyGoogleCredential(data.credential); }
    catch (e: any) { return res.status(401).json({ message: e?.message || "Invalid Google token" }); }
    // Ensure this googleId isn't linked to a different account
    const owner = await storage.getUserByGoogleId(info.sub);
    if (owner && owner.id !== req.user!.id) {
      return res.status(409).json({ message: "This Google account is already linked to another user" });
    }
    const updated = await storage.updateUser(req.user!.id, {
      googleId: info.sub,
      avatar: info.picture || req.user!.avatar,
    });
    res.json(publicUser(updated!));
  }));

  app.post("/api/auth/unlink-google", requireAuth, asyncH(async (req, res) => {
    const u = req.user!;
    if (!u.passwordHash) {
      return res.status(400).json({ message: "Set a password before unlinking Google" });
    }
    const updated = await storage.updateUser(u.id, { googleId: null });
    res.json(publicUser(updated!));
  }));

  app.get("/api/auth/config", (_req, res) => {
    res.json({ googleEnabled: !!googleClient });
  });

  // ----- ALL other routes require auth -----
  // ----- projects -----
  app.get("/api/projects", requireAuth, asyncH(async (req, res) => {
    res.json(await storage.listProjects(effectiveUserId(req)));
  }));
  app.get("/api/projects/:id", requireAuth, asyncH(async (req, res) => {
    const item = await storage.getProject(Number(req.params.id), effectiveUserId(req));
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  }));
  app.post("/api/projects", requireAuth, requireWritePermission, asyncH(async (req, res) => {
    const data = validate(insertProjectSchema.omit({ userId: true } as any), req.body, res); if (!data) return;
    res.json(await storage.createProject({ ...data, userId: effectiveUserId(req) } as any));
  }));
  app.patch("/api/projects/:id", requireAuth, requireWritePermission, asyncH(async (req, res) => {
    const data = validate(insertProjectSchema.omit({ userId: true } as any).partial(), req.body, res); if (!data) return;
    const item = await storage.updateProject(Number(req.params.id), effectiveUserId(req), data);
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  }));
  app.delete("/api/projects/:id", requireAuth, requireWritePermission, asyncH(async (req, res) => {
    const ok = await storage.deleteProject(Number(req.params.id), effectiveUserId(req));
    res.json({ ok });
  }));

  // ----- workers -----
  app.get("/api/workers", requireAuth, asyncH(async (req, res) => {
    res.json(await storage.listWorkers(effectiveUserId(req)));
  }));
  app.get("/api/workers/:id", requireAuth, asyncH(async (req, res) => {
    const item = await storage.getWorker(Number(req.params.id), effectiveUserId(req));
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  }));
  app.post("/api/workers", requireAuth, requireWritePermission, asyncH(async (req, res) => {
    const data = validate(insertWorkerSchema.omit({ userId: true } as any), req.body, res); if (!data) return;
    res.json(await storage.createWorker({ ...data, userId: effectiveUserId(req) } as any));
  }));
  app.patch("/api/workers/:id", requireAuth, requireWritePermission, asyncH(async (req, res) => {
    const data = validate(insertWorkerSchema.omit({ userId: true } as any).partial(), req.body, res); if (!data) return;
    const item = await storage.updateWorker(Number(req.params.id), effectiveUserId(req), data);
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  }));
  app.delete("/api/workers/:id", requireAuth, requireWritePermission, asyncH(async (req, res) => {
    const ok = await storage.deleteWorker(Number(req.params.id), effectiveUserId(req));
    res.json({ ok });
  }));

  // ----- tasks -----
  app.get("/api/tasks", requireAuth, asyncH(async (req, res) => {
    res.json(await storage.listTasks(effectiveUserId(req)));
  }));
  app.get("/api/tasks/:id", requireAuth, asyncH(async (req, res) => {
    const item = await storage.getTask(Number(req.params.id), effectiveUserId(req));
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  }));
  app.post("/api/tasks", requireAuth, requireWritePermission, asyncH(async (req, res) => {
    const data = validate(insertTaskSchema.omit({ userId: true } as any), req.body, res); if (!data) return;
    res.json(await storage.createTask({ ...data, userId: effectiveUserId(req) } as any));
  }));
  app.patch("/api/tasks/:id", requireAuth, requireWritePermission, asyncH(async (req, res) => {
    const data = validate(insertTaskSchema.omit({ userId: true } as any).partial(), req.body, res); if (!data) return;
    const item = await storage.updateTask(Number(req.params.id), effectiveUserId(req), data);
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  }));
  app.delete("/api/tasks/:id", requireAuth, requireWritePermission, asyncH(async (req, res) => {
    const ok = await storage.deleteTask(Number(req.params.id), effectiveUserId(req));
    res.json({ ok });
  }));

  // ----- attendance -----
  app.get("/api/attendance", requireAuth, asyncH(async (req, res) => {
    res.json(await storage.listAttendance(effectiveUserId(req)));
  }));
  app.get("/api/attendance/:id", requireAuth, asyncH(async (req, res) => {
    const item = await storage.getAttendance(Number(req.params.id), effectiveUserId(req));
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  }));
  app.post("/api/attendance", requireAuth, requireWritePermission, asyncH(async (req, res) => {
    const data = validate(insertAttendanceSchema.omit({ userId: true } as any), req.body, res); if (!data) return;
    res.json(await storage.createAttendance({ ...data, userId: effectiveUserId(req) } as any));
  }));
  app.patch("/api/attendance/:id", requireAuth, requireWritePermission, asyncH(async (req, res) => {
    const data = validate(insertAttendanceSchema.omit({ userId: true } as any).partial(), req.body, res); if (!data) return;
    const item = await storage.updateAttendance(Number(req.params.id), effectiveUserId(req), data);
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  }));
  app.delete("/api/attendance/:id", requireAuth, requireWritePermission, asyncH(async (req, res) => {
    const ok = await storage.deleteAttendance(Number(req.params.id), effectiveUserId(req));
    res.json({ ok });
  }));

  // ----- expenses -----
  app.get("/api/expenses", requireAuth, asyncH(async (req, res) => {
    res.json(await storage.listExpenses(effectiveUserId(req)));
  }));
  app.get("/api/expenses/:id", requireAuth, asyncH(async (req, res) => {
    const item = await storage.getExpense(Number(req.params.id), effectiveUserId(req));
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  }));
  app.post("/api/expenses", requireAuth, requireWritePermission, asyncH(async (req, res) => {
    const data = validate(insertExpenseSchema.omit({ userId: true } as any), req.body, res); if (!data) return;
    res.json(await storage.createExpense({ ...data, userId: effectiveUserId(req) } as any));
  }));
  app.patch("/api/expenses/:id", requireAuth, requireWritePermission, asyncH(async (req, res) => {
    const data = validate(insertExpenseSchema.omit({ userId: true } as any).partial(), req.body, res); if (!data) return;
    const item = await storage.updateExpense(Number(req.params.id), effectiveUserId(req), data);
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  }));
  app.delete("/api/expenses/:id", requireAuth, requireWritePermission, asyncH(async (req, res) => {
    const ok = await storage.deleteExpense(Number(req.params.id), effectiveUserId(req));
    res.json({ ok });
  }));

  // ----- invoices -----
  app.get("/api/invoices", requireAuth, asyncH(async (req, res) => {
    res.json(await storage.listInvoices(effectiveUserId(req)));
  }));
  app.get("/api/invoices/:id", requireAuth, asyncH(async (req, res) => {
    const item = await storage.getInvoice(Number(req.params.id), effectiveUserId(req));
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  }));
  app.post("/api/invoices", requireAuth, requireWritePermission, asyncH(async (req, res) => {
    const data = validate(insertInvoiceSchema.omit({ userId: true } as any), req.body, res); if (!data) return;
    res.json(await storage.createInvoice({ ...data, userId: effectiveUserId(req) } as any));
  }));
  app.patch("/api/invoices/:id", requireAuth, requireWritePermission, asyncH(async (req, res) => {
    const data = validate(insertInvoiceSchema.omit({ userId: true } as any).partial(), req.body, res); if (!data) return;
    const item = await storage.updateInvoice(Number(req.params.id), effectiveUserId(req), data);
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  }));
  app.delete("/api/invoices/:id", requireAuth, requireWritePermission, asyncH(async (req, res) => {
    const ok = await storage.deleteInvoice(Number(req.params.id), effectiveUserId(req));
    res.json({ ok });
  }));

  // ----- settings (per-user) -----
  app.get("/api/settings", requireAuth, asyncH(async (req, res) => {
    res.json(await storage.getSettings(effectiveUserId(req), req.user!.name));
  }));
  app.get("/api/settings/1", requireAuth, asyncH(async (req, res) => {
    res.json(await storage.getSettings(effectiveUserId(req), req.user!.name));
  }));
  app.patch("/api/settings/1", requireAuth, requireWritePermission, asyncH(async (req, res) => {
    const data = validate(insertSettingsSchema.omit({ userId: true } as any).partial(), req.body, res); if (!data) return;
    res.json(await storage.updateSettings(effectiveUserId(req), data));
  }));

  // ----- admin -----
  app.get("/api/admin/users", requireAdmin, asyncH(async (_req, res) => {
    const all = await storage.listUsers();
    const out: any[] = [];
    for (const u of all) {
      const ps = await storage.listProjects(u.id);
      out.push({ ...publicUser(u), projectCount: ps.length });
    }
    res.json(out);
  }));
  app.patch("/api/admin/users/:id", requireAdmin, asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const data = validate(updateUserSchema, req.body, res); if (!data) return;
    if (id === req.user!.id && data.isActive === 0) {
      return res.status(400).json({ message: "Cannot deactivate yourself" });
    }
    const u = await storage.updateUser(id, data);
    if (!u) return res.status(404).json({ message: "Not found" });
    res.json(publicUser(u));
  }));
  app.delete("/api/admin/users/:id", requireAdmin, asyncH(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user!.id) return res.status(400).json({ message: "Cannot delete yourself" });
    const u = await storage.updateUser(id, { isActive: 0 });
    if (!u) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  }));

  return httpServer;
}
