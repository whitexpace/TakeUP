# Vercel Deployment Instructions

## 1. Create the Vercel project
- Import the GitHub repository into Vercel.
- Framework preset: `Nuxt.js`
- Production branch: `main`
- Package manager: `pnpm`
- Build command: `pnpm build`
- Output setting: let Nuxt/Vercel auto-detect

## 2. Add environment variables
Set these in Vercel for the correct environments:

### Production and Preview
- `NUXT_PUBLIC_SUPABASE_URL`
- `NUXT_PUBLIC_SUPABASE_KEY`
- `NUXT_PUBLIC_SUPABASE_ITEM_IMAGE_BUCKET`
- `NUXT_PUBLIC_GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_ID`
- `JWT_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

### Do not add to the web runtime unless you are intentionally running migrations there
- `DIRECT_URL`

Notes:
- `DATABASE_URL` should use the Supabase pooler/runtime-safe URL.
- `DIRECT_URL` should stay in trusted local or CI environments for Prisma migrations.
- Rotate `JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and database credentials before first public deploy if they were ever shared outside the hosting dashboard.

## 3. Configure Vercel protections in the dashboard
- Enable **Vercel Authentication** with **Standard Protection** for preview deployments.
- Keep production public.
- Enable the **AI bot** managed ruleset / bot blocking.
- Create one Hobby-plan WAF rate-limit rule:
  - Path pattern: `/api/*`
  - Methods: `POST,PATCH,DELETE`
  - Key: `IP + JA4`
  - Threshold: `30 requests per minute`
  - Action: block
- Keep **Attack Challenge Mode** ready for incident response. Enable it when traffic spikes unexpectedly.

## 4. Apply database changes safely
- Run Prisma migrations from a trusted environment, not from the public Vercel deployment:

```bash
pnpm exec prisma migrate deploy
```

- Use `DIRECT_URL` only in that trusted environment.
- Confirm Prisma Client in production uses `DATABASE_URL`, not `DIRECT_URL`.

## 5. Verify the deployed app
Run these checks after deploy:

```bash
curl -I https://<your-domain>/
curl https://<your-domain>/robots.txt
curl -I https://<your-domain>/api/items?limit=12
curl -I https://<your-domain>/api/requests
```

Expected:
- `robots.txt` disallows all crawlers
- page responses include:
  - `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy`
  - `Content-Security-Policy-Report-Only`
- public read endpoints return cache headers with `s-maxage` and `stale-while-revalidate`
- authenticated or mutation endpoints return `private, no-store`

## 6. Supabase hardening
- Tighten Storage policies on the image bucket:
  - authenticated users only
  - only allow uploads under the user-owned prefix
  - only allow expected image MIME types
  - enforce a hard file-size cap
- Confirm the service role key is never exposed in client bundles.
- Review database connection/network rules and keep pooled runtime connections for the deployed app.

## 7. Incident response
- If traffic spikes or bots start hammering the site:
  - turn on **Attack Challenge Mode**
  - inspect Vercel Firewall activity
  - inspect Supabase traffic and query load
  - temporarily tighten the WAF rule if needed
  - disable or further cache the hottest anonymous endpoint if a single route is the source
