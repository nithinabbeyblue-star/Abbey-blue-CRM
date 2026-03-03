import { NextResponse } from "next/server";

// GET /api/pusher/status — Public; tells the client whether Pusher is configured so it can skip initializing pusher-js and avoid "Connection failed" when keys are empty.
export async function GET() {
  const configured =
    !!(
      process.env.PUSHER_APP_ID &&
      process.env.PUSHER_KEY &&
      process.env.PUSHER_SECRET &&
      process.env.NEXT_PUBLIC_PUSHER_KEY &&
      process.env.NEXT_PUBLIC_PUSHER_CLUSTER
    );
  return NextResponse.json({ configured });
}
