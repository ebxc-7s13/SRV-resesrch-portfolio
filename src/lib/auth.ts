import { SignJWT, jwtVerify, decodeJwt } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import crypto from "crypto";
import { getDb } from "./db";
import { HttpError } from "./api-handler";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET environment variable is required but not set");
  }
  return new TextEncoder().encode(secret);
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const COOKIE_NAME = "auth-token";

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

export interface JwtPayload {
  sub: string;
  jti: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// Hash password with bcrypt (12 rounds)
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify password
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Create JWT token
export async function createToken(
  user: User,
  expectedPasswordHash?: string,
): Promise<string> {
  const token = await new SignJWT({
    sub: String(user.id),
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .setIssuer("secure-portfolio")
    .setAudience("secure-portfolio-users")
    .sign(getJwtSecret());

  // Store token hash in sessions table for revocation
  const db = getDb();
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(decodeJwt(token).exp! * 1000).toISOString();

  await db.transaction(async (client) => {
    // Serialize issuance with password rotation on the same user row.
    const current = await client.query(
      "SELECT password_hash FROM users WHERE id=$1 FOR UPDATE",
      [user.id],
    );
    if (
      !current.rows[0] ||
      (expectedPasswordHash &&
        current.rows[0].password_hash !== expectedPasswordHash)
    )
      throw new HttpError(401, "Credentials changed. Please sign in again.");
    await client.query(
      "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
      [user.id, tokenHash, expiresAt],
    );
  });

  return token;
}

// Verify JWT token
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      issuer: "secure-portfolio",
      audience: "secure-portfolio-users",
      algorithms: ["HS256"],
    });

    // Check if token is revoked
    const db = getDb();
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    if (
      !payload.sub ||
      !/^\d+$/.test(payload.sub) ||
      !payload.jti ||
      !payload.exp
    )
      return null;
    const session = await db.get<{
      user_id: number;
      revoked: number;
      expires_at: string;
    }>(
      "SELECT user_id, revoked, expires_at FROM sessions WHERE token_hash = $1",
      [tokenHash],
    );
    if (
      !session ||
      session.revoked !== 0 ||
      Number(session.user_id) !== Number(payload.sub)
    )
      return null;
    const sessionExpiry = new Date(session.expires_at).getTime();
    if (
      !Number.isFinite(sessionExpiry) ||
      sessionExpiry <= Date.now() ||
      sessionExpiry !== payload.exp * 1000
    )
      return null;

    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

// Set auth cookie (httpOnly, secure, sameSite)
export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true, // Cannot be accessed by JavaScript
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict", // CSRF protection
    expires: new Date(decodeJwt(token).exp! * 1000),
    path: "/",
  });
}

// Get auth token from cookies
export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

// Clear auth cookie
export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
}

// Revoke all sessions for a user
export async function revokeAllSessions(userId: number) {
  const db = getDb();
  await db.run("UPDATE sessions SET revoked = 1 WHERE user_id = $1", [userId]);
}

// Get current user from request
export async function getCurrentUser(
  request?: NextRequest,
): Promise<User | null> {
  let token: string | undefined;

  if (request) {
    token = request.cookies.get(COOKIE_NAME)?.value;
  } else {
    token = await getAuthToken();
  }

  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const db = getDb();
  const user = await db.get<User>(
    "SELECT id, email, name, role FROM users WHERE id = $1",
    [Number(payload.sub)],
  );

  return user || null;
}

// Require authenticated user (throws if not)
export async function requireAuth(request?: NextRequest): Promise<User> {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new HttpError(401, "Authentication required");
  }
  return user;
}

// Require admin role
export async function requireAdmin(request?: NextRequest): Promise<User> {
  const user = await requireAuth(request);
  if (user.role !== "admin") {
    throw new HttpError(403, "Administrator access required");
  }
  return user;
}

// Audit log
export async function logAuditAction(
  userId: number | null,
  action: string,
  resource?: string,
  ipAddress?: string,
  userAgent?: string,
  details?: string,
) {
  const db = getDb();
  await db.run(
    `INSERT INTO audit_log (user_id, action, resource, ip_address, user_agent, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, action, resource, ipAddress, userAgent, details],
  );
}
