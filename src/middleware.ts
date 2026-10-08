import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// JWT secret is read lazily per request so that a missing variable at build
// time never crashes module evaluation, and rotation is picked up without a
// redeploy of a cached module instance.
function getJwtKey(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

const COOKIE_NAME = "auth-token";

// Routes that ALWAYS require admin auth (even GET). The "/api/admin/" prefix
// alone already covers every admin surface; the list exists only so a future
// non-prefixed admin route is not silently unprotected.
const ALWAYS_PROTECTED = ["/api/admin/"];

// Routes that require auth for mutations (POST/PUT/DELETE) but allow public GET
const MUTATION_PROTECTED = ["/api/admin/"];

// Routes that require any authenticated user
const AUTH_ROUTES = ["/api/auth/me", "/api/auth/logout"];

async function verifyJwt(token: string): Promise<boolean> {
  const key = getJwtKey();
  if (!key) return false;
  try {
    await jwtVerify(token, key, {
      issuer: "secure-portfolio",
      audience: "secure-portfolio-users",
      algorithms: ["HS256"],
    });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Reject the development viewer before a streamed layout can commit HTTP 200.
  if (
    process.env.NODE_ENV === "production" &&
    (pathname === "/lab/models" || pathname.startsWith("/lab/models/"))
  ) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Skip middleware for non-API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Check if route always requires admin auth (all methods)
  const alwaysProtected = ALWAYS_PROTECTED.some((route) =>
    pathname.startsWith(route),
  );

  // Check if route requires auth for mutations only
  const mutationProtected = MUTATION_PROTECTED.some((route) =>
    pathname.startsWith(route),
  );

  // Check if route requires any auth
  const requiresAuth = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  const needsAuth =
    alwaysProtected || (mutationProtected && method !== "GET") || requiresAuth;

  if (needsAuth) {
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const isValid = await verifyJwt(token);
    if (!isValid) {
      // Clear invalid cookie
      const response = NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 },
      );
      response.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
      return response;
    }
  }

  // Add security headers to all API responses
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Cache-Control", "no-store, max-age=0");

  return response;
}

export const config = {
  matcher: ["/api/:path*", "/lab/models/:path*"],
};
