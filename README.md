# Nuxt 4 + tRPC + Prisma + Supabase Pro

This repo is scaffolded for a student scrum team workflow:

- PR-only merges into `main` and `dev` (see `docs/github-branch-rules.md`)
- CI checks for lint, typecheck, and tests
- Shared Zod schemas between client and server
- tRPC router/context/middleware separation

## Project layout

- `app/`: Nuxt app (pages, components, layouts)
- `server/api/trpc/[trpc].ts`: tRPC handler entrypoint
- `server/trpc/`: tRPC init, context, middleware, procedures, routers
- `server/utils/`: Prisma client and other server utilities
- `shared/schemas/`: Zod schemas shared by client and server
- `prisma/`: Prisma schema and migrations

## Key files

- `server/trpc/context.ts`: per-request context (Prisma, authenticated user/session)
- `server/trpc/middleware/auth.ts`: auth guard for protected procedures
- `server/trpc/routers/`: feature routers; combine in `server/trpc/routers/index.ts`
- `shared/schemas/`: Zod schemas for validation and shared types
- `docs/auth-google-contract.md`: `/api/auth/google` request/response/error contract

## Setup

1. Install dependencies

```
pnpm install
```

2. Configure environment

```
cp .env.example .env
```

Required auth env vars:

- `GOOGLE_CLIENT_ID`
- `NUXT_PUBLIC_GOOGLE_CLIENT_ID` (can match `GOOGLE_CLIENT_ID`)
- `JWT_SECRET`

3. Initialize Prisma

```
pnpm prisma generate
```

4. Run dev server

```
pnpm dev
```

## Formatting workflow

- Run `pnpm format` before pushing changes.
- Prisma schema formatting is included in `pnpm format` via `prisma format`.
- CI enforces formatting and will fail if files are not formatted.

## Editor integration

- VSCode settings live in `.vscode/`
- Neovim config reference: `docs/neovim.md`
