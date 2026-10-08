import { withApi } from "@/lib/api-handler";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { createHash, timingSafeEqual } from "node:crypto";

// This endpoint should be called by a cron job (e.g., Vercel Cron, GitHub Actions)
// It cleans up expired sessions, old audit log entries and stale rate-limit rows.
export const GET = withApi(async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access. The comparison runs in
  // constant time over SHA-256 digests so neither length nor content can be
  // probed byte-by-byte through response timing.
  const authHeader = request.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;

  const authorized =
    !!cronSecret &&
    timingSafeEqual(
      createHash("sha256").update(authHeader).digest(),
      createHash("sha256").update(`Bearer ${cronSecret}`).digest(),
    );

  if (!authorized) {
    return apiError("Unauthorized", 401);
  }

  const db = getDb();

  // Clean up expired sessions
  const expiredSessions = await db.run(
    "DELETE FROM sessions WHERE expires_at < NOW()",
  );

  // Clean up audit log entries older than 90 days
  const oldAuditLogs = await db.run(
    "DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days'",
  );

  // Clean up expired rate-limit windows (one row per key per window)
  const expiredRateLimits = await db.run(
    "DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '2 days'",
  );
  void expiredRateLimits;

  return apiSuccess({
    message: "Cleanup completed",
    expiredSessionsRemoved: expiredSessions.changes,
    oldAuditLogsRemoved: oldAuditLogs.changes,
    rateLimitRowsRemoved: expiredRateLimits.changes,
  });
});
