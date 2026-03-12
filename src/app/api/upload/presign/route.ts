import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import { generatePresignedUploadUrl, isS3Configured } from "@/lib/s3";
import { Role } from "@/generated/prisma/enums";

const presignSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  folder: z.string().default("documents"),
});

// POST /api/upload/presign — Get a presigned URL for direct browser upload to S3
export async function POST(request: NextRequest) {
  const { error } = await requireRole(
    Role.ADMIN,
    Role.ADMIN_MANAGER,
    Role.SALES,
    Role.SALES_MANAGER,
    Role.SUPER_ADMIN
  );
  if (error) return error;

  if (!isS3Configured()) {
    return NextResponse.json(
      { error: "File storage (S3) is not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const data = presignSchema.parse(body);

    const { uploadUrl, fileKey } = await generatePresignedUploadUrl(
      data.fileName,
      data.mimeType,
      data.folder
    );

    const region = process.env.AWS_S3_REGION || "eu-west-1";
    const bucket = process.env.AWS_S3_BUCKET_NAME;
    const fileUrl = `https://${bucket}.s3.${region}.amazonaws.com/${fileKey}`;

    return NextResponse.json({ uploadUrl, fileKey, fileUrl });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 }
      );
    }
    console.error("Presign error:", err);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
