import { withApi } from "@/lib/api-handler";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { validateBody, contactSchema } from "@/lib/validation";
import { contactLimiter, applyRateLimit } from "@/lib/rate-limit";
import { apiSuccess, apiError, getClientIp } from "@/lib/api-utils";

export const POST = withApi(async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await applyRateLimit(request, contactLimiter);
  if (rateLimitResponse) return rateLimitResponse;

  // Validate input
  const validation = await validateBody(request, contactSchema);
  if (!validation.success) {
    return apiError(validation.error);
  }

  const { name, email, subject, message } = validation.data;
  const ip = getClientIp(request);

  // Additional spam detection: check for common spam patterns
  const tooManyLinks = (message.match(/https?:\/\/[^\s]+/g) || []).length >= 3;

  if (tooManyLinks) {
    // Silently reject spam without alerting the bot
    return apiError("Please include fewer than three links in your message.");
  }

  const db = getDb();

  try {
    await db.run(
      `INSERT INTO messages (name, email, subject, message, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [name, email, subject, message, ip],
    );

    return apiSuccess({ message: "Message sent successfully!" });
  } catch (error) {
    return apiError("Failed to send message. Please try again.");
  }
});
