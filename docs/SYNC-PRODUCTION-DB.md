# Sync production database with current schema

Your app expects columns (e.g. `status`, `sessionVersion`) that don't exist in the production DB yet. Follow these steps **once** to add them.

## Step 1: Get your production database URL

1. Go to [Neon Console](https://console.neon.tech) and open your project.
2. Copy the **Pooled connection** string (Connection details → Pooled connection).
3. It looks like: `postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`

(Use the **same** URL you set as `DATABASE_URL` in Vercel.)

## Step 2: Run schema sync from your PC

Open PowerShell in your project folder and run **one** of the following.

**Option A – Use the URL for this command only (recommended)**  
Replace `YOUR_PRODUCTION_DATABASE_URL` with the URL from Step 1 (in quotes).

```powershell
cd "C:\Users\Abbey Legal\Desktop\Claude CRM"
$env:DATABASE_URL="YOUR_PRODUCTION_DATABASE_URL"; pnpm exec prisma db push
```

**Option B – Use your .env for the URL**  
If your `.env` already has the **production** `DATABASE_URL` (same as Vercel), you can run:

```powershell
cd "C:\Users\Abbey Legal\Desktop\Claude CRM"
pnpm exec prisma db push
```

When Prisma asks to apply changes, type **y** and press Enter.

## Step 3: Confirm

- You should see: `Your database is now in sync with your Prisma schema.`
- Try logging in again on Vercel.

## Optional: Backup first (Neon)

In Neon: create a **Branch** of your project as a backup before running Step 2. Then if anything goes wrong, you can switch back.
