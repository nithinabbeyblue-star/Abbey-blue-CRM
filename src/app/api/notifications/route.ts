import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/notifications — List notifications for current user
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread") === "true";

  const notifications = await db.notification.findMany({
    where: {
      userId: user.userId,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = await db.notification.count({
    where: { userId: user.userId, isRead: false },
  });

  return NextResponse.json({ notifications, unreadCount });
}

// PATCH /api/notifications — Mark all as read
export async function PATCH() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.notification.updateMany({
    where: { userId: user.userId, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ ok: true });
}
