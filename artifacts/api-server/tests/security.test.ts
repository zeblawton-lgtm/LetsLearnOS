import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import test, { after, before } from "node:test";
import type { Request } from "express";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.ADMIN_AUTH_SECRET = "test-admin-auth-secret";
process.env.PIN_MAX_FAILED_ATTEMPTS = "2";
process.env.PIN_RATE_LIMIT_WINDOW_MS = "60000";
process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:1/letslearnos_test";

const auth = await import("../src/lib/admin-auth");
const { default: app } = await import("../src/app");

let baseUrl = "";
let server: ReturnType<typeof app.listen>;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.notEqual(address, null);
  assert.notEqual(typeof address, "string");
  baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}/api`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
});

test("unauthenticated admin writes fail", async () => {
  const writes = [
    request("PUT", "/admin/settings", { key: "sound", value: "off" }),
    request("POST", "/admin/change-pin", { currentPin: "1234", newPin: "4321" }),
    request("POST", "/admin/seed"),
  ];

  for (const response of await Promise.all(writes)) {
    assert.equal(response.status, 401);
  }
});

test("unauthenticated admin settings reads fail", async () => {
  const response = await request("GET", "/admin/settings");
  assert.equal(response.status, 401);
});

test("unauthenticated profile writes fail", async () => {
  const response = await request("POST", "/profiles", {
    name: "Test",
    age: 5,
    avatarPokemonId: 25,
  });

  assert.equal(response.status, 401);
});

test("removed timer and profile-edit endpoints return 404", async () => {
  const requests = [
    request("GET", "/timer/1"),
    request("POST", "/timer/1/adjust", { minutes: 5 }),
    request("POST", "/timer/1/reset"),
    request("PATCH", "/profiles/1", { dailyLimitMinutes: 20 }),
  ];

  for (const response of await Promise.all(requests)) {
    assert.equal(response.status, 404);
  }
});

test("issued admin bearer tokens are signed and verifiable", async () => {
  const issued = auth.issueAdminToken();
  assert.equal(typeof issued.token, "string");
  assert.equal(typeof issued.expiresAt, "string");
  assert.equal(auth.verifyAdminToken(issued.token), true);
});

test("invalid bearer tokens do not authorize admin writes", async () => {
  const response = await request(
    "PUT",
    "/admin/settings",
    { key: "sound", value: "off" },
    { Authorization: "Bearer not-a-real-token" },
  );
  assert.equal(response.status, 401);
});

test("PIN rate limiter blocks repeated failures", () => {
  const mockReq = {
    ip: "rate-limit-test",
    socket: { remoteAddress: "rate-limit-test" },
  } as Request;
  assert.deepEqual(auth.pinRateLimitStatus(mockReq), { limited: false });

  auth.recordFailedPinAttempt(mockReq);
  auth.recordFailedPinAttempt(mockReq);

  const status = auth.pinRateLimitStatus(mockReq);
  assert.equal(status.limited, true);
  if (status.limited) assert.equal(status.retryAfterSeconds > 0, true);
  auth.resetPinAttempts(mockReq);
});

test("CORS does not reflect arbitrary origins", async () => {
  const response = await request("GET", "/healthz", undefined, {
    Origin: "https://evil.example",
  });
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

async function request(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  const requestHeaders = new Headers(headers);
  if (body !== undefined) requestHeaders.set("Content-Type", "application/json");
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
