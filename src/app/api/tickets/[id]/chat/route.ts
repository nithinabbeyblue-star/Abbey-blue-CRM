import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/tickets/[id]/chat — Get chat room info for a ticket
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const chatRoom = await db.chatRoom.findUnique({
    where: { ticketId: id },
    select: {
      id: true,
      ticketId: true,
      members: {
        select: {
          userId: true,
          lastReadAt: true,
          user: { select: { id: true, name: true, role: true } },
        },
      },
    },
  });

  if (!chatRoom) {
    return NextResponse.json({ error: "No chat room for this ticket" }, { status: 404 });
  }

  // Check if user is a member
  const isMember = chatRoom.members.some((m) => m.userId === user.userId);
  if (!isMember) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  return NextResponse.json({ chatRoom });
}
