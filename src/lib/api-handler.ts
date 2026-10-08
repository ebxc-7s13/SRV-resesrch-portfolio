import { NextRequest } from "next/server";
import { apiError } from "./api-utils";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Keep route failures explicit without returning SQL, credentials or stack traces. */
export function withApi<T extends unknown[]>(
  handler: (request: NextRequest, ...args: T) => Promise<Response>,
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      if (error instanceof HttpError)
        return apiError(error.message, error.status);
      if (error instanceof SyntaxError)
        return apiError("Invalid JSON body", 400);
      const code = (error as { code?: string })?.code;
      if (code === "23505")
        return apiError("A record with this value already exists", 409);
      if (code === "23503")
        return apiError(
          "The referenced record is missing or still in use",
          409,
        );
      if (code === "22P02") return apiError("Invalid record identifier", 400);
      console.error("[api] Request failed", {
        code: code || "internal",
        path: new URL(request.url).pathname,
      });
      return apiError(
        "The service is temporarily unavailable. Please try again.",
        503,
      );
    }
  };
}

export function pagination(params: URLSearchParams) {
  const page = Number(params.get("page") ?? "1");
  const limit = Number(params.get("limit") ?? "20");
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 100000 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new HttpError(400, "page must be 1–100000 and limit must be 1–100");
  }
  return { page, limit, offset: (page - 1) * limit };
}
