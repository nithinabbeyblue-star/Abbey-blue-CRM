import { google } from "googleapis";
import { Readable } from "stream";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});

const drive = google.drive({ version: "v3", auth });

// Accept folder ID, or full Drive URL, or ID with query params (strip to plain ID). Only called when uploading (so app doesn't crash if env is missing).
function getFolderId(): string {
  const raw = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!raw) throw new Error("GOOGLE_DRIVE_FOLDER_ID is not set");
  const fromUrl = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  const id = fromUrl ? fromUrl[1]! : raw.split("?")[0]!.trim();
  if (!id) throw new Error("GOOGLE_DRIVE_FOLDER_ID is invalid");
  return id;
}

/**
 * Upload a file to Google Drive and make it accessible via link.
 */
export async function uploadToGoogleDrive(
  fileName: string,
  mimeType: string,
  fileBuffer: Buffer
): Promise<{ fileId: string; webViewLink: string; downloadUrl: string }> {
  const folderId = getFolderId();
  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(fileBuffer),
    },
    fields: "id, webViewLink",
  });

  const fileId = res.data.id!;

  // Make file accessible to anyone with the link
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  return {
    fileId,
    webViewLink: res.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
  };
}

/**
 * Delete a file from Google Drive.
 */
export async function deleteFromGoogleDrive(fileId: string): Promise<void> {
  await drive.files.delete({ fileId });
}

/**
 * Get a direct download URL for a Google Drive file.
 */
export function getDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}
