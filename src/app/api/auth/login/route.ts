// This route is replaced by NextAuth. See: src/app/api/auth/[...nextauth]/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "This endpoint has been replaced. Please use the login page." },
    { status: 410 }
  );
}
