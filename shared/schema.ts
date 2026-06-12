import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ----------------------------- users -----------------------------
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  name: text("name").notNull(),
  role: text("role").notNull().default("user"),
  googleId: text("google_id").unique(),
  avatar: text("avatar"),
  createdAt: text("created_at").notNull(),
  isActive: integer("is_active").notNull().default(1),
});
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ----------------------------- projects -----------------------------
export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  budget: integer("budget").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  progress: integer("progress").notNull().default(0),
  status: text("status").notNull().default("active"),
});
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// ----------------------------- workers -----------------------------
export const workers = sqliteTable("workers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  dailyWage: integer("daily_wage").notNull(),
  site: text("site").notNull(),
  avatar: text("avatar").notNull(),
  color: text("color").notNull(),
});
export const insertWorkerSchema = createInsertSchema(workers).omit({ id: true });
export type InsertWorker = z.infer<typeof insertWorkerSchema>;
export type Worker = typeof workers.$inferSelect;

// ----------------------------- tasks -----------------------------
export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  projectId: integer("project_id"),
  assigneeId: integer("assignee_id"),
  date: text("date").notNull(),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
});
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// ----------------------------- attendance -----------------------------
export const attendance = sqliteTable("attendance", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  workerId: integer("worker_id").notNull(),
  date: text("date").notNull(),
  status: text("status").notNull().default("present"),
});
export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendance.$inferSelect;

// ----------------------------- expenses -----------------------------
export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  projectId: integer("project_id"),
  amount: integer("amount").notNull(),
  date: text("date").notNull(),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
});
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

// ----------------------------- invoices -----------------------------
export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  clientName: text("client_name").notNull(),
  projectId: integer("project_id"),
  amount: integer("amount").notNull(),
  date: text("date").notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status").notNull().default("draft"),
  lineItems: text("line_items").notNull().default("[]"),
});
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

// ----------------------------- settings -----------------------------
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().unique(),
  userName: text("user_name").notNull().default("Ravi"),
  companyName: text("company_name").notNull().default("WorkTrack Co."),
  currency: text("currency").notNull().default("₹"),
  timezone: text("timezone").notNull().default("UTC"),
  onboarded: integer("onboarded").notNull().default(0),
});
export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

