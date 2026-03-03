import { NextResponse } from "next/server";

// GET /api/push/vapid-key — Return VAPID public key for client-side subscription
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY || "";
  if (!key) {
    return NextResponse.json({ error: "Push not configured" }, { status: 503 });
  }
  return NextResponse.json({ publicKey: key });
}
