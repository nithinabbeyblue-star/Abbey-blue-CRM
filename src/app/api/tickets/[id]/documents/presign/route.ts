import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import { getPresignedUploadUrl } from "@/lib/s3";
import { db } from "@/lib/db";
import { Role } from "@/generated/prisma/enums";

const presignSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().positive().max(10 * 1024 * 1024, "File must be under 10MB"),
});

// POST /api/tickets/[id]/documents/presign — Get a presigned S3 upload URL
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(Role.ADMIN, Role.KEY_COORDINATOR, Role.SUPER_ADMIN);
  if (error) return error;

  const { id } = await params;

  try {
    // Verify ticket exists
    const ticket = await db.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const body = await request.json();
    const { fileName, contentType, fileSize } = presignSchema.parse(body);

    // Generate a unique S3 key
    const ext = fileName.split(".").pop() || "bin";
    const fileId = crypto.randomUUID();
    const key = `documents/${id}/${fileId}.${ext}`;

    const uploadUrl = await getPresignedUploadUrl(key, contentType);

    return NextResponse.json({
      uploadUrl,
      key,
      fileName,
      fileSize,
      contentType,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 }
      );
    }
    console.error("Presign error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
