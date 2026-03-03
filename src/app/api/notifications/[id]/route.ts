import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// PATCH /api/notifications/[id] — Mark single notification as read
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const notification = await db.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== user.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.notification.update({
    where: { id },
    data: { isRead: true },
  });

  return NextResponse.json({ ok: true });
}
