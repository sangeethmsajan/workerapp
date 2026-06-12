import {
  users, projects, workers, tasks, attendance, expenses, invoices, settings,
} from "@shared/schema";
import type {
  User, InsertUser,
  Project, InsertProject,
  Worker, InsertWorker,
  Task, InsertTask,
  Attendance, InsertAttendance,
  Expense, InsertExpense,
  Invoice, InsertInvoice,
  Settings, InsertSettings,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, SQL } from "drizzle-orm";
import bcrypt from "bcryptjs";

const dbFile = process.env.NODE_ENV === "test" ? ":memory:" : "data.db";
const sqlite = new Database(dbFile);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Auto-create tables (instead of drizzle migrations) so the app boots fresh.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    google_id TEXT UNIQUE,
    avatar TEXT,
    created_at TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    budget INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active'
  );
  CREATE TABLE IF NOT EXISTS workers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    daily_wage INTEGER NOT NULL,
    site TEXT NOT NULL,
    avatar TEXT NOT NULL,
    color TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    project_id INTEGER,
    assignee_id INTEGER,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    worker_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'present'
  );
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    project_id INTEGER,
    amount INTEGER NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    client_name TEXT NOT NULL,
    project_id INTEGER,
    amount INTEGER NOT NULL,
    date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    line_items TEXT NOT NULL DEFAULT '[]'
  );
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    user_name TEXT NOT NULL DEFAULT 'Ravi',
    company_name TEXT NOT NULL DEFAULT 'WorkTrack Co.',
    currency TEXT NOT NULL DEFAULT '₹',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    onboarded INTEGER NOT NULL DEFAULT 0
  );
`);

// Options for admin-bypass scoping
export interface ScopeOpts {
  asAdmin?: boolean;
}

function scope<T extends { userId: any }>(
  table: { userId: any },
  userId: number,
  opts?: ScopeOpts,
): SQL | undefined {
  if (opts?.asAdmin) return undefined;
  return eq(table.userId, userId);
}

export class DatabaseStorage {
  // ----- users -----
  async getUserById(id: number): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
  }
  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.googleId, googleId)).get();
  }
  async createUser(data: InsertUser): Promise<User> {
    return db.insert(users).values({ ...data, email: data.email.toLowerCase() }).returning().get();
  }
  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const patch: any = { ...data };
    if (patch.email) patch.email = String(patch.email).toLowerCase();
    return db.update(users).set(patch).where(eq(users.id, id)).returning().get();
  }
  async listUsers(): Promise<User[]> {
    return db.select().from(users).all();
  }

  // ----- projects -----
  async listProjects(userId: number, opts?: ScopeOpts) {
    const w = scope(projects, userId, opts);
    return w ? db.select().from(projects).where(w).all() : db.select().from(projects).all();
  }
  async getProject(id: number, userId: number, opts?: ScopeOpts) {
    const w = scope(projects, userId, opts);
    return db.select().from(projects).where(w ? and(eq(projects.id, id), w)! : eq(projects.id, id)).get();
  }
  async createProject(data: InsertProject) {
    return db.insert(projects).values(data).returning().get();
  }
  async updateProject(id: number, userId: number, data: Partial<InsertProject>, opts?: ScopeOpts) {
    const w = scope(projects, userId, opts);
    return db.update(projects).set(data).where(w ? and(eq(projects.id, id), w)! : eq(projects.id, id)).returning().get();
  }
  async deleteProject(id: number, userId: number, opts?: ScopeOpts) {
    const w = scope(projects, userId, opts);
    return db.delete(projects).where(w ? and(eq(projects.id, id), w)! : eq(projects.id, id)).run().changes > 0;
  }

  // ----- workers -----
  async listWorkers(userId: number, opts?: ScopeOpts) {
    const w = scope(workers, userId, opts);
    return w ? db.select().from(workers).where(w).all() : db.select().from(workers).all();
  }
  async getWorker(id: number, userId: number, opts?: ScopeOpts) {
    const w = scope(workers, userId, opts);
    return db.select().from(workers).where(w ? and(eq(workers.id, id), w)! : eq(workers.id, id)).get();
  }
  async createWorker(data: InsertWorker) {
    return db.insert(workers).values(data).returning().get();
  }
  async updateWorker(id: number, userId: number, data: Partial<InsertWorker>, opts?: ScopeOpts) {
    const w = scope(workers, userId, opts);
    return db.update(workers).set(data).where(w ? and(eq(workers.id, id), w)! : eq(workers.id, id)).returning().get();
  }
  async deleteWorker(id: number, userId: number, opts?: ScopeOpts) {
    const w = scope(workers, userId, opts);
    return db.delete(workers).where(w ? and(eq(workers.id, id), w)! : eq(workers.id, id)).run().changes > 0;
  }

  // ----- tasks -----
  async listTasks(userId: number, opts?: ScopeOpts) {
    const w = scope(tasks, userId, opts);
    return w ? db.select().from(tasks).where(w).all() : db.select().from(tasks).all();
  }
  async getTask(id: number, userId: number, opts?: ScopeOpts) {
    const w = scope(tasks, userId, opts);
    return db.select().from(tasks).where(w ? and(eq(tasks.id, id), w)! : eq(tasks.id, id)).get();
  }
  async createTask(data: InsertTask) {
    return db.insert(tasks).values(data).returning().get();
  }
  async updateTask(id: number, userId: number, data: Partial<InsertTask>, opts?: ScopeOpts) {
    const w = scope(tasks, userId, opts);
    return db.update(tasks).set(data).where(w ? and(eq(tasks.id, id), w)! : eq(tasks.id, id)).returning().get();
  }
  async deleteTask(id: number, userId: number, opts?: ScopeOpts) {
    const w = scope(tasks, userId, opts);
    return db.delete(tasks).where(w ? and(eq(tasks.id, id), w)! : eq(tasks.id, id)).run().changes > 0;
  }

  // ----- attendance -----
  async listAttendance(userId: number, opts?: ScopeOpts) {
    const w = scope(attendance, userId, opts);
    return w ? db.select().from(attendance).where(w).all() : db.select().from(attendance).all();
  }
  async getAttendance(id: number, userId: number, opts?: ScopeOpts) {
    const w = scope(attendance, userId, opts);
    return db.select().from(attendance).where(w ? and(eq(attendance.id, id), w)! : eq(attendance.id, id)).get();
  }
  async createAttendance(data: InsertAttendance) {
    return db.insert(attendance).values(data).returning().get();
  }
  async updateAttendance(id: number, userId: number, data: Partial<InsertAttendance>, opts?: ScopeOpts) {
    const w = scope(attendance, userId, opts);
    return db.update(attendance).set(data).where(w ? and(eq(attendance.id, id), w)! : eq(attendance.id, id)).returning().get();
  }
  async deleteAttendance(id: number, userId: number, opts?: ScopeOpts) {
    const w = scope(attendance, userId, opts);
    return db.delete(attendance).where(w ? and(eq(attendance.id, id), w)! : eq(attendance.id, id)).run().changes > 0;
  }

  // ----- expenses -----
  async listExpenses(userId: number, opts?: ScopeOpts) {
    const w = scope(expenses, userId, opts);
    return w ? db.select().from(expenses).where(w).all() : db.select().from(expenses).all();
  }
  async getExpense(id: number, userId: number, opts?: ScopeOpts) {
    const w = scope(expenses, userId, opts);
    return db.select().from(expenses).where(w ? and(eq(expenses.id, id), w)! : eq(expenses.id, id)).get();
  }
  async createExpense(data: InsertExpense) {
    return db.insert(expenses).values(data).returning().get();
  }
  async updateExpense(id: number, userId: number, data: Partial<InsertExpense>, opts?: ScopeOpts) {
    const w = scope(expenses, userId, opts);
    return db.update(expenses).set(data).where(w ? and(eq(expenses.id, id), w)! : eq(expenses.id, id)).returning().get();
  }
  async deleteExpense(id: number, userId: number, opts?: ScopeOpts) {
    const w = scope(expenses, userId, opts);
    return db.delete(expenses).where(w ? and(eq(expenses.id, id), w)! : eq(expenses.id, id)).run().changes > 0;
  }

  // ----- invoices -----
  async listInvoices(userId: number, opts?: ScopeOpts) {
    const w = scope(invoices, userId, opts);
    return w ? db.select().from(invoices).where(w).all() : db.select().from(invoices).all();
  }
  async getInvoice(id: number, userId: number, opts?: ScopeOpts) {
    const w = scope(invoices, userId, opts);
    return db.select().from(invoices).where(w ? and(eq(invoices.id, id), w)! : eq(invoices.id, id)).get();
  }
  async createInvoice(data: InsertInvoice) {
    return db.insert(invoices).values(data).returning().get();
  }
  async updateInvoice(id: number, userId: number, data: Partial<InsertInvoice>, opts?: ScopeOpts) {
    const w = scope(invoices, userId, opts);
    return db.update(invoices).set(data).where(w ? and(eq(invoices.id, id), w)! : eq(invoices.id, id)).returning().get();
  }
  async deleteInvoice(id: number, userId: number, opts?: ScopeOpts) {
    const w = scope(invoices, userId, opts);
    return db.delete(invoices).where(w ? and(eq(invoices.id, id), w)! : eq(invoices.id, id)).run().changes > 0;
  }

  // ----- settings (per-user singleton) -----
  async getSettings(userId: number, ownerName?: string): Promise<Settings> {
    const existing = db.select().from(settings).where(eq(settings.userId, userId)).get();
    if (existing) return existing;
    return db.insert(settings).values({
      userId,
      userName: ownerName || "User",
      companyName: "WorkTrack Co.",
      currency: "₹",
      timezone: "UTC",
      onboarded: 0,
    }).returning().get();
  }
  async updateSettings(userId: number, data: Partial<InsertSettings>): Promise<Settings> {
    await this.getSettings(userId);
    return db.update(settings).set(data).where(eq(settings.userId, userId)).returning().get();
  }
}

export const storage = new DatabaseStorage();

// ---------------- seed ----------------
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function seedIfEmpty() {
  // Only seed if the users table is empty (first run).
  const existingUsers = await storage.listUsers();
  if (existingUsers.length > 0) return;

  // Create super admin first.
  const adminPasswordHash = bcrypt.hashSync("admin123", 10);
  const admin = await storage.createUser({
    email: "admin@worktrack.local",
    passwordHash: adminPasswordHash,
    name: "Ravi",
    role: "super_admin",
    googleId: null,
    avatar: null,
    createdAt: new Date().toISOString(),
    isActive: 1,
  });
  const adminId = admin.id;

  // Create admin's settings row.
  await storage.getSettings(adminId, "Ravi");
  await storage.updateSettings(adminId, { onboarded: 1 });

  // ----- projects -----
  const seedProjects: InsertProject[] = [
    { userId: adminId, name: "Skyline Towers", location: "Site A", budget: 5000000, startDate: isoDateOffset(-90), endDate: isoDateOffset(90), progress: 65, status: "active" },
    { userId: adminId, name: "Riverside Mall", location: "Site B", budget: 3500000, startDate: isoDateOffset(-60), endDate: isoDateOffset(150), progress: 40, status: "active" },
    { userId: adminId, name: "Greenfield Villas", location: "Site C", budget: 2200000, startDate: isoDateOffset(-30), endDate: isoDateOffset(180), progress: 25, status: "active" },
    { userId: adminId, name: "Heritage Restoration", location: "Downtown", budget: 1800000, startDate: isoDateOffset(-120), endDate: isoDateOffset(30), progress: 80, status: "active" },
  ];
  for (const p of seedProjects) await storage.createProject(p);

  // ----- workers -----
  const palette = ["#8b5cf6", "#10b981", "#f97316", "#f59e0b", "#3b82f6", "#ec4899", "#14b8a6", "#ef4444", "#a855f7", "#0ea5e9"];
  const seedWorkers: { name: string; role: string; wage: number; site: string }[] = [
    { name: "Rajan Singh", role: "Mason", wage: 800, site: "Site A" },
    { name: "Priya Menon", role: "Electrician", wage: 950, site: "Site B" },
    { name: "Arun Kumar", role: "Supervisor", wage: 1500, site: "Site A" },
    { name: "Deepa Nair", role: "Plumber", wage: 900, site: "Site C" },
    { name: "Vikram Patel", role: "Carpenter", wage: 850, site: "Site A" },
    { name: "Anjali Iyer", role: "Painter", wage: 750, site: "Site B" },
    { name: "Suresh Reddy", role: "Welder", wage: 1100, site: "Site C" },
    { name: "Kavita Sharma", role: "Helper", wage: 600, site: "Site A" },
    { name: "Manoj Yadav", role: "Mason", wage: 800, site: "Site B" },
    { name: "Lakshmi Rao", role: "Electrician", wage: 950, site: "Downtown" },
    { name: "Ravi Verma", role: "Helper", wage: 600, site: "Site C" },
    { name: "Sunita Joshi", role: "Painter", wage: 750, site: "Site A" },
    { name: "Karthik Nair", role: "Carpenter", wage: 850, site: "Downtown" },
    { name: "Meera Pillai", role: "Supervisor", wage: 1500, site: "Site B" },
    { name: "Rohit Desai", role: "Welder", wage: 1100, site: "Site A" },
    { name: "Geeta Shetty", role: "Plumber", wage: 900, site: "Site B" },
    { name: "Ajay Mehta", role: "Helper", wage: 600, site: "Site C" },
    { name: "Pooja Bhatt", role: "Mason", wage: 800, site: "Downtown" },
    { name: "Sandeep Roy", role: "Carpenter", wage: 850, site: "Site B" },
    { name: "Neha Kapoor", role: "Electrician", wage: 950, site: "Site C" },
    { name: "Harish Gupta", role: "Painter", wage: 750, site: "Site A" },
  ];
  for (let i = 0; i < seedWorkers.length; i++) {
    const w = seedWorkers[i];
    await storage.createWorker({
      userId: adminId,
      name: w.name,
      role: w.role,
      dailyWage: w.wage,
      site: w.site,
      avatar: initials(w.name),
      color: palette[i % palette.length],
    });
  }

  // ----- tasks -----
  const allProjects = await storage.listProjects(adminId);
  const allWorkers = await storage.listWorkers(adminId);
  const byName = (n: string) => allProjects.find(p => p.name === n);
  const skyline = byName("Skyline Towers")!;
  const riverside = byName("Riverside Mall")!;
  const greenfield = byName("Greenfield Villas")!;
  const heritage = byName("Heritage Restoration")!;
  const today = isoDateOffset(0);

  const todayTasks: InsertTask[] = [
    { userId: adminId, title: "Pour foundation — Block C", projectId: skyline.id, assigneeId: allWorkers[0].id, date: today, status: "done", notes: "Block C complete" },
    { userId: adminId, title: "Install formwork — Level 2", projectId: skyline.id, assigneeId: allWorkers[2].id, date: today, status: "in-progress", notes: null },
    { userId: adminId, title: "Electrical conduit routing", projectId: riverside.id, assigneeId: allWorkers[1].id, date: today, status: "in-progress", notes: null },
    { userId: adminId, title: "Plumbing inspection — Unit 4", projectId: greenfield.id, assigneeId: allWorkers[3].id, date: today, status: "pending", notes: null },
    { userId: adminId, title: "Material delivery check", projectId: skyline.id, assigneeId: allWorkers[7].id, date: today, status: "delayed", notes: "Cement delayed" },
  ];
  for (const t of todayTasks) await storage.createTask(t);

  const extraTitles = [
    "Concrete curing inspection", "Steel reinforcement", "Tile laying — Floor 3",
    "Painting prep — Lobby", "Wiring — Block A", "Site cleanup",
    "Drainage installation", "Window framing", "Roof waterproofing",
    "Door fitting — Unit 2", "Excavation — Block D", "Scaffolding setup",
    "Plaster work — Level 1", "Bathroom fixtures", "Quality audit",
  ];
  const statuses: Array<InsertTask["status"]> = ["pending", "in-progress", "done", "delayed"];
  const projs = [skyline, riverside, greenfield, heritage];
  for (let i = 0; i < extraTitles.length; i++) {
    const offset = -7 + i;
    const p = projs[i % projs.length];
    const w = allWorkers[(i * 3) % allWorkers.length];
    await storage.createTask({
      userId: adminId,
      title: extraTitles[i],
      projectId: p.id,
      assigneeId: w.id,
      date: isoDateOffset(offset),
      status: statuses[i % statuses.length],
      notes: null,
    });
  }

  // ----- attendance -----
  const todayStr = isoDateOffset(0);
  for (let i = 0; i < allWorkers.length; i++) {
    const status = i < 18 ? "present" : "absent";
    await storage.createAttendance({ userId: adminId, workerId: allWorkers[i].id, date: todayStr, status });
  }
  for (let dayOffset = -14; dayOffset < 0; dayOffset++) {
    const date = isoDateOffset(dayOffset);
    for (let i = 0; i < allWorkers.length; i++) {
      const rand = Math.random();
      let status: "present" | "absent" | "leave" = "present";
      if (rand < 0.1) status = "absent";
      else if (rand < 0.15) status = "leave";
      await storage.createAttendance({ userId: adminId, workerId: allWorkers[i].id, date, status });
    }
  }

  // ----- expenses -----
  const seedExpenses: InsertExpense[] = [
    { userId: adminId, title: "Crane rental", category: "Equipment", projectId: skyline.id, amount: 22000, date: isoDateOffset(-1), status: "approved", notes: null },
    { userId: adminId, title: "Cement bags (200)", category: "Materials", projectId: riverside.id, amount: 14400, date: isoDateOffset(-2), status: "paid", notes: null },
    { userId: adminId, title: "Fuel — site vehicles", category: "Transport", projectId: null, amount: 8200, date: isoDateOffset(0), status: "pending", notes: null },
    { userId: adminId, title: "Steel rods", category: "Materials", projectId: skyline.id, amount: 18500, date: isoDateOffset(-3), status: "approved", notes: null },
    { userId: adminId, title: "Daily wages — masons", category: "Labour", projectId: greenfield.id, amount: 9600, date: isoDateOffset(-4), status: "paid", notes: null },
    { userId: adminId, title: "Bricks (5000)", category: "Materials", projectId: riverside.id, amount: 12000, date: isoDateOffset(-5), status: "approved", notes: null },
    { userId: adminId, title: "Generator hire", category: "Equipment", projectId: skyline.id, amount: 6800, date: isoDateOffset(-6), status: "pending", notes: null },
    { userId: adminId, title: "Tools & supplies", category: "Other", projectId: null, amount: 3200, date: isoDateOffset(-2), status: "paid", notes: null },
    { userId: adminId, title: "Truck rental", category: "Transport", projectId: greenfield.id, amount: 7500, date: isoDateOffset(-7), status: "approved", notes: null },
    { userId: adminId, title: "Paint supplies", category: "Materials", projectId: riverside.id, amount: 4400, date: isoDateOffset(-8), status: "paid", notes: null },
    { userId: adminId, title: "Site security", category: "Other", projectId: skyline.id, amount: 5500, date: isoDateOffset(-10), status: "approved", notes: null },
    { userId: adminId, title: "Helmets & PPE", category: "Equipment", projectId: null, amount: 3800, date: isoDateOffset(-12), status: "paid", notes: null },
    { userId: adminId, title: "Daily wages — helpers", category: "Labour", projectId: skyline.id, amount: 7200, date: isoDateOffset(-11), status: "approved", notes: null },
  ];
  for (const e of seedExpenses) await storage.createExpense(e);

  // ----- invoices -----
  const inv: InsertInvoice[] = [
    {
      userId: adminId,
      clientName: "Bharat Realty Pvt Ltd",
      projectId: skyline.id,
      amount: 250000,
      date: isoDateOffset(-7),
      dueDate: isoDateOffset(14),
      status: "sent",
      lineItems: JSON.stringify([
        { description: "Foundation work — Block C", qty: 1, rate: 150000 },
        { description: "Materials supplied", qty: 1, rate: 100000 },
      ]),
    },
    {
      userId: adminId,
      clientName: "Riverside Developers",
      projectId: riverside.id,
      amount: 120000,
      date: isoDateOffset(-30),
      dueDate: isoDateOffset(-3),
      status: "overdue",
      lineItems: JSON.stringify([
        { description: "Electrical installation — Phase 1", qty: 1, rate: 120000 },
      ]),
    },
    {
      userId: adminId,
      clientName: "Heritage Trust",
      projectId: heritage.id,
      amount: 85000,
      date: isoDateOffset(-20),
      dueDate: isoDateOffset(-5),
      status: "paid",
      lineItems: JSON.stringify([
        { description: "Restoration — Wing A", qty: 1, rate: 85000 },
      ]),
    },
    {
      userId: adminId,
      clientName: "Greenfield Villas Association",
      projectId: null,
      amount: 65000,
      date: isoDateOffset(-3),
      dueDate: isoDateOffset(20),
      status: "draft",
      lineItems: JSON.stringify([
        { description: "Plumbing — Units 1-4", qty: 4, rate: 16250 },
      ]),
    },
  ];
  for (const i of inv) await storage.createInvoice(i);

  console.log(`[seed] super admin created (id=${adminId}) with sample data`);
}

// Helper: auto-seed sample data for a brand-new user (signup).
export async function seedNewUserData(userId: number, displayName: string) {
  await storage.getSettings(userId, displayName);
  const today = isoDateOffset(0);
  const project = await storage.createProject({
    userId,
    name: "My First Project",
    location: "Home Office",
    budget: 100000,
    startDate: today,
    endDate: isoDateOffset(90),
    progress: 0,
    status: "active",
  });
  await storage.createTask({
    userId,
    title: "Set up project",
    projectId: project.id,
    assigneeId: null,
    date: today,
    status: "pending",
    notes: null,
  });
}

// fire-and-forget seed at startup
seedIfEmpty().catch((e) => console.error("seed error:", e));
