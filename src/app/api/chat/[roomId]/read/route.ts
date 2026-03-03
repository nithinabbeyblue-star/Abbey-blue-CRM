import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/chat/[roomId]/read — Mark chat as read (update lastReadAt)
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;

  await db.chatRoomMember.updateMany({
    where: { chatRoomId: roomId, userId: user.userId },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
