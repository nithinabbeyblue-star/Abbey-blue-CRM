import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { deleteFromS3, isS3Configured } from "@/lib/s3";
import { deleteFromGoogleDrive, isDriveConfigured } from "@/lib/google-drive";
import { Role } from "@/generated/prisma/enums";

// DELETE /api/tickets/[id]/documents/[docId] — Delete a document
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { user, error } = await requireRole(Role.ADMIN, Role.ADMIN_MANAGER, Role.SUPER_ADMIN);
  if (error) return error;

  const { id, docId } = await params;

  try {
    const document = await db.document.findUnique({
      where: { id: docId },
    });

    if (!document || document.ticketId !== id) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Delete from storage — S3 keys contain "/", Drive IDs don't
    if (document.fileKey) {
      const isS3Key = document.fileKey.includes("/");
      if (isS3Key && isS3Configured()) {
        await deleteFromS3(document.fileKey).catch((err) => {
          console.error("S3 delete error (non-fatal):", err);
        });
      } else if (!isS3Key && isDriveConfigured()) {
        await deleteFromGoogleDrive(document.fileKey).catch((err) => {
          console.error("Google Drive delete error (non-fatal):", err);
        });
      }
    }

    // Delete from DB
    await db.document.delete({ where: { id: docId } });

    // Audit log
    await db.auditLog.create({
      data: {
        ticketId: id,
        userId: user.userId,
        action: "DOCUMENT_DELETED",
        oldValue: `${document.fileName} (${document.fileType})`,
        metadata: JSON.stringify({ documentId: docId }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete document error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
