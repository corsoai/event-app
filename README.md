# Corsvent

An all-in-one, mobile-first **event management platform for Nigeria**, live at
[`event.corso.ng`](https://event.corso.ng). **The guest list is the gate list**: organizers build a
guest list, each guest gets a QR + 6-digit pass (via WhatsApp or a public RSVP link), gate staff
scan people in on ordinary phones, and organizers watch arrivals live and export attendance.

Forked from an estate-security platform, Corsvent inherits real gate discipline: per-scan audit
logs, duplicate detection, offline-tolerant check-in, SOS, and VIP vehicle handling with camera
plate scanning (ANPR).

> Engineers/agents: read **`AGENTS.md`** first, then the files in **`docs/`** (especially
> **`docs/feature-status.md`** for what actually works today).

## What it does / major features
- **Events**: create, edit, list (draft/live/ended).
- **Guests & passes**: add manually, paste from Excel, or upload CSV; unique 6-digit code + QR pass;
  download a shareable invitation image; share by WhatsApp.
- **Public RSVP**: per-event link `/e/<eventId>` for guest self-registration.
- **Gate check-in**: scan QR (BarcodeDetector on Android, jsqr on iPhone) or type the code; live
  counters; duplicate detection; offline queue; find-guest-by-name.
- **VIP Parking**: register plates; log arrivals by typing or **scanning the plate** (cloud ANPR +
  on-device OCR fallback).
- **Reports**: attendance summary + CSV export. **Roles**: Super Admin / Organizer / Gate Staff.
- Per-workspace module toggles, Light/Dark, PWA.

See `docs/feature-status.md` for the honest, verified status of each (Complete / Partial / UI only /
Mocked / Broken / Planned / Deprecated).

## Tech stack
Next.js 15 (App Router), React 19, TypeScript 5.7, Tailwind 3.4; self-hosted Appwrite (Auth +
TablesDB) reached only via server-side API routes; Resend email; `qrcode`/`jsqr`/`tesseract.js`;
manual PWA; deployed on Vercel.

## Local installation
```bash
npm install
npm run dev
```

## Required environment-variable NAMES (set real values in Vercel / a local .env; never commit them)
Appwrite: `NEXT_PUBLIC_APPWRITE_PROJECT_ID`, `NEXT_PUBLIC_APPWRITE_PROJECT_NAME`,
`NEXT_PUBLIC_APPWRITE_ENDPOINT`, `APPWRITE_ENDPOINT`, `APPWRITE_DATABASE_ID`,
`CORSO_APPWRITE_API_KEY` (server-only). Email: `RESEND_API_KEY`, `CORSO_EMAIL_FROM`. Optional plate
ANPR: `PLATE_RECOGNIZER_TOKEN`. App: `NEXT_PUBLIC_APP_URL`. `.env.example` is an inherited template
that still shows the OLD estate product's values - do not use them, and never point env at
`lbsview-estate` / `lbsview_estate`.

## Appwrite setup
Corsvent uses its own dedicated Appwrite project + database on the self-hosted server
(console.api.corso.ng). Tables auto-provision on first use via `ensureAppwriteTablesExist`. See
`docs/appwrite-schema.md` and `docs/deployment.md`.

## How to run locally
`npm run dev`, then open the printed localhost URL. Camera QR/plate scanning requires HTTPS, so test
scanning on the deployed site.

## How to test
There is **no automated test suite wired** (no `test` npm script). Three legacy estate-era smoke
scripts exist under `tests/` (run with `node tests/<name>.mjs`) but are not event tests. Current
verification is manual on the live site. Release gate before pushing:
```bash
node node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit   # must print nothing
npm run lint
npm run build
```

## How deployment works
Push `main` on GitHub -> Vercel auto-builds and deploys. A red build never replaces the live site.
Env vars live in Vercel. Detail: `docs/deployment.md`.

## Current implementation status
A working MVP (events, passes, gate check-in, RSVP, VIP parking, reports) with a large roadmap and
some inherited estate leftovers still being converted. Authoritative status: `docs/feature-status.md`.

## Detailed documents
- `AGENTS.md` - full agent/engineer onboarding brief
- `docs/architecture.md`, `docs/appwrite-schema.md`, `docs/authentication-and-roles.md`
- `docs/feature-status.md` - evidence-based status of every feature (start here)
- `docs/deployment.md`, `docs/known-issues.md`, `docs/development-history.md`
- `EVENT-APP-HANDOFF.md` (session history + architecture rules), `docs/CORSVENT-SCOPE.md` (scope +
  roadmap + vision), `CLAUDE.md` (working rules)

(c) 2026 Corsvent. Lagos, Nigeria.
