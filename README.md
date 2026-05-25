# TakeUP

A peer-to-peer item rental marketplace built with Nuxt 4, tRPC, Prisma, and Supabase.

## Features

- **Item listings** — browse, search, and filter rentable items by category and condition
- **Booking & transactions** — full rental lifecycle from request to return
- **Wallet & rewards** — in-app wallet, platform commissions, and a points rewards system
- **Chat** — real-time messaging between renters and lenders
- **Reviews & disputes** — post-rental ratings and dispute resolution
- **Community feed** — social discovery of listings and activity
- **Admin panel** — platform oversight and moderation
- **Google OAuth** — authentication via Supabase + Google

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Nuxt 4 |
| API | tRPC v10 |
| ORM | Prisma 5 (PostgreSQL) |
| Auth & Storage | Supabase |
| Validation | Zod |
| Styling | Tailwind CSS |
| Package manager | pnpm |

## Project layout

```
app/                        # Nuxt frontend
  pages/                    # Routes (feed, items, dashboard, chat, admin, ...)
  components/               # Vue components
  composables/              # Shared composables
  layouts/                  # Page layouts
server/
  api/trpc/[trpc].ts        # tRPC HTTP handler entrypoint
  trpc/
    context.ts              # Per-request context (Prisma, session)
    middleware/auth.ts      # Auth guard for protected procedures
    routers/                # Feature routers (items, booking, wallet, chat, ...)
  utils/                    # Prisma client and server utilities
shared/schemas/             # Zod schemas shared by client and server
prisma/
  schema.prisma             # Database schema
  migrations/               # Migration history
  seed.mjs                  # Seed script
docs/                       # Project documentation
scripts/                    # One-off data migration scripts
```

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Required environment variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Prisma connection string (pooled) |
| `DIRECT_URL` | Direct database URL (for migrations) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `NUXT_PUBLIC_GOOGLE_CLIENT_ID` | Public Google client ID (can match above) |
| `JWT_SECRET` | Secret for signing JWTs |
| `NUXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NUXT_PUBLIC_SUPABASE_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `SUPABASE_JWT_SECRET` | Supabase JWT secret |
| `GEMINI_API_KEY` | Google Gemini API key (optional features) |

### 3. Set up the database

```bash
# Generate Prisma client
pnpm db:generate

# Apply migrations (production)
pnpm db:migrate

# Or push schema directly (development)
pnpm db:push

# Seed initial data
pnpm db:seed
```

### 4. Run dev server

```bash
pnpm dev
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build |
| `pnpm check` | Format, lint, typecheck, and test |
| `pnpm format` | Run Prettier and Prisma format |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run `nuxi typecheck` |
| `pnpm test` | Run Vitest |

## Git workflow

- Merges into `main` and `dev` are PR-only (see `docs/github-branch-rules.md`)
- CI runs lint, typecheck, and tests on every PR
- Run `pnpm check` before pushing to catch issues locally

## Docs

- `docs/auth-google-contract.md` — Google OAuth request/response contract
- `docs/github-branch-rules.md` — Branch protection and PR rules
- `docs/rewards-system-notes.md` — Rewards points design notes
- `docs/qa-smoke-checklist.md` — Manual QA checklist
- `docs/vercel-deployment-security.md` — Deployment security notes
- `docs/neovim.md` — Neovim editor config reference
