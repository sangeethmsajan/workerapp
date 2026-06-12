import { test } from "node:test";
import assert from "node:assert";
import { startTestServer } from "./helper";

test("Authentication Endpoints Integration", async (t) => {
  let serverInstance: any;
  let baseUrl = "";
  let sessionCookie = "";
  const testEmail = `auth_test_${Date.now()}@example.com`;
  const testPassword = "testpassword123";
  const testName = "Auth Tester";

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

  await t.test("1. Signup a new user", async () => {
    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: testName,
      }),
    });

    assert.strictEqual(res.status, 200, "Signup should return 200");
    const user = await res.json();
    assert.strictEqual(user.email, testEmail.toLowerCase());
    assert.strictEqual(user.name, testName);
    assert.strictEqual(user.role, "user");

    const cookie = res.headers.get("set-cookie");
    assert.ok(cookie, "Signup should set session cookie");
    sessionCookie = cookie;
  });

  await t.test("2. Get current user profile (/api/auth/me)", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Cookie: sessionCookie,
      },
    });

    assert.strictEqual(res.status, 200, "Profile check should return 200");
    const user = await res.json();
    assert.strictEqual(user.email, testEmail.toLowerCase());
  });

  await t.test("3. Change user password", async () => {
    const res = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        currentPassword: testPassword,
        newPassword: "newsecurepassword123",
      }),
    });

    assert.strictEqual(res.status, 200, "Password change should return 200");
    const updated = await res.json();
    assert.strictEqual(updated.email, testEmail.toLowerCase());
  });

  await t.test("4. Attempt log in with old password (should fail)", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    assert.strictEqual(res.status, 401, "Should reject old password");
  });

  await t.test("5. Log in with new password (should succeed)", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "newsecurepassword123",
      }),
    });

    assert.strictEqual(res.status, 200, "Login should return 200");
    const user = await res.json();
    assert.strictEqual(user.email, testEmail.toLowerCase());

    const cookie = res.headers.get("set-cookie");
    assert.ok(cookie);
    sessionCookie = cookie;
  });

  await t.test("6. Logout", async () => {
    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: sessionCookie,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.ok, true);
  });

  await t.test("7. Access profile after logout (should fail)", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Cookie: sessionCookie,
      },
    });

    assert.strictEqual(res.status, 401, "Me endpoint should return 401 after logout");
  });
});
