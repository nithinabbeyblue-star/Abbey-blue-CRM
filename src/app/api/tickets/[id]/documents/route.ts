import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { uploadToGoogleDrive } from "@/lib/google-drive";
import { Role } from "@/generated/prisma/enums";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
];

const VALID_FILE_TYPES = [
  "PASSPORT",
  "PHOTO",
  "BANK_STATEMENT",
  "VISA_FORM",
  "SUPPORTING_DOC",
  "OTHER",
] as const;

// POST /api/tickets/[id]/documents — Upload a document via FormData
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireRole(Role.ADMIN, Role.ADMIN_MANAGER, Role.SUPER_ADMIN);
  if (error) return error;

  const { id } = await params;

  try {
    const ticket = await db.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const fileType = formData.get("fileType") as string | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File must be under 10MB" }, { status: 400 });
    }

    const mimeType = file.type || "application/octet-stream";
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }

    const validFileType = VALID_FILE_TYPES.includes(fileType as typeof VALID_FILE_TYPES[number])
      ? (fileType as typeof VALID_FILE_TYPES[number])
      : "OTHER";

    // Upload to Google Drive
    const buffer = Buffer.from(await file.arrayBuffer());
    const { fileId, downloadUrl } = await uploadToGoogleDrive(file.name, mimeType, buffer);

    // Save database record
    const document = await db.document.create({
      data: {
        fileName: file.name,
        fileUrl: downloadUrl,
        fileKey: fileId,
        fileType: validFileType,
        fileSize: file.size,
        mimeType,
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
        newValue: `${file.name} (${validFileType})`,
        metadata: JSON.stringify({ documentId: document.id, driveFileId: fileId }),
      },
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    console.error("Document upload error:", err);
    const message =
      err instanceof Error
        ? err.message
        : "Internal server error";
    const isConfig =
      message.includes("GOOGLE_DRIVE_FOLDER_ID") ||
      message.includes("credentials") ||
      message.includes("invalid_grant") ||
      message.includes("not found");
    return NextResponse.json(
      { error: isConfig ? "Document storage (Google Drive) is not configured. Check GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_DRIVE_FOLDER_ID in .env" : message },
      { status: 500 }
    );
  }
}

// GET /api/tickets/[id]/documents — List documents
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(Role.ADMIN, Role.ADMIN_MANAGER, Role.SUPER_ADMIN);
  if (error) return error;

  const { id } = await params;

  const documents = await db.document.findMany({
    where: { ticketId: id },
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: { select: { name: true } },
    },
  });

  // Download URLs are already stored in fileUrl — no need to generate on-the-fly
  const docsWithUrls = documents.map((doc) => ({
    ...doc,
    downloadUrl: doc.fileUrl,
  }));

  return NextResponse.json({ documents: docsWithUrls });
}
