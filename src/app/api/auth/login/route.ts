import { withApi } from "@/lib/api-handler";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import {
  verifyPassword,
  createToken,
  setAuthCookie,
  logAuditAction,
} from "@/lib/auth";
import { validateBody, loginSchema } from "@/lib/validation";
import { authLimiter, applyRateLimit } from "@/lib/rate-limit";
import {
  apiSuccess,
  apiError,
  getClientIp,
  getUserAgent,
} from "@/lib/api-utils";

// Hash of a throwaway value: compared against when the account does not
// exist so unknown emails pay the same bcrypt cost as wrong passwords.
// Without this, response timing reveals which addresses are registered.
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.WT8FiFbBoZg0d/8mFfBeVysBwLPZm9e";

export const POST = withApi(async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await applyRateLimit(request, authLimiter);
  if (rateLimitResponse) return rateLimitResponse;

  // Validate input
  const validation = await validateBody(request, loginSchema);
  if (!validation.success) {
    return apiError(validation.error);
  }

  const { email, password } = validation.data;
  const ip = getClientIp(request);
  const ua = getUserAgent(request);

  const db = getDb();

  // Find user
  const user = await db.get<{
    id: number;
    email: string;
    password_hash: string;
    name: string;
    role: string;
  }>(
    "SELECT id, email, password_hash, name, role FROM users WHERE email = $1",
    [email],
  );

  if (!user) {
    // Burn the same bcrypt time a real verification would take, so unknown
    // accounts are indistinguishable from wrong passwords by timing.
    await verifyPassword(password, DUMMY_HASH);
    // Log failed attempt (don't reveal if user exists)
    await logAuditAction(
      null,
      "LOGIN_FAILED",
      "auth",
      ip,
      ua,
      `Email: ${email}`,
    );
    return apiError("Invalid email or password", 401);
  }

  // Verify password
  const validPassword = await verifyPassword(password, user.password_hash);
  if (!validPassword) {
    await logAuditAction(
      user.id,
      "LOGIN_FAILED",
      "auth",
      ip,
      ua,
      "Invalid password",
    );
    return apiError("Invalid email or password", 401);
  }

  // Create JWT and set cookie
  const token = await createToken(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    user.password_hash,
  );
  await setAuthCookie(token);

  // Audit log
  await logAuditAction(user.id, "LOGIN_SUCCESS", "auth", ip, ua);

  return apiSuccess({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});
