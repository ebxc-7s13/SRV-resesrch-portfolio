import { NextResponse } from "next/server";
import { getClientIp } from "./client-ip";
import { getDb } from "./db";

// Rate limiting backed by the rate_limits table (see scripts/migrate-postgres.ts)
// so limits are GLOBAL across serverless instances and survive instance
// recycling. A fixed-window counter is updated with a single atomic UPSERT;
// the window resets when window_start falls behind the current window.
//
// Cleanup of expired rows piggybacks on /api/cron/cleanup. Rows are cheap
// (one per IP+scope per window) but are purged by the cron job regardless.
interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  scope?: string;
  message?: string;
}

export interface RateLimiter {
  scope: string;
  windowMs: number;
  maxRequests: number;
  message: string;
}

interface LimitRow {
  count: number;
}

// Builds a limiter config. `check` performs the atomic windowed increment.
export function rateLimit(options: RateLimitOptions = {}): RateLimiter {
  const {
    windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 min
    maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
    scope = "api",
    message = "Too many requests. Please try again later.",
  } = options;
  return { scope, windowMs, maxRequests, message };
}

/**
 * Atomically consumes one request slot for `key` within the limiter's window.
 * Returns the decision with the moment the current window ends.
 *
 * Implementation: one UPSERT per request.
 * - New key -> INSERT with count=1 and window_start=now().
 * - Existing key inside the window -> count+1 (window_start preserved).
 * - Existing key whose window has expired -> restart the window (count=1).
 *
 * window_start is anchored to a fixed grid (`/ windowMs`) so a key that keeps
 * receiving traffic still gets a fresh window at the boundary.
 */
async function consumeSlot(
  limiter: RateLimiter,
  key: string,
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const db = getDb();
  const windowMs = limiter.windowMs;
  const now = Date.now();
  const windowEpoch = Math.floor(now / windowMs);
  const resetTime = (windowEpoch + 1) * windowMs;
  const rows = await db.all<LimitRow>(
    `INSERT INTO rate_limits (key, count, window_start)
     VALUES ($1, 1, NOW())
     ON CONFLICT (key) DO UPDATE SET
       count = CASE
         WHEN rate_limits.window_start < NOW() - ($2::text || ' milliseconds')::interval
           THEN 1
         ELSE rate_limits.count + 1
       END,
       window_start = CASE
         WHEN rate_limits.window_start < NOW() - ($2::text || ' milliseconds')::interval
           THEN NOW()
         ELSE rate_limits.window_start
       END
     RETURNING count`,
    [key, String(windowMs)],
  );
  const count = Number(rows[0]?.count ?? 1);
  return {
    allowed: count <= limiter.maxRequests,
    remaining: Math.max(0, limiter.maxRequests - count),
    resetTime,
  };
}

// Pre-configured rate limiters
export const apiLimiter = rateLimit({
  scope: "api",
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  message: "Too many API requests. Please try again in 15 minutes.",
});

export const authLimiter = rateLimit({
  scope: "auth",
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 min
  message: "Too many login attempts. Please try again in 15 minutes.",
});

export const contactLimiter = rateLimit({
  scope: "contact",
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5, // 5 messages per hour
  message: "Too many contact form submissions. Please try again in 1 hour.",
});

// Helper: apply rate limit and return response if exceeded.
// Same contract as before: null means the request may proceed.
export async function applyRateLimit(
  request: Request,
  limiter: RateLimiter,
): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  if (!ip)
    return NextResponse.json(
      {
        success: false,
        error:
          "Client identification unavailable. Please contact the site administrator.",
      },
      { status: 503 },
    );

  let decision: { allowed: boolean; remaining: number; resetTime: number };
  try {
    decision = await consumeSlot(limiter, `${limiter.scope}:${ip}`);
  } catch (error) {
    // Fail closed: an unavailable database must not lift brute-force
    // protection on the auth/contact surfaces.
    console.error("[rate-limit] store unavailable", error);
    return NextResponse.json(
      { success: false, error: limiter.message },
      { status: 503 },
    );
  }

  if (!decision.allowed) {
    return NextResponse.json(
      { success: false, error: limiter.message },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(
            (decision.resetTime - Date.now()) / 1000,
          ).toString(),
          "X-RateLimit-Limit": limiter.maxRequests.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": Math.ceil(decision.resetTime / 1000).toString(),
        },
      },
    );
  }

  return null; // Allowed - no response needed
}
