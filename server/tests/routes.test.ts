import { test } from "node:test";
import assert from "node:assert";
import { startTestServer } from "./helper";

test("API Routing Integration for All Modules", async (t) => {
  let serverInstance: any;
  let baseUrl = "";
  let sessionCookie = "";
  let adminCookie = "";
  let userId = 0;
  let adminId = 0;

  // Resource IDs created during test to verify updates/deletes
  let workerId = 0;
  let taskId = 0;
  let attendanceId = 0;
  let expenseId = 0;
  let invoiceId = 0;

  t.before(async () => {
    serverInstance = await startTestServer();
    baseUrl = serverInstance.baseUrl;
  });

  t.after(async () => {
    if (serverInstance) {
      await serverInstance.close();
    }
    process.exit(0);
  });

  await t.test("0. Register a user and log in as Admin", async () => {
    // Signup normal user
    const userEmail = `route_user_${Date.now()}@example.com`;
    const userRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: userEmail,
        password: "userpass123",
        name: "Route User",
      }),
    });
    assert.strictEqual(userRes.status, 200);
    const userObj = await userRes.json();
    userId = userObj.id;
    sessionCookie = userRes.headers.get("set-cookie") || "";

    // Login admin
    const adminRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@worktrack.local",
        password: "admin123",
      }),
    });
    assert.strictEqual(adminRes.status, 200);
    const adminObj = await adminRes.json();
    adminId = adminObj.id;
    adminCookie = adminRes.headers.get("set-cookie") || "";
  });

  await t.test("1. Workers Route CRUD", async () => {
    // Create worker
    const resCreate = await fetch(`${baseUrl}/api/workers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        name: "Alice Smith",
        role: "Painter",
        dailyWage: 900,
        site: "Site A",
        avatar: "AS",
        color: "#123456",
      }),
    });
    assert.strictEqual(resCreate.status, 200);
    const w = await resCreate.json();
    assert.strictEqual(w.name, "Alice Smith");
    workerId = w.id;

    // List workers
    const resList = await fetch(`${baseUrl}/api/workers`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(resList.status, 200);
    const list = await resList.json();
    assert.ok(list.length > 0);

    // Update worker
    const resUpdate = await fetch(`${baseUrl}/api/workers/${workerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({ role: "Lead Painter" }),
    });
    assert.strictEqual(resUpdate.status, 200);
    const updated = await resUpdate.json();
    assert.strictEqual(updated.role, "Lead Painter");
  });

  await t.test("2. Tasks Route CRUD", async () => {
    // Create task
    const resCreate = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        title: "Prime walls",
        projectId: null,
        assigneeId: workerId,
        date: "2026-06-11",
        status: "pending",
        notes: "Apply primer",
      }),
    });
    assert.strictEqual(resCreate.status, 200);
    const task = await resCreate.json();
    assert.strictEqual(task.title, "Prime walls");
    taskId = task.id;

    // Get task
    const resGet = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(resGet.status, 200);
    const fetched = await resGet.json();
    assert.strictEqual(fetched.title, "Prime walls");

    // Update task
    const resUpdate = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({ status: "in-progress" }),
    });
    assert.strictEqual(resUpdate.status, 200);
  });

  await t.test("3. Attendance Route CRUD", async () => {
    // Create attendance
    const resCreate = await fetch(`${baseUrl}/api/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        workerId,
        date: "2026-06-11",
        status: "present",
      }),
    });
    assert.strictEqual(resCreate.status, 200);
    const att = await resCreate.json();
    assert.strictEqual(att.status, "present");
    attendanceId = att.id;

    // Update attendance
    const resUpdate = await fetch(`${baseUrl}/api/attendance/${attendanceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({ status: "absent" }),
    });
    assert.strictEqual(resUpdate.status, 200);
  });

  await t.test("4. Expenses Route CRUD", async () => {
    // Create expense
    const resCreate = await fetch(`${baseUrl}/api/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        title: "Paint cans",
        category: "Materials",
        projectId: null,
        amount: 3200,
        date: "2026-06-11",
        status: "pending",
        notes: "Primer paint",
      }),
    });
    assert.strictEqual(resCreate.status, 200);
    const exp = await resCreate.json();
    expenseId = exp.id;

    // Update expense
    const resUpdate = await fetch(`${baseUrl}/api/expenses/${expenseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({ status: "paid" }),
    });
    assert.strictEqual(resUpdate.status, 200);
  });

  await t.test("5. Invoices Route CRUD", async () => {
    // Create invoice
    const resCreate = await fetch(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({
        clientName: "Bob Builders",
        projectId: null,
        amount: 8500,
        date: "2026-06-11",
        dueDate: "2026-06-25",
        status: "draft",
        lineItems: JSON.stringify([{ description: "Wall painting", qty: 1, rate: 8500 }]),
      }),
    });
    assert.strictEqual(resCreate.status, 200);
    const inv = await resCreate.json();
    invoiceId = inv.id;

    // Update invoice
    const resUpdate = await fetch(`${baseUrl}/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({ status: "sent" }),
    });
    assert.strictEqual(resUpdate.status, 200);
  });

  await t.test("6. Settings Route CRUD", async () => {
    // Fetch settings
    const resGet = await fetch(`${baseUrl}/api/settings`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(resGet.status, 200);
    const sets = await resGet.json();
    assert.strictEqual(sets.userId, userId);

    // Update settings
    const resUpdate = await fetch(`${baseUrl}/api/settings/1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify({ companyName: "Route Builders LLC" }),
    });
    assert.strictEqual(resUpdate.status, 200);
    const updated = await resUpdate.json();
    assert.strictEqual(updated.companyName, "Route Builders LLC");
  });

  await t.test("7. Admin Management Routes", async () => {
    // Fetch user dashboard metrics and listings
    const resUsers = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(resUsers.status, 200);
    const list = await resUsers.json();
    const targetUser = list.find((u: any) => u.id === userId);
    assert.ok(targetUser);
    assert.strictEqual(targetUser.name, "Route User");

    // Admin updates user details (change role to super_admin or deactivate)
    const resUpdate = await fetch(`${baseUrl}/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ name: "Route User Admin" }),
    });
    assert.strictEqual(resUpdate.status, 200);
    const updated = await resUpdate.json();
    assert.strictEqual(updated.name, "Route User Admin");

    // Admin deactivates user (soft delete)
    const resDelete = await fetch(`${baseUrl}/api/admin/users/${userId}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(resDelete.status, 200);
  });
});
