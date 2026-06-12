import { test } from "node:test";
import assert from "node:assert";
import { startTestServer } from "./helper";

test("Admin View-As Security Boundaries", async (t) => {
  let serverInstance: any;
  let baseUrl = "";
  let adminCookie = "";
  let userCookie = "";
  let userId = 0;
  let adminId = 0;

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

  await t.test("1. Log in as Seeded Super Admin", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@worktrack.local",
        password: "admin123",
      }),
    });

    assert.strictEqual(res.status, 200, "Admin login should succeed");
    const adminUser = await res.json();
    assert.strictEqual(adminUser.role, "super_admin");
    adminId = adminUser.id;

    const cookie = res.headers.get("set-cookie");
    assert.ok(cookie);
    adminCookie = cookie;
  });

  await t.test("2. Admin can fetch user list", async () => {
    const res = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(res.status, 200);
    const users = await res.json();
    assert.ok(Array.isArray(users));
  });

  await t.test("3. Register a regular user and get their ID", async () => {
    const userEmail = `user_viewas_${Date.now()}@example.com`;
    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: userEmail,
        password: "userpassword123",
        name: "Regular User",
      }),
    });

    assert.strictEqual(res.status, 200);
    const userObj = await res.json();
    userId = userObj.id;

    const cookie = res.headers.get("set-cookie");
    assert.ok(cookie);
    userCookie = cookie;
  });

  await t.test("4. Regular user cannot fetch admin endpoints", async () => {
    const res = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Cookie: userCookie },
    });
    assert.strictEqual(res.status, 403, "Regular user should be forbidden");
  });

  await t.test("5. Admin in View-As mode can list regular user's projects", async () => {
    const res = await fetch(`${baseUrl}/api/projects?userId=${userId}`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(res.status, 200);
    const projects = await res.json();
    assert.ok(Array.isArray(projects));
    // The seedNewUserData creates exactly 1 project for signed up user
    assert.strictEqual(projects.length, 1);
    assert.strictEqual(projects[0].name, "My First Project");
  });

  await t.test("6. Admin in View-As mode BLOCKED from adding projects (Write protection)", async () => {
    const res = await fetch(`${baseUrl}/api/projects?userId=${userId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: "Forbidden Project Addition",
        location: "Restricted Wing",
        budget: 900000,
        startDate: "2026-06-01",
        endDate: "2026-12-31",
      }),
    });

    assert.strictEqual(res.status, 403, "POST should be forbidden in View-As mode");
    const body = await res.json();
    assert.ok(body.message.includes("viewing as another user"));
  });

  await t.test("7. Admin in View-As mode BLOCKED from deleting projects", async () => {
    // Attempt deleting project id 1 (which belongs to user)
    const res = await fetch(`${baseUrl}/api/projects/1?userId=${userId}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });

    assert.strictEqual(res.status, 403, "DELETE should be forbidden in View-As mode");
  });

  await t.test("8. Admin can still write to their own workspace (no userId parameter)", async () => {
    const res = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: "Admin Tower",
        location: "HQ",
        budget: 1000000,
        startDate: "2026-06-01",
        endDate: "2026-12-31",
      }),
    });

    assert.strictEqual(res.status, 200, "Admin should write to their own workspace successfully");
    const proj = await res.json();
    assert.strictEqual(proj.name, "Admin Tower");
  });
});
