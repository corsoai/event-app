# Corsvent - Agent Onboarding (AGENTS.md)

Authoritative brief for any coding agent (Codex, Claude, etc.) working on Corsvent. Read this
first, then the focused docs in `docs/` (see section 20). Every statement here is based on the
actual repository as of git `77dcf5c` (Session 16). Where something is unverified it is labeled.

## 1. What Corsvent is (business purpose)
An all-in-one, mobile-first **event management platform for Nigeria**. Business promise: *the guest
list is the gate list.* Organizers build a guest list; each guest gets a QR + 6-digit pass (via
WhatsApp or a public RSVP link); gate staff scan people in on ordinary phones; organizers watch
arrivals live and export attendance. It monetizes via event organizers (weddings/owambe, corporate,
religious, government, academic). Differentiator vs generic tools (e.g. Zikoro): real gate
discipline inherited from an estate-security codebase - per-scan audit log, duplicate detection,
offline-tolerant check-in, SOS, and VIP vehicle handling with camera plate scanning (ANPR).

## 2. Live domain
`https://event.corso.ng` (a subdomain of corso.ng). A dedicated domain may come later; do not build
anything that assumes it. Session cookies are host-scoped, so no session bleed with corso.ng.

## 3. Technology stack and versions (from package.json)
Next.js `^15.1.0` (App Router) - React `^19.0.0` - TypeScript `^5.7.2` - Tailwind `^3.4.17`.
Runtime libs: `qrcode ^1.5.4` (pass QR + invite image), `jsqr ^1.4.0` (iPhone QR decode),
`tesseract.js ^7.0.0` (on-device plate OCR), `lucide-react ^0.468.0`, `clsx ^2.1.1`. Dev: eslint 9
+ eslint-config-next, postcss/autoprefixer, typescript. Backend: self-hosted **Appwrite** (Auth +
TablesDB) via REST. Email: **Resend**. PWA: manual `public/manifest.json` + `public/sw.js`. Note
`package.json` "name" is still the legacy `corso-estate`.

## 4. Repository structure
```
app/                      App Router: pages + app/api/** route handlers (the only server surface)
components/dashboard/pages.tsx   ~10k-line shared-screens file (legacy + live mixed; edit surgically)
components/events/         Event product screens (ADD NEW SCREENS HERE)
components/ui/, layout/, auth/   Primitives, AppShell/nav, auth card
lib/appwrite/             server.ts (REST helpers), schema.ts, session-context.ts, events.ts,
                          vip-parking.ts, users.ts, browser-data.ts (client fetch wrappers) + legacy
lib/email/resend.ts       Branded email sender
lib/gate-offline.ts       Offline check-in localStorage queue
middleware.ts             Role gate for /admin /super-admin /cso /resident /security
public/sw.js              Service worker (bump CACHE_NAME on user-facing change)
docs/                     Detailed docs (architecture, schema, roles, feature-status, deployment, ...)
tests/                    3 legacy .mjs smoke scripts (NOT wired to an npm test script)
```
Details: `docs/architecture.md`.

## 5. Appwrite architecture
One dedicated Appwrite **project + database** for Corsvent on a shared self-hosted server (console
at console.api.corso.ng). Access is REST-only from `lib/appwrite/server.ts` using a server API key.
`appwriteUpsertRow` (GET->PATCH/POST) is safe for partial updates; `ensureAppwriteTablesExist([...])`
provisions only the named tables (targeted + memoized - avoids the full-sweep cold-start timeout
fixed in Session 10). Tables auto-provision on first use. Full detail: `docs/appwrite-schema.md`.

## 6. Authentication and session flow
Login by phone OR email (phone maps to `phone.<digits>@corso.local`). `app/api/appwrite/auth/login`
sets `corso_role` / `corso_appwrite_user` / `corso_appwrite_session` cookies (host-scoped).
`middleware.ts` redirects unauthenticated users to `/login` and wrong-role users to their role home.
API routes resolve identity with `resolveSessionContext(request, { allowedRoles })`. Passwords are
hashed in Appwrite - unrecoverable, only resettable (new temp password). Full: `docs/authentication-and-roles.md`.

## 7. Roles and authorization rules
`lib/auth.ts roleLabels`: `super_admin`->"Super Admin", `estate_admin`->**"Organizer"**,
`security_guard`->**"Gate Staff"**, plus legacy `cso`, `resident`, `vendor`. Route homes:
super_admin `/super-admin`, estate_admin `/admin`, security_guard `/security`. Every event write
route enforces roles server-side (`requireOrganizer` / `requireGateStaff` in `events.ts`).

## 8. Organization and event isolation rules
A tenant workspace is internally an **estate** (`estateId`); in the UI it is the **organizer
workspace**. Data is scoped by `scopeForContext(context)`: super_admin -> all workspaces; otherwise
`{ estateId: context.estateId }`. Guests/checkins/plates are further keyed by `eventId`. IMPORTANT
DEBT: `scopeForContext` falls back to the constant `APPWRITE_LBSVIEW_ESTATE_ID = "lbsview-estate"`
when a session has no `estateId` (`lib/appwrite/server.ts:9`, used in `events.ts`/`vip-parking.ts`).
That is the OTHER product's id; a session missing `estateId` could read/write a shared fallback
workspace. See `docs/known-issues.md`.

## 9. Database tables and relationships
Event tables (`lib/appwrite/schema.ts`, auto-provisioned): **events**(name, venue, address, startAt,
endAt, gates, status, createdBy; estateId set on write), **guests**(eventId, fullName, phone, email,
category, code, status, checkedInAt, checkedInGate, checkedInBy), **checkins**(eventId, guestId,
guestName, category, code, gate, scannedBy, scannedAt, capturedAt, result), **vip_plates**(eventId,
plate, label, status, arrivedAt, arrivedGate, loggedBy). guests/checkins/vip_plates reference an
event by `eventId`; check-in identity fields come from the session. Inherited estate tables also
exist. Full column list + relationships: `docs/appwrite-schema.md`.

## 10. Important server helpers (`lib/appwrite/server.ts`)
`appwriteInsertRow`, `appwriteUpsertRow`, `listAppwriteTableRows` (scoped), `ensureAppwriteTablesExist`,
`ensureAppwriteSchemaReady`, `safeAppwriteId`, `AppwriteRestError`; `resolveSessionContext` /
`SessionContextError` (`session-context.ts`). Event/plate logic: `events.ts`
(`createAppwriteEvent`, `listAppwriteEvents`, `updateAppwriteEventDetails`,
`checkInAppwriteGuestByCode`, `publicRsvpAppwriteGuest`, `listAppwriteEventCheckins`),
`vip-parking.ts`. Client-side fetch wrappers live in `browser-data.ts` (never call Appwrite from the
browser directly).

## 11. QR generation and scanning architecture
Generation: `QRCodeImage` (exported from `pages.tsx`) and the invite image both use `qrcode`
(`QRCode.toDataURL`) encoding the guest's 6-digit code. Scanning (`components/events/checkin-page.tsx`):
native `BarcodeDetector` on Chrome/Android; **jsqr** canvas fallback on iPhone/Safari; typing the
code always works. Plate scanning (`PlateScannerPanel` in pages.tsx, used by the VIP gate): camera +
guide box -> cloud ANPR (`/api/appwrite/security/plate-recognize` -> Plate Recognizer) when
`PLATE_RECOGNIZER_TOKEN` is set, else on-device **tesseract.js** OCR.

## 12. Payment and webhook architecture
CURRENT STATE: no working payment flow for events. **Paystack is advertised on the landing page but
NOT implemented** (no route/integration) - treat as Planned. Inherited **Monnify** routes exist
(`app/api/monnify/{initiate,confirm,virtual-accounts}`, `app/api/webhooks/monnify`) from the estate
fork - Deprecated for Corsvent; do NOT wire events to them. Do not start Paystack until the human
says an account exists. Detail: `docs/feature-status.md`.

## 13. Environment-variable names (NAMES ONLY - never print or commit values)
Appwrite: `NEXT_PUBLIC_APPWRITE_PROJECT_ID`, `NEXT_PUBLIC_APPWRITE_PROJECT_NAME`,
`NEXT_PUBLIC_APPWRITE_ENDPOINT`, `APPWRITE_ENDPOINT`, `APPWRITE_DATABASE_ID`, `CORSO_APPWRITE_API_KEY`
(server-only). Email: `RESEND_API_KEY`, `CORSO_EMAIL_FROM`. Optional ANPR: `PLATE_RECOGNIZER_TOKEN`.
App: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ESTATE_APP_URL`, `NEXT_PUBLIC_ENABLE_LOCAL_DEMO`. LEGACY /
unused for Corsvent (from the fork - ignore, do NOT point them at production): `MONNIFY_*`,
`*_SUPABASE_*`, and the `lbsview-*` defaults in `.env.example`. Real values live only in Vercel;
`.env.example` still shows the OLD estate product's values and must not be trusted.

## 14. Vercel deployment structure
Hosted on Vercel; pushing `main` on GitHub auto-deploys. A failed build never replaces the live
site (use it as the safety gate). All env vars are set in Vercel project settings (Production +
Preview). `scripts/print-build-env.mjs` runs before `next build`. Detail: `docs/deployment.md`.

## 15. Commands (a new agent should run these)
- Install: `npm install`
- Dev: `npm run dev`
- Lint: `npm run lint`  (next lint)
- Typecheck (RELEASE GATE): `node node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit`
  (equivalently `npm run typecheck`) - must print nothing / exit 0.
- Build: `npm run build`  ;  full verify: `npm run verify` (build + typecheck)
- Tests: there is **no `test` npm script**. Only 3 legacy estate-era smoke scripts exist
  (`node tests/account-approval-smoke.mjs`, `tests/local-demo-smoke.mjs`,
  `tests/visitor-window-smoke.mjs`); they are not event tests and may need env/a running server.
  Assume NO automated test coverage for event features.

## 16. Files/modules that must not be modified casually
`components/auth/auth-card.tsx` (submit/login flow), `lib/appwrite/users.ts` (login mechanics),
`lib/appwrite/session-context.ts` - auth; behavior must not change. `lib/appwrite/schema.ts` - never
pair `default` with `required: true` (Appwrite 1.9). `lib/appwrite/server.ts` REST helpers - shared
by everything. `public/sw.js` - only bump `CACHE_NAME`. `components/dashboard/pages.tsx` - ~10k
lines, shared state; edit surgically, prefer new files in `components/events/`. `middleware.ts` -
role gating.

## 17. Known technical debt (see docs/known-issues.md for the full list)
- `lbsview-estate` isolation fallback in `scopeForContext` (section 8).
- No automated test suite; most event features not click-tested end to end.
- Organizer workspace-detail screen (`/super-admin/estates/[id]`) still renders estate tiles
  (Residents/Visitors/Bills/Complaints) + a resident directory from dead data.
- Large `pages.tsx` still holds legacy dead code and orphaned helpers.
- Landing page advertises features not built (Paystack, some comms).
- `.env.example`, `package.json` name, and various scripts still say Corso/lbsview.
- Repo mixes LF (recently touched files) and CRLF; pages.tsx has a harmless brace off-by-one in a
  string literal.

## 18. Feature completeness (summary; authoritative detail in docs/feature-status.md)
Real-data + authz-enforced and manually observed working: auth/login, event create+list, guest add,
QR pass + WhatsApp share, gate check-in by code. Implemented but NOT verified end-to-end (treat as
Partial): event edit, paste/CSV import, guest search, downloadable invite, public RSVP, QR camera
scan, duplicate/gate-log, offline queue, VIP parking + plate scan, reports/CSV, settings toggles.
Planned/not built: event email passes+reminders, Paystack, richer public event page, real
cross-platform metrics. Deprecated (inherited, nav-hidden): resident/CSO portals, billing/Monnify,
complaints, facilities, household, knowledge-base, visitor logs, digital IDs.

## 19. Git and deployment rules
The human runs git and pushes; agents never push. Stage EXACT files (never `git add -A` - CRLF
noise). Tell the human the exact file list and the expected "N files changed" count. Typecheck must
be green before a push. One logical change per commit where practical. Vercel builds `main`.

## 20. Definition of done (per development batch)
1) UI exists and matches ~380px mobile-first, works in Light AND Dark. 2) API/server action exists
under `app/api/**` and uses `lib/appwrite/server.ts` (rule 6A). 3) Reads/writes REAL Appwrite data
(no demo fallback for the new path). 4) Authorization via `resolveSessionContext` + workspace/event
isolation enforced (identity from session, never body - rule 6C). 5) Error + loading states present.
6) Typecheck exit 0; byte-verify edited files (NUL scan + brace balance). 7) `CACHE_NAME` bumped if
user-facing. 8) Manually verified on the live site where possible. 9) Exact-file commit with stated
count; append a short note to `EVENT-APP-HANDOFF.md`. Absent automated tests, step 8 is the primary
verification - state clearly what was and was not verified.

## 21. Docs index
`docs/architecture.md`, `docs/appwrite-schema.md`, `docs/authentication-and-roles.md`,
`docs/feature-status.md` (the most important - evidence-based status of every feature),
`docs/deployment.md`, `docs/known-issues.md`, `docs/development-history.md`. Plus root
`EVENT-APP-HANDOFF.md` (session history + rules), `docs/CORSVENT-SCOPE.md` (scope + roadmap + vision),
`CLAUDE.md` (working rules).
