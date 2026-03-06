import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/auth/check-status?email=... — Unauthenticated. Used by waiting room to poll.
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")?.toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { status: true, mustSetPassword: true },
  });

  if (!user) {
    // Don't reveal whether user exists — return generic PENDING
    return NextResponse.json({ status: "PENDING", mustSetPassword: false });
  }

  return NextResponse.json({
    status: user.status,
    mustSetPassword: user.mustSetPassword,
  });
}
