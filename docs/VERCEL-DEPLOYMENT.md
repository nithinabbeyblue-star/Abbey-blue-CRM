# Fix "Internal Server Error" on Vercel

## Step 1: Find the real error (do this first)

The message "Internal server error" is generic. You need to see the **actual** error from Vercel.

1. Go to **https://vercel.com** and open your project.
2. Click the **"Logs"** tab (or **"Deployments"** → open the latest deployment → **"Functions"** or **"Runtime Logs"**).
3. In the logs, leave the filter as **All** or select **Error**.
4. In another tab, open your site and do the action that fails (e.g. open the homepage or try to log in).
5. In Vercel Logs, new lines will appear. Look for a **red** line or a stack trace. The first line of the error (e.g. `Error: DATABASE_URL is not set` or `PrismaClientKnownRequestError`) is the cause.

Write down that error message. Then use the checklist below.

---

## Step 2: Required environment variables on Vercel

In your project: **Settings → Environment Variables**. Add these for **Production** (and **Preview** if you use it).

| Variable | Required | What to set |
|----------|----------|-------------|
| **DATABASE_URL** | Yes | Your Neon **pooled** connection string (same as in your .env). |
| **AUTH_SECRET** | Yes | Random secret. In PowerShell run: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` and paste the output. |

Optional (app works without them, but some features need them):

| Variable | Used for |
|----------|----------|
| NEXTAUTH_URL | Your app URL, e.g. `https://your-app.vercel.app` (Vercel often sets this automatically). |
| GOOGLE_DRIVE_FOLDER_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY | Document upload to Google Drive. Omit if you don’t need uploads. |
| REDIS_URL | Caching. Omit if you don’t use Redis. |
| PUSHER_*, NEXT_PUBLIC_PUSHER_* | Real-time features. Omit if not used. |

After adding or changing variables, **redeploy**: Deployments → ⋮ on latest → **Redeploy**.

---

## Step 3: Match the error to a fix

| If the log says… | Do this |
|------------------|--------|
| `DATABASE_URL is not set` | Add **DATABASE_URL** in Vercel (Neon pooled URL) and redeploy. |
| `AUTH_SECRET` or NextAuth secret error | Add **AUTH_SECRET** (Step 2) and redeploy. |
| `The column … does not exist` | Your production DB schema is old. Run `prisma db push` with the **production** DATABASE_URL (see docs/SYNC-PRODUCTION-DB.md). |
| `GOOGLE_DRIVE_FOLDER_ID is not set` | Either add the three Google Drive env vars in Vercel, or ignore if you don’t need document upload (the app should still run). |
| Prisma / connection / timeout | Use the **pooled** Neon URL (host contains `-pooler`). Check Neon dashboard for outages. |

---

## Step 4: Redeploy after changes

After changing env vars or fixing the DB:

1. **Deployments** → click **⋮** on the latest deployment.
2. Click **Redeploy** (you can choose “Redeploy without cache” if you want a clean build).
3. Wait until the deployment is **Ready**, then test again.
