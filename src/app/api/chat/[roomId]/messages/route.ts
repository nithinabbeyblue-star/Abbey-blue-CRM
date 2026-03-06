import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { triggerEvent, caseChannel } from "@/lib/pusher";

const attachmentSchema = z.object({
  fileName: z.string(),
  fileUrl: z.string(),
  fileKey: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
});

const sendMessageSchema = z.object({
  content: z.string().max(5000),
  mentions: z.array(z.string()).optional(),
  attachments: z.array(attachmentSchema).optional(),
}).refine((data) => data.content.trim().length > 0 || (data.attachments && data.attachments.length > 0), {
  message: "Message must have content or an attachment",
});

// POST /api/chat/[roomId]/messages — Send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;

  try {
    // Verify room exists and user is a member
    const room = await db.chatRoom.findUnique({
      where: { id: roomId },
      select: { id: true, ticketId: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Chat room not found" }, { status: 404 });
    }

    let membership = await db.chatRoomMember.findUnique({
      where: { chatRoomId_userId: { chatRoomId: roomId, userId: user.userId } },
    });

    // Auto-add managers and super admins to chat rooms
    if (!membership) {
      const autoJoinRoles = ["SUPER_ADMIN", "ADMIN_MANAGER", "SALES_MANAGER"];
      if (autoJoinRoles.includes(user.role)) {
        membership = await db.chatRoomMember.create({
          data: { chatRoomId: roomId, userId: user.userId },
        });
      } else {
        return NextResponse.json({ error: "Not a member of this chat" }, { status: 403 });
      }
    }

    const body = await request.json();
    const { content, mentions, attachments } = sendMessageSchema.parse(body);

    // Create message with attachments
    const message = await db.message.create({
      data: {
        content: content || "",
        chatRoomId: roomId,
        senderId: user.userId,
        ...(attachments && attachments.length > 0
          ? {
              attachments: {
                create: attachments.map((a) => ({
                  fileName: a.fileName,
                  fileUrl: a.fileUrl,
                  fileKey: a.fileKey,
                  fileSize: a.fileSize,
                  mimeType: a.mimeType,
                })),
              },
            }
          : {}),
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        attachments: {
          select: { id: true, fileName: true, fileUrl: true, fileSize: true, mimeType: true },
        },
      },
    });

    // Create mention records if any
    if (mentions && mentions.length > 0) {
      await db.mention.createMany({
        data: mentions.map((mentionedId) => ({
          messageId: message.id,
          mentionedId,
        })),
      });

      // Create notifications for mentioned users
      await db.notification.createMany({
        data: mentions.map((mentionedId) => ({
          type: "MENTION" as const,
          title: "You were mentioned",
          body: `${user.name} mentioned you in a case chat`,
          userId: mentionedId,
          metadata: JSON.stringify({
            ticketId: room.ticketId,
            chatRoomId: roomId,
            messageId: message.id,
          }),
        })),
      });

      // Trigger notification to each mentioned user
      for (const mentionedId of mentions) {
        triggerEvent(`private-user-${mentionedId}`, "notification", {
          type: "MENTION",
          title: "You were mentioned",
          body: `${user.name} mentioned you in a case chat`,
          ticketId: room.ticketId,
        });
      }
    }

    // Trigger real-time event to the case channel
    triggerEvent(caseChannel(room.ticketId), "new-message", {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      sender: message.sender,
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 }
      );
    }
    console.error("Send message error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/chat/[roomId]/messages — Load message history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;

  // Verify membership — auto-add managers and super admins
  let membership = await db.chatRoomMember.findUnique({
    where: { chatRoomId_userId: { chatRoomId: roomId, userId: user.userId } },
  });

  if (!membership) {
    const autoJoinRoles = ["SUPER_ADMIN", "ADMIN_MANAGER", "SALES_MANAGER"];
    if (autoJoinRoles.includes(user.role)) {
      membership = await db.chatRoomMember.create({
        data: { chatRoomId: roomId, userId: user.userId },
      });
    } else {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor"); // message ID for pagination
  const limit = 50;

  const messages = await db.message.findMany({
    where: { chatRoomId: roomId },
    orderBy: { createdAt: "asc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      sender: { select: { id: true, name: true, role: true } },
      attachments: {
        select: { id: true, fileName: true, fileUrl: true, fileSize: true, mimeType: true },
      },
      mentions: {
        select: { mentionedId: true },
      },
    },
  });

  return NextResponse.json({
    messages,
    hasMore: messages.length === limit,
  });
}
