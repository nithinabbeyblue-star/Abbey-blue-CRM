import { NextResponse } from "next/server";
import { google } from "googleapis";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

// GET /api/setup/google-drive — Redirect to Google OAuth to get a refresh token (one-time setup for personal Drive)
export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
    "http://localhost:3000/api/setup/google-drive/callback";

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error:
          "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first. Create an OAuth 2.0 Client ID (Web application) in Google Cloud Console, and add redirect URI: " +
          redirectUri,
      },
      { status: 400 }
    );
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [DRIVE_SCOPE],
  });

  return NextResponse.redirect(url);
}
