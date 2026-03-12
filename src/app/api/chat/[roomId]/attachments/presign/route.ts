import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { uploadToS3, isS3Configured } from "@/lib/s3";
import { uploadToGoogleDrive, isDriveConfigured } from "@/lib/google-drive";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// POST /api/chat/[roomId]/attachments/presign — Upload a chat attachment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isS3Configured() && !isDriveConfigured()) {
    return NextResponse.json(
      { error: "File storage is not configured. Attachment uploads are unavailable." },
      { status: 503 }
    );
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

    let fileKey: string;
    let fileUrl: string;

    // Try S3 first, fall back to Google Drive
    if (isS3Configured()) {
      const result = await uploadToS3(file.name, mimeType, buffer, `chat/${roomId}`);
      fileKey = result.fileKey;
      fileUrl = result.fileUrl;
    } else {
      const result = await uploadToGoogleDrive(file.name, mimeType, buffer);
      fileKey = result.fileId;
      fileUrl = result.downloadUrl;
    }

    return NextResponse.json({
      fileName: file.name,
      fileUrl,
      fileKey,
      fileSize: file.size,
      mimeType,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Chat attachment upload error:", message, err);
    const safeMessage =
      message.includes("AWS_S3") || message.includes("GOOGLE_") || message.includes("credentials") || message.includes("AccessDenied")
        ? "File storage is not available. Please try again later or contact support."
        : "File upload failed. Please try again.";
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
