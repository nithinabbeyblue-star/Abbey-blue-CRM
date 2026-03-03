import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { getPresignedDownloadUrl } from "@/lib/s3";
import { Role } from "@/generated/prisma/enums";

const confirmSchema = z.object({
  fileName: z.string().min(1),
  fileKey: z.string().min(1),
  fileType: z.enum(["PASSPORT", "PHOTO", "BANK_STATEMENT", "VISA_FORM", "SUPPORTING_DOC", "OTHER"]),
  fileSize: z.number().positive(),
  mimeType: z.string().min(1),
});

// POST /api/tickets/[id]/documents — Confirm upload & save DB record
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireRole(Role.ADMIN, Role.KEY_COORDINATOR, Role.SUPER_ADMIN);
  if (error) return error;

  const { id } = await params;

  try {
    const ticket = await db.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = confirmSchema.parse(body);

    const document = await db.document.create({
      data: {
        fileName: data.fileName,
        fileUrl: data.fileKey, // Store the S3 key — presigned URL generated on demand
        fileKey: data.fileKey,
        fileType: data.fileType,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        ticketId: id,
        uploadedById: user.userId,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        ticketId: id,
        userId: user.userId,
        action: "DOCUMENT_UPLOADED",
        newValue: `${data.fileName} (${data.fileType})`,
        metadata: JSON.stringify({ documentId: document.id, fileKey: data.fileKey }),
      },
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 }
      );
    }
    console.error("Document confirm error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/tickets/[id]/documents — List documents with presigned download URLs
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(Role.ADMIN, Role.KEY_COORDINATOR, Role.SUPER_ADMIN);
  if (error) return error;

  const { id } = await params;

  const documents = await db.document.findMany({
    where: { ticketId: id },
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: { select: { name: true } },
    },
  });

  // Generate presigned download URLs for each document
  const docsWithUrls = await Promise.all(
    documents.map(async (doc) => ({
      ...doc,
      downloadUrl: doc.fileKey ? await getPresignedDownloadUrl(doc.fileKey) : doc.fileUrl,
    }))
  );

  return NextResponse.json({ documents: docsWithUrls });
}
