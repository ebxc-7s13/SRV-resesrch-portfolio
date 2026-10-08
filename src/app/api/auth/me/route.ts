import { withApi } from "@/lib/api-handler";
import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { apiSuccess, apiUnauthorized } from "@/lib/api-utils";

export const GET = withApi(async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return apiUnauthorized();
  return apiSuccess({ user });
});
