import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getPresignedUploadUrl } from "@/lib/s3";

const presignSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().positive().max(10 * 1024 * 1024, "File must be under 10MB"),
});

// POST /api/chat/[roomId]/attachments/presign — Get presigned URL for chat file upload
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;

  // Verify membership
  const membership = await db.chatRoomMember.findUnique({
    where: { chatRoomId_userId: { chatRoomId: roomId, userId: user.userId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { fileName, contentType, fileSize } = presignSchema.parse(body);

    const room = await db.chatRoom.findUnique({
      where: { id: roomId },
      select: { ticketId: true },
    });

    const ext = fileName.split(".").pop() || "bin";
    const fileId = crypto.randomUUID();
    const key = `chat/${room?.ticketId || roomId}/${fileId}.${ext}`;

    const uploadUrl = await getPresignedUploadUrl(key, contentType);

    return NextResponse.json({ uploadUrl, key, fileName, fileSize, contentType });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.issues }, { status: 400 });
    }
    console.error("Chat attachment presign error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
