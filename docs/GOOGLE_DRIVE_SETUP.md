# Google Drive setup (chat & document uploads)

You can use either **your personal Gmail Drive** (OAuth) or a **Shared Drive** (service account).

---

## Option A: Personal Gmail Drive (recommended for personal/small use)

Uses your own Google account. Files go to a folder in "My Drive". No Google Workspace required.

### 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and select your project (or create one).
2. Enable the **Google Drive API**: APIs & Services → Library → search "Google Drive API" → Enable.
3. Create OAuth credentials:
   - **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - If asked, configure the **OAuth consent screen**: User type "External", add your email as test user.
   - Application type: **Web application**.
   - Name: e.g. "Abbey CRM".
   - **Authorized redirect URIs**: add  
     `http://localhost:3000/api/setup/google-drive/callback`  
     (for production, add your real URL, e.g. `https://yourdomain.com/api/setup/google-drive/callback`).
   - Create. Copy the **Client ID** and **Client secret**.

### 2. .env

Add (use your own values):

```env
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_DRIVE_FOLDER_ID="your-folder-id"
```

Do **not** set `GOOGLE_CLIENT_EMAIL` or `GOOGLE_PRIVATE_KEY` when using this option (or comment them out).

### 3. Get the refresh token (one-time)

1. Start the app: `pnpm dev`
2. In the browser open: **http://localhost:3000/api/setup/google-drive**
3. Sign in with your **personal Gmail** and allow access.
4. You’ll be shown a **refresh token**. Add it to `.env`:

```env
GOOGLE_REFRESH_TOKEN="the-long-token-you-copied"
```

5. Restart the app.

### 4. Folder ID

1. In Google Drive, create or open the folder where uploads should go.
2. Open that folder and copy the ID from the URL:  
   `https://drive.google.com/drive/folders/**THIS_PART_IS_THE_ID**`
3. Put it in `.env` as `GOOGLE_DRIVE_FOLDER_ID`.

---

## Option B: Shared Drive (service account)

For Google Workspace. Service accounts have no "My Drive"; they use a **Shared Drive**.

1. Create a **Shared Drive** in Google Drive and add your **service account email** (from the JSON key) as a member with **Content manager** or **Writer**.
2. In .env set: `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, and `GOOGLE_DRIVE_FOLDER_ID` (the Shared Drive root ID or a folder inside it).
3. Do **not** set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `GOOGLE_REFRESH_TOKEN`.

---

## Summary

| Use case              | Set in .env                                                                 | Get token / folder |
|-----------------------|-----------------------------------------------------------------------------|--------------------|
| Personal Gmail Drive  | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_DRIVE_FOLDER_ID`        | Visit `/api/setup/google-drive` → add `GOOGLE_REFRESH_TOKEN`; set folder ID from Drive URL |
| Shared Drive          | `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_DRIVE_FOLDER_ID`        | Folder = Shared Drive root or subfolder ID from URL |

If both OAuth and service account vars are set, the app uses **OAuth** (personal Drive).
