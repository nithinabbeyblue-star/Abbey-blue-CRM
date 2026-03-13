import { NextResponse } from "next/server";

// TEMPORARY — delete after debugging
export async function GET() {
  return NextResponse.json({
    s3Configured: !!(
      process.env.AWS_S3_BUCKET_NAME?.trim() &&
      process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim()
    ),
    bucketSet: !!process.env.AWS_S3_BUCKET_NAME?.trim(),
    keySet: !!process.env.AWS_ACCESS_KEY_ID?.trim(),
    secretSet: !!process.env.AWS_SECRET_ACCESS_KEY?.trim(),
    region: process.env.AWS_S3_REGION || "not set",
  });
}
