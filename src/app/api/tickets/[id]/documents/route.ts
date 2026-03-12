import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { uploadToS3, isS3Configured, generatePresignedDownloadUrl } from "@/lib/s3";
import { uploadToGoogleDrive, isDriveConfigured } from "@/lib/google-drive";
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

// POST /api/tickets/[id]/documents — Upload a document
// Supports two modes:
//   1. JSON body (presigned URL flow): file already in S3, just save DB record
//   2. FormData (direct upload): upload file to S3 or Google Drive, then save DB record
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

    const contentType = request.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    let fileName: string;
    let fileUrl: string;
    let fileKey: string;
    let fileType: string | null;
    let fileSize: number | null;
    let mimeType: string;

    if (isJson) {
      // Mode 1: File already uploaded to S3 via presigned URL
      const body = await request.json();
      fileName = body.fileName;
      fileUrl = body.fileUrl;
      fileKey = body.fileKey;
      fileType = body.fileType || null;
      fileSize = body.fileSize || null;
      mimeType = body.mimeType || "application/octet-stream";

      if (!fileName || !fileUrl || !fileKey) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }
    } else {
      // Mode 2: Direct file upload via FormData
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      fileType = formData.get("fileType") as string | null;

      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "File must be under 10MB" }, { status: 400 });
      }

      mimeType = file.type || "application/octet-stream";
      if (!ALLOWED_TYPES.includes(mimeType)) {
        return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
      }

      fileName = file.name;
      fileSize = file.size;
      const buffer = Buffer.from(await file.arrayBuffer());

      // Try S3 first, fall back to Google Drive
      if (isS3Configured()) {
        const result = await uploadToS3(file.name, mimeType, buffer, `tickets/${id}`);
        fileKey = result.fileKey;
        fileUrl = result.fileUrl;
      } else if (isDriveConfigured()) {
        const result = await uploadToGoogleDrive(file.name, mimeType, buffer);
        fileKey = result.fileId;
        fileUrl = result.downloadUrl;
      } else {
        return NextResponse.json(
          { error: "No file storage configured. Set up either AWS S3 or Google Drive in .env" },
          { status: 503 }
        );
      }
    }

    const validFileType = VALID_FILE_TYPES.includes(fileType as typeof VALID_FILE_TYPES[number])
      ? (fileType as typeof VALID_FILE_TYPES[number])
      : "OTHER";

    // Save database record
    const document = await db.document.create({
      data: {
        fileName,
        fileUrl,
        fileKey,
        fileType: validFileType,
        fileSize,
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
        newValue: `${fileName} (${validFileType})`,
        metadata: JSON.stringify({ documentId: document.id, fileKey }),
      },
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    console.error("Document upload error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    const isConfig =
      message.includes("AWS_S3") ||
      message.includes("GOOGLE_DRIVE") ||
      message.includes("credentials") ||
      message.includes("invalid_grant") ||
      message.includes("AccessDenied");
    return NextResponse.json(
      { error: isConfig ? "File storage is not configured correctly. Check your storage credentials in .env" : message },
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

  // Generate presigned download URLs for S3 files; Google Drive URLs are already direct
  const docsWithUrls = await Promise.all(
    documents.map(async (doc) => {
      let downloadUrl = doc.fileUrl;
      // S3 keys contain "/" (e.g. tickets/abc/uuid-file.pdf), Drive IDs don't
      if (doc.fileKey && doc.fileKey.includes("/") && isS3Configured()) {
        try {
          downloadUrl = await generatePresignedDownloadUrl(doc.fileKey);
        } catch {
          // Fall back to stored URL
        }
      }
      return { ...doc, downloadUrl };
    })
  );

  return NextResponse.json({ documents: docsWithUrls });
}
