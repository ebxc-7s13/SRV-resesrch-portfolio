import { NextResponse } from "next/server";

import { getClientIp as clientIp } from "./client-ip";

// Standard API responses
export function apiSuccess(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function apiUnauthorized(message = "Authentication required") {
  return apiError(message, 401);
}

export function apiNotFound(message = "Resource not found") {
  return apiError(message, 404);
}

// Get client IP from request (respects TRUSTED_PROXY env var)
export function getClientIp(request: Request): string {
  return clientIp(request) || "unavailable";
}

// Get user agent
export function getUserAgent(request: Request): string {
  return request.headers.get("user-agent")?.slice(0, 500) || "unknown";
}

// Paginated response
export function apiPaginated(
  data: unknown[],
  total: number,
  page: number,
  limit: number,
) {
  return apiSuccess({
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  });
}
