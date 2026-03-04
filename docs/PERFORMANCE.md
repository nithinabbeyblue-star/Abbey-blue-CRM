# Abbey CRM — Performance Guide

## When the site gets slow again (without losing data)

**Never do these if you need to keep your data:**

- Do **not** run `prisma migrate reset` on a database that has data you care about (it drops all tables and deletes all data).
- Do **not** run `prisma db push --force-reset` (or accept a prompt that says it will reset the database).

**Safe things to do when the site is slow:**

1. **Add database indexes (safe)**  
   Add new `@@index([...])` in `prisma/schema.prisma` for columns you filter or search on. Then create and apply a **new migration** (does not wipe data):
   ```bash
   pnpm exec prisma migrate dev --name add_indexes_for_xyz
   ```
   This only adds indexes; it does not drop tables or delete rows.

2. **Turn on or tune Redis**  
   If `REDIS_URL` is set, analytics and revenue are cached. Reduce repeated DB load by keeping Redis on and, if needed, increasing TTLs in the analytics routes.

3. **Check slow queries**  
   Use your DB provider’s metrics (e.g. Neon dashboard) or add short `console.time` / `console.timeEnd` in API routes to see which endpoints are slow, then add indexes or `select` only the fields you need.

4. **Scale the database**  
   With Neon/Vercel Postgres, you can scale the plan or add read replicas. No data loss; just more capacity.

5. **Back up before any schema change**  
   Before running **any** migration or `db push` on a DB with precious data, take a backup (Neon: Branch or backup feature; or `pg_dump`). Then if something goes wrong, you can restore.

6. **Use migrations instead of only `db push`**  
   For a production or important DB, use **migrations** so every change is a new migration file. That way you never rely on a single “push” that might prompt for reset. Create the first migration from current schema, then always use `prisma migrate dev` (locally) and `prisma migrate deploy` (e.g. on deploy).

---

## Quick Wins Implemented

### 1. Database (Indexes & Payload)

- **Indexes added** (Prisma schema) on `Ticket`: `clientName`, `clientEmail`, `clientPhone` for global search and filters. `refNumber` is already unique (indexed). Apply with:
  ```bash
  pnpm exec prisma migrate dev --name add_search_indexes
  ```
- **Payload reduction**: List endpoints (`GET /api/tickets`, `GET /api/my-cases`) now use `select` to return only fields needed for the table (id, refNumber, clientName, status, createdBy, assignedTo, etc.), reducing JSON size.

### 2. Middleware

- **Matcher** excludes static assets so middleware does not run on every request. Excluded: `_next/static`, `_next/image`, `_next/webpack-hmr`, `favicon.ico`, `sw.js`, `manifest.json`, and file extensions: `.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.ico`, `.css`, `.js`, `.woff2`, `.woff`, `.ttf`, `.eot`.

### 3. Frontend (Suspense & Skeletons)

- **Super Admin dashboard**: Stats cards and “Cases by Status” / “Recent Activity” are loaded inside a `<Suspense>` boundary with a skeleton fallback (`DashboardSkeleton`). The shell (header, nav) renders immediately; heavy aggregations stream in so the page is not blocked.

### 4. Caching (Redis & Invalidation)

- **Analytics** use Redis when `REDIS_URL` is set:
  - `analytics:overview` — TTL **300s** (5 min)
  - `analytics:revenue:{period}` — TTL **600s** (10 min)
  - `analytics:revenue:trends` — TTL **600s** (10 min)
- **Invalidation**: When a payment is created (`POST /api/tickets/[id]/payments`) or ticket financials are updated (ablFee, govFee, adverts, paidAmount), the following caches are cleared: `analytics:revenue:*`, `analytics:revenue:trends`, `analytics:overview`. No `revalidatePath` is used; cache is Redis-only for these endpoints.

---

## Measuring Before / After

### Vercel Analytics

- Enable **Vercel Analytics** in the project dashboard. Use **Web Vitals** (LCP, FID, CLS) and **Real Experience** to compare before vs after deployments.
- For API speed, use **Vercel Speed Insights** or **Logs** to inspect server response times for `/api/tickets`, `/api/analytics/revenue`, and Super Admin page.

### Chrome DevTools

1. **Network**: Throttle “Fast 3G”, reload Super Admin and ticket list. Compare:
   - Time to First Byte (TTFB) for the document and for `/api/tickets` (or my-cases).
   - Payload size of the tickets JSON (should be smaller after select-only changes).
2. **Performance**: Record a load of the Super Admin page. Check that the main thread is not long-blocked; Suspense should show skeleton first, then content.
3. **Lighthouse**: Run Performance audit on the dashboard and a tickets list page; compare scores and “Reduce payload size” / “Minimize main-thread work” suggestions.

### Server-side

- Add temporary `console.time('dashboard-stats')` / `console.timeEnd('dashboard-stats')` in `SuperAdminDashboardContent` (or the API routes) and compare before/after indexes and caching.

---

## Document / Visa Files (Lazy-Load & Thumbnails)

- **Current behaviour**: Document list shows file name, type, size, and a “Download” link (no inline PDF/image). No full-resolution assets are loaded in the list.
- **If you add previews later**:
  - Prefer **thumbnails** (e.g. small image or first page of PDF) instead of full PDFs in the list. Generate thumbnails on upload (server or background job) and store a `thumbnailUrl` (or use a service that returns a preview URL).
  - **Lazy-load**: Render only visible rows (e.g. virtual list or “Load more”) and load thumbnail URLs on demand; open full document in a new tab or modal on click.
  - For very large PDFs, consider **range requests** or a viewer that fetches pages incrementally.

---

## Longer-Term / Architecture

- **Heavy aggregations**: Move Super Admin dashboard stats (counts, revenue, trends) to a **background job** (e.g. cron or queue) that writes to a summary table or cache; the page then reads from that store for sub-100ms response times.
- **Edge**: Put auth/session and lightweight redirects in **Edge middleware**; keep DB-dependent logic in Node server/API routes.
- **Search at scale**: For large datasets, global search (`clientName`, `refNumber`, etc.) can use **PostgreSQL `pg_trgm`** (GIN index) for faster `ILIKE` queries, or move to **full-text search** / **Meilisearch**/Elasticsearch for better relevance and performance.
