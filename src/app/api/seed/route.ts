import { NextResponse } from "next/server";
export function GET() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Runtime seeding is disabled. Use the controlled database commands.",
    },
    { status: 410 },
  );
}
export const POST = GET;
