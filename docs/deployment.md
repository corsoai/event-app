# Deployment

*Based on repo config at git `77dcf5c`. Secrets are never shown here.*

## Hosting
- **Frontend/app:** Vercel. Pushing `main` on GitHub auto-builds and deploys to
  `https://event.corso.ng`. A failed (red) build never replaces the live site - use it as the
  safety gate.
- **Backend:** self-hosted Appwrite (Auth + TablesDB), console at console.api.corso.ng. Corsvent
  uses its OWN project + database (never `lbsview-estate`/`lbsview_estate`).
- **Email:** Resend (`lib/email/resend.ts`).

## Build
- `npm run build` runs `node scripts/print-build-env.mjs && next build`.
- Full verify: `npm run verify` (= `next build && tsc -p tsconfig.typecheck.json --noEmit`).
- Release gate before pushing: `node node_modules/typescript/bin/tsc -p tsconfig.typecheck.json
  --noEmit` (must print nothing), then `npm run lint`.

## Environment variables (set in Vercel; NAMES only - never commit values)
Appwrite: `NEXT_PUBLIC_APPWRITE_PROJECT_ID`, `NEXT_PUBLIC_APPWRITE_PROJECT_NAME`,
`NEXT_PUBLIC_APPWRITE_ENDPOINT`, `APPWRITE_ENDPOINT`, `APPWRITE_DATABASE_ID`,
`CORSO_APPWRITE_API_KEY` (server-only; Appwrite reserves `APPWRITE_*` injected names, hence the
neutral key name). Email: `RESEND_API_KEY`, `CORSO_EMAIL_FROM`. Optional ANPR:
`PLATE_RECOGNIZER_TOKEN` (unset => on-device OCR). App: `NEXT_PUBLIC_APP_URL`,
`NEXT_PUBLIC_ESTATE_APP_URL`, `NEXT_PUBLIC_ENABLE_LOCAL_DEMO`. Legacy/unused: `MONNIFY_*`,
`*_SUPABASE_*`. `.env.example` is the inherited template and shows the OLD product's values - do not
use them.

## PWA / cache
`public/sw.js` caches an app shell keyed by `CACHE_NAME`. **Bump `CACHE_NAME` on every user-facing
release** or phones serve stale assets (close/reopen the PWA twice to refresh). Current value at
this writing: `corsvent-v2026-07-22-vipscan-1`.

## Data provisioning
Event tables auto-provision on first API call via `ensureAppwriteTablesExist`. No manual migration
step; the first events/guests/checkin/VIP call after a fresh deploy creates any missing table.

## Release procedure (human runs git; agents never push)
1. Typecheck green. 2. `git add <exact files>` (never `-A`). 3. `git commit -m "..."`. 4. Confirm
"N files changed" matches expectation. 5. `git push origin main`. 6. Watch Vercel to green.
7. Hard-refresh / reopen PWA to pick up the new `CACHE_NAME`.
