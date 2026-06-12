import { test } from "node:test";
import assert from "node:assert";
import { storage } from "../storage";

test("DatabaseStorage CRUD operations", async (t) => {
  let userId = 999;
  let projectId = 0;
  let workerId = 0;
  let taskId = 0;
  let expenseId = 0;
  let invoiceId = 0;
  let attendanceId = 0;

  await t.test("1. User operations", async () => {
    const userEmail = `user_${Date.now()}@example.com`;
    const user = await storage.createUser({
      email: userEmail,
      name: "Test User",
      passwordHash: "hash123",
      role: "user",
      googleId: null,
      avatar: null,
      createdAt: new Date().toISOString(),
      isActive: 1,
    });

    assert.ok(user.id, "User ID should be generated");
    assert.strictEqual(user.email, userEmail.toLowerCase(), "Email should be lowercased");
    assert.strictEqual(user.name, "Test User");

    userId = user.id;

    const fetched = await storage.getUserById(userId);
    assert.ok(fetched, "Should fetch user by id");
    assert.strictEqual(fetched?.email, userEmail.toLowerCase());

    const fetchedByEmail = await storage.getUserByEmail(userEmail);
    assert.ok(fetchedByEmail, "Should fetch user by email");
    assert.strictEqual(fetchedByEmail?.id, userId);

    const updated = await storage.updateUser(userId, { name: "Updated Name" });
    assert.strictEqual(updated?.name, "Updated Name");
  });

  await t.test("2. Project operations", async () => {
    const proj = await storage.createProject({
      userId,
      name: "Skyline Project",
      location: "East Wing",
      budget: 150000,
      startDate: "2026-06-01",
      endDate: "2026-12-31",
      progress: 10,
      status: "active",
    });

    assert.ok(proj.id);
    assert.strictEqual(proj.name, "Skyline Project");
    assert.strictEqual(proj.budget, 150000);
    projectId = proj.id;

    const list = await storage.listProjects(userId);
    assert.ok(list.length > 0, "List should contain the project");

    const fetched = await storage.getProject(projectId, userId);
    assert.ok(fetched);
    assert.strictEqual(fetched?.name, "Skyline Project");

    const updated = await storage.updateProject(projectId, userId, { progress: 20 });
    assert.strictEqual(updated?.progress, 20);
  });

  await t.test("3. Worker operations", async () => {
    const worker = await storage.createWorker({
      userId,
      name: "John Doe",
      role: "Plumber",
      dailyWage: 800,
      site: "East Wing",
      avatar: "JD",
      color: "#ff0000",
    });

    assert.ok(worker.id);
    assert.strictEqual(worker.name, "John Doe");
    assert.strictEqual(worker.dailyWage, 800);
    workerId = worker.id;

    const list = await storage.listWorkers(userId);
    assert.ok(list.length > 0);

    const fetched = await storage.getWorker(workerId, userId);
    assert.ok(fetched);

    const updated = await storage.updateWorker(workerId, userId, { dailyWage: 850 });
    assert.strictEqual(updated?.dailyWage, 850);
  });

  await t.test("4. Task operations", async () => {
    const task = await storage.createTask({
      userId,
      title: "Fix leak",
      projectId,
      assigneeId: workerId,
      date: "2026-06-11",
      status: "pending",
      notes: "Urgent leak repair",
    });

    assert.ok(task.id);
    assert.strictEqual(task.title, "Fix leak");
    assert.strictEqual(task.projectId, projectId);
    assert.strictEqual(task.assigneeId, workerId);
    taskId = task.id;

    const list = await storage.listTasks(userId);
    assert.ok(list.length > 0);

    const fetched = await storage.getTask(taskId, userId);
    assert.ok(fetched);

    const updated = await storage.updateTask(taskId, userId, { status: "done" });
    assert.strictEqual(updated?.status, "done");
  });

  await t.test("5. Attendance operations", async () => {
    const att = await storage.createAttendance({
      userId,
      workerId,
      date: "2026-06-11",
      status: "present",
    });

    assert.ok(att.id);
    assert.strictEqual(att.status, "present");
    attendanceId = att.id;

    const list = await storage.listAttendance(userId);
    assert.ok(list.length > 0);

    const fetched = await storage.getAttendance(attendanceId, userId);
    assert.ok(fetched);

    const updated = await storage.updateAttendance(attendanceId, userId, { status: "leave" });
    assert.strictEqual(updated?.status, "leave");
  });

  await t.test("6. Expense operations", async () => {
    const exp = await storage.createExpense({
      userId,
      title: "Buy pipes",
      category: "Materials",
      projectId,
      amount: 4500,
      date: "2026-06-11",
      status: "pending",
      notes: "Copper pipes",
    });

    assert.ok(exp.id);
    assert.strictEqual(exp.title, "Buy pipes");
    assert.strictEqual(exp.amount, 4500);
    expenseId = exp.id;

    const list = await storage.listExpenses(userId);
    assert.ok(list.length > 0);

    const fetched = await storage.getExpense(expenseId, userId);
    assert.ok(fetched);

    const updated = await storage.updateExpense(expenseId, userId, { status: "approved" });
    assert.strictEqual(updated?.status, "approved");
  });

  await t.test("7. Invoice operations", async () => {
    const items = JSON.stringify([{ description: "Plumbing fix", qty: 1, rate: 4500 }]);
    const inv = await storage.createInvoice({
      userId,
      clientName: "Acme Corp",
      projectId,
      amount: 4500,
      date: "2026-06-11",
      dueDate: "2026-06-25",
      status: "draft",
      lineItems: items,
    });

    assert.ok(inv.id);
    assert.strictEqual(inv.clientName, "Acme Corp");
    assert.strictEqual(inv.amount, 4500);
    invoiceId = inv.id;

    const list = await storage.listInvoices(userId);
    assert.ok(list.length > 0);

    const fetched = await storage.getInvoice(invoiceId, userId);
    assert.ok(fetched);

    const updated = await storage.updateInvoice(invoiceId, userId, { status: "paid" });
    assert.strictEqual(updated?.status, "paid");
  });

  await t.test("8. Settings operations", async () => {
    const sets = await storage.getSettings(userId, "Test Name");
    assert.strictEqual(sets.userId, userId);
    assert.strictEqual(sets.userName, "Test Name");
    assert.strictEqual(sets.companyName, "WorkTrack Co.");

    const updated = await storage.updateSettings(userId, { companyName: "Acme Contractors" });
    assert.strictEqual(updated.companyName, "Acme Contractors");
  });

  await t.test("9. Cleanup delete operations", async () => {
    const deletedTask = await storage.deleteTask(taskId, userId);
    assert.strictEqual(deletedTask, true);

    const deletedWorker = await storage.deleteWorker(workerId, userId);
    assert.strictEqual(deletedWorker, true);

    const deletedProj = await storage.deleteProject(projectId, userId);
    assert.strictEqual(deletedProj, true);

    const deletedExp = await storage.deleteExpense(expenseId, userId);
    assert.strictEqual(deletedExp, true);

    const deletedInv = await storage.deleteInvoice(invoiceId, userId);
    assert.strictEqual(deletedInv, true);

    const deletedAtt = await storage.deleteAttendance(attendanceId, userId);
    assert.strictEqual(deletedAtt, true);

    const fetchProj = await storage.getProject(projectId, userId);
    assert.strictEqual(fetchProj, undefined);
  });
});
