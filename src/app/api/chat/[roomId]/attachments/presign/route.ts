import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isDriveConfigured, uploadToGoogleDrive } from "@/lib/google-drive";

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

  if (!process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || !isDriveConfigured()) {
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

    const { fileId, downloadUrl } = await uploadToGoogleDrive(file.name, mimeType, buffer);

    return NextResponse.json({
      fileName: file.name,
      fileUrl: downloadUrl,
      fileKey: fileId,
      fileSize: file.size,
      mimeType,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const apiMessage =
      err && typeof err === "object" && "response" in err && err.response && typeof (err as { response: { data?: unknown } }).response.data === "object"
        ? JSON.stringify((err as { response: { data: unknown } }).response.data)
        : null;
    console.error("Chat attachment upload error:", message, apiMessage ?? "", err);
    const isDev = process.env.NODE_ENV === "development";
    const safeMessage =
      isDev && (message || apiMessage)
        ? [message, apiMessage].filter(Boolean).join(" — ")
        : message.includes("GOOGLE_") || message.includes("credentials") || message.includes("ECONNREFUSED")
          ? "File storage is not available. Please try again later or contact support."
          : "File upload failed. Please try again.";
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
