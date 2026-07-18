import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const PIN_SALT = "letslearnos";
const TOKEN_SECRET =
  process.env.ADMIN_AUTH_SECRET ?? randomBytes(32).toString("base64url");
const TOKEN_TTL_MS = readPositiveIntEnv("ADMIN_TOKEN_TTL_MS", 30 * 60 * 1000);
const PIN_WINDOW_MS = readPositiveIntEnv("PIN_RATE_LIMIT_WINDOW_MS", 5 * 60 * 1000);
const PIN_MAX_FAILED_ATTEMPTS = readPositiveIntEnv("PIN_MAX_FAILED_ATTEMPTS", 5);

type AdminTokenPayload = {
  exp: number;
  iat: number;
  nonce: string;
  scope: "admin";
};

type PinBucket = {
  failedAt: number[];
};

const pinFailures = new Map<string, PinBucket>();

// Precomputed SHA-256 of the documented bootstrap PIN plus PIN_SALT. Keep only
// the salted digest in runtime code/storage; the parent guide owns the one-time
// plaintext bootstrap instruction.
export const DEFAULT_PIN_HASH =
  "12a6854113dce6a82e013f446b1a2249802623be1db267a7f32788f0f94e22c2";

export function hashPin(pin: string): string {
  return createHash("sha256").update(pin + PIN_SALT).digest("hex");
}

export function issueAdminToken(now = Date.now()): {
  token: string;
  expiresAt: string;
} {
  const payload: AdminTokenPayload = {
    scope: "admin",
    iat: now,
    exp: now + TOKEN_TTL_MS,
    nonce: randomBytes(16).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signTokenBody(body);
  return {
    token: `${body}.${signature}`,
    expiresAt: new Date(payload.exp).toISOString(),
  };
}

export function verifyAdminToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return false;
  if (!safeEqual(signature, signTokenBody(body))) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Partial<AdminTokenPayload>;
    return payload.scope === "admin" && typeof payload.exp === "number" && payload.exp > now;
  } catch {
    return false;
  }
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  if (!verifyAdminToken(readBearerToken(req))) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  next();
}

export function pinRateLimitStatus(
  req: Request,
  now = Date.now(),
): { limited: false } | { limited: true; retryAfterSeconds: number } {
  const bucket = getPinBucket(req);
  bucket.failedAt = recentFailures(bucket, now);
  if (bucket.failedAt.length < PIN_MAX_FAILED_ATTEMPTS) return { limited: false };

  const oldest = bucket.failedAt[0] ?? now;
  return {
    limited: true,
    retryAfterSeconds: Math.max(1, Math.ceil((oldest + PIN_WINDOW_MS - now) / 1000)),
  };
}

export function recordFailedPinAttempt(req: Request, now = Date.now()): void {
  const key = clientKey(req);
  const bucket = getPinBucket(req);
  bucket.failedAt = [...recentFailures(bucket, now), now];
  pinFailures.set(key, bucket);
}

export function resetPinAttempts(req: Request): void {
  pinFailures.delete(clientKey(req));
}

function readBearerToken(req: Request): string | undefined {
  const header = req.get("authorization");
  if (!header) return undefined;
  const [scheme, token, extra] = header.split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token || extra !== undefined) return undefined;
  return token;
}

function signTokenBody(body: string): string {
  return createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function getPinBucket(req: Request): PinBucket {
  const key = clientKey(req);
  const bucket = pinFailures.get(key) ?? { failedAt: [] };
  pinFailures.set(key, bucket);
  return bucket;
}

function recentFailures(bucket: PinBucket, now: number): number[] {
  return bucket.failedAt.filter((failedAt) => now - failedAt < PIN_WINDOW_MS);
}

function clientKey(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
