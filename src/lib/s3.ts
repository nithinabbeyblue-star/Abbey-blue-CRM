import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (!_client) {
    if (!process.env.AWS_S3_BUCKET_NAME) {
      throw new Error("AWS_S3_BUCKET_NAME is not set");
    }
    _client = new S3Client({
      region: process.env.AWS_S3_REGION || "eu-west-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return _client;
}

function getBucket(): string {
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  if (!bucket) throw new Error("AWS_S3_BUCKET_NAME is not set");
  return bucket;
}

/**
 * Generate a unique S3 key with folder prefix.
 * Format: documents/{uuid}-{sanitized-filename}
 */
function generateKey(folder: string, fileName: string): string {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${folder}/${randomUUID()}-${sanitized}`;
}

/**
 * Upload a file buffer directly to S3.
 */
export async function uploadToS3(
  fileName: string,
  mimeType: string,
  fileBuffer: Buffer,
  folder = "documents"
): Promise<{ fileKey: string; fileUrl: string }> {
  const client = getClient();
  const bucket = getBucket();
  const fileKey = generateKey(folder, fileName);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: fileKey,
      Body: fileBuffer,
      ContentType: mimeType,
    })
  );

  const region = process.env.AWS_S3_REGION || "eu-west-1";
  const fileUrl = `https://${bucket}.s3.${region}.amazonaws.com/${fileKey}`;

  return { fileKey, fileUrl };
}

/**
 * Delete a file from S3.
 */
export async function deleteFromS3(fileKey: string): Promise<void> {
  const client = getClient();
  const bucket = getBucket();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: fileKey,
    })
  );
}

/**
 * Generate a presigned URL for direct browser upload (PUT).
 * Valid for 10 minutes by default.
 */
export async function generatePresignedUploadUrl(
  fileName: string,
  mimeType: string,
  folder = "documents",
  expiresIn = 600
): Promise<{ uploadUrl: string; fileKey: string }> {
  const client = getClient();
  const bucket = getBucket();
  const fileKey = generateKey(folder, fileName);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: fileKey,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });

  return { uploadUrl, fileKey };
}

/**
 * Generate a presigned URL for downloading a file (GET).
 * Valid for 1 hour by default.
 */
export async function generatePresignedDownloadUrl(
  fileKey: string,
  expiresIn = 3600
): Promise<string> {
  const client = getClient();
  const bucket = getBucket();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: fileKey,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Check if S3 is configured.
 */
export function isS3Configured(): boolean {
  return !!(
    process.env.AWS_S3_BUCKET_NAME?.trim() &&
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
    process.env.AWS_SECRET_ACCESS_KEY?.trim()
  );
}
