import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

// GET /api/setup/google-drive/callback — Exchange code for tokens and show refresh token to add to .env
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;"><h1>Google Drive setup</h1><p>Authorization failed: ${error}</p><p><a href="/api/setup/google-drive">Try again</a></p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  if (!code) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;"><h1>Google Drive setup</h1><p>No code received. <a href="/api/setup/google-drive">Start again</a>.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
    "http://localhost:3000/api/setup/google-drive/callback";

  if (!clientId || !clientSecret) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;"><h1>Google Drive setup</h1><p>GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const { tokens } = await oauth2.getToken(code);
  const refreshToken = tokens.refresh_token;

  if (!refreshToken) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;"><h1>Google Drive setup</h1><p>No refresh token was returned. Try again and make sure to accept all requested permissions. <a href="/api/setup/google-drive">Try again</a>.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // Escape so </ doesn't close the <pre> tag; keep token copy-pasteable
  const safeInPre = refreshToken.replace(/</g, "\u003c");
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Google Drive setup</title></head>
<body style="font-family:sans-serif;padding:2rem;max-width:640px;">
  <h1>Google Drive setup — success</h1>
  <p>Add this to your <strong>.env</strong> file (and remove or comment out <code>GOOGLE_CLIENT_EMAIL</code> and <code>GOOGLE_PRIVATE_KEY</code> if you were using a service account):</p>
  <pre style="background:#f4f4f4;padding:1rem;overflow:auto;word-break:break-all;">GOOGLE_REFRESH_TOKEN="${safeInPre.replace(/"/g, '\\"')}"</pre>
  <p>Also set <code>GOOGLE_DRIVE_FOLDER_ID</code> to a folder in your Google Drive (open the folder in Drive, copy the ID from the URL).</p>
  <p>Then restart your app. Chat attachments will upload to your personal Drive.</p>
  <p><a href="/">Back to app</a></p>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
