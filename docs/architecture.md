# Architecture

*Based on the repository at git `77dcf5c` (Session 16). Unverified items are labeled.*

## Overview
Corsvent is a Next.js 15 App Router application (React 19, TypeScript, Tailwind) deployed on Vercel,
backed by a self-hosted Appwrite (Auth + TablesDB) instance reached only through server-side API
routes. It is a PWA (manual manifest + service worker).

## Request/data flow (rule 6A - proxy only)
```
Browser (components/**)  ->  lib/appwrite/browser-data.ts (fetch wrappers)
                         ->  app/api/**/route.ts (Next route handlers)
                         ->  lib/appwrite/server.ts (REST helpers, server API key)
                         ->  Appwrite TablesDB / Auth (https endpoint)
```
The browser NEVER imports an Appwrite SDK or talks to Appwrite directly. Every read/write goes
through an API route. Client wrappers in `browser-data.ts` are the only fetch layer the UI uses.

## Security model
- **Identity (rule 6C):** secure routes call `resolveSessionContext(request, { allowedRoles })`.
  The acting user (e.g. `checkedInBy`, `scannedBy`, `loggedBy`, `createdBy`) is taken from the
  session `profileId`, never from the request body. Model new routes on
  `app/api/appwrite/security/patrols/route.ts` and the event routes.
- **Isolation:** `scopeForContext(context)` returns all-workspaces for super_admin, else
  `{ estateId: context.estateId }`. Guests/checkins/vip_plates are additionally keyed by `eventId`.
  KNOWN DEBT: fallback to `APPWRITE_LBSVIEW_ESTATE_ID = "lbsview-estate"` when a session lacks
  `estateId` (see known-issues.md).
- **Route gating:** `middleware.ts` protects `/admin`, `/super-admin`, `/cso`, `/resident`,
  `/security` by the `corso_role` cookie and redirects to `/login` or the role home.

## Offline (rule 6B)
`lib/gate-offline.ts` implements a localStorage queue (`corsvent_pending_checkins`) that flushes on
`online`/`visibilitychange`/mount and batch-POSTs to the check-in route. No IndexedDB/new libraries.

## Provisioning
Tables auto-create on first use via `ensureAppwriteTablesExist([...])` in `server.ts` (targeted +
memoized; replaced the full-sweep that timed out on serverless cold starts - Session 10). Schema is
declared in `lib/appwrite/schema.ts` (Appwrite 1.9 rule: never `default` + `required:true`).

## Key modules
- `lib/appwrite/server.ts` - REST helpers (`appwriteInsertRow`, `appwriteUpsertRow`,
  `listAppwriteTableRows`, `ensureAppwriteTablesExist`, `safeAppwriteId`, `AppwriteRestError`),
  `APPWRITE_LBSVIEW_ESTATE_ID`.
- `lib/appwrite/session-context.ts` - `resolveSessionContext`, `SessionContextError`.
- `lib/appwrite/events.ts` - event/guest/check-in/RSVP logic + role guards + scoping.
- `lib/appwrite/vip-parking.ts` - VIP plate register/arrival.
- `lib/appwrite/browser-data.ts` - client fetch wrappers.
- `lib/email/resend.ts` - branded email (used by user provisioning, not by event flows yet).
- `components/dashboard/pages.tsx` - large shared-screens file; exports `PageHeader`, `QRCodeImage`,
  `PlateScannerPanel`, admin/super-admin screens. Edit surgically.
- `components/events/*` - the event product screens.

## Frontend structure
Screens compose `components/ui` primitives (Button, Card, Field/Input/Select/Textarea, StatCard,
StatusBadge) inside `components/layout` AppShell + nav (`nav.ts`, `MobileBottomNav`). Theme toggle
drives Tailwind dark mode via `[data-theme="dark"]`; layouts are ~380px mobile-first.

## PWA
`public/sw.js` caches an app shell keyed by `CACHE_NAME` (bump on every user-facing change; phones
cache hard - close/reopen twice to refresh). `public/manifest.json` + icons under `public/`.
