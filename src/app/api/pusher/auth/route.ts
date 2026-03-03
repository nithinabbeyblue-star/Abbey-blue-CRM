import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPusher } from "@/lib/pusher";
import { db } from "@/lib/db";

// POST /api/pusher/auth — Authenticate Pusher private channels
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pusher = getPusher();
  if (!pusher) {
    return NextResponse.json({ error: "Pusher not configured" }, { status: 503 });
  }

  const body = await request.text();
  const params = new URLSearchParams(body);
  const socketId = params.get("socket_id");
  const channelName = params.get("channel_name");

  if (!socketId || !channelName) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  // Authorize private-case-{ticketId} channels
  if (channelName.startsWith("private-case-")) {
    const ticketId = channelName.replace("private-case-", "");

    // Verify user is a member of this chat room
    const membership = await db.chatRoomMember.findFirst({
      where: {
        chatRoom: { ticketId },
        userId: user.userId,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Authorize private-user-{userId} channels (user can only subscribe to their own)
  if (channelName.startsWith("private-user-")) {
    const targetUserId = channelName.replace("private-user-", "");
    if (targetUserId !== user.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const authResponse = pusher.authorizeChannel(socketId, channelName);
  return NextResponse.json(authResponse);
}
