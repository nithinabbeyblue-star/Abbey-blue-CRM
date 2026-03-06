import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { uploadToGoogleDrive } from "@/lib/google-drive";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// POST /api/chat/[roomId]/attachments/presign — Upload a chat attachment
// (Route path kept for backward compatibility; now does direct upload instead of presigning)
export async function POST(
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

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File must be under 10MB" }, { status: 400 });
    }

    const mimeType = file.type || "application/octet-stream";
    const buffer = Buffer.from(await file.arrayBuffer());

    const { fileId, downloadUrl } = await uploadToGoogleDrive(file.name, mimeType, buffer);

    return NextResponse.json({
      fileName: file.name,
      fileUrl: downloadUrl,
      fileKey: fileId,
      fileSize: file.size,
      mimeType,
    });
  } catch (err) {
    console.error("Chat attachment upload error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
