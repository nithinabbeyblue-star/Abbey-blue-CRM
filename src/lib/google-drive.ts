import { google } from "googleapis";
import { Readable } from "stream";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

/** Use OAuth (personal Gmail Drive) when refresh token is set; otherwise service account (Shared Drive). */
export function isOAuthConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
    process.env.GOOGLE_CLIENT_SECRET?.trim() &&
    process.env.GOOGLE_REFRESH_TOKEN?.trim()
  );
}

function isServiceAccountConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_EMAIL?.trim() && process.env.GOOGLE_PRIVATE_KEY?.trim());
}

function getAuth(): import("google-auth-library").JSONClient {
  if (isOAuthConfigured()) {
    const clientId = process.env.GOOGLE_CLIENT_ID!.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!.trim();
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN!.trim();
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() || "http://localhost:3000/api/setup/google-drive/callback";
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2.setCredentials({ refresh_token: refreshToken });
    return oauth2;
  }
  if (isServiceAccountConfigured()) {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL!.trim();
    let privateKey = process.env.GOOGLE_PRIVATE_KEY!.trim();
    if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");
    return new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: [DRIVE_SCOPE],
    }) as unknown as import("google-auth-library").JSONClient;
  }
  throw new Error("Set either (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN) for personal Drive, or (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY) for Shared Drive.");
}

/** Folder ID in your Drive (My Drive for OAuth; Shared Drive for service account). */
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
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const isSharedDrive = !isOAuthConfigured();
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
    ...(isSharedDrive ? { supportsAllDrives: true } : {}),
  });

  const fileId = res.data.id!;

  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
    ...(isSharedDrive ? { supportsAllDrives: true } : {}),
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
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  await drive.files.delete({
    fileId,
    ...(isServiceAccountConfigured() ? { supportsAllDrives: true } : {}),
  });
}

export function isDriveConfigured(): boolean {
  return isOAuthConfigured() || isServiceAccountConfigured();
}
