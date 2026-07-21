# Event Management Platform — Build Handoff

Instructions for the Claude model/agents building a standalone, all-in-one **event management
platform for Nigeria**, forked from the Corso estate-management codebase. Corso itself continues
separately — never push event-app changes to the Corso repo.

Working title: **GateList** (rename freely once Stanley picks a name/domain).

---

## 0. Who you are working with

Stanley is a novice acting as the bridge between you and the computer. Rules learned the hard way:

- Give him **paste-ready commands**, one block, in order. Explain like he has never used a terminal.
- **Never handle passwords, API keys, or account creation for him** — he types/pastes secrets himself.
- He runs git; you never push. Stage **exact files** (never `git add -A` — CRLF noise).
- Vercel auto-deploys `main`; a failed build never replaces the live site — use it as your safety gate.
- Mobile-first always. Test in Light AND Dark theme (the app has its own toggle: `darkMode: ["selector", '[data-theme="dark"]']`).
- Bump `CACHE_NAME` in `public/sw.js` on every user-facing release (PWA phones cache hard; close-reopen-twice ritual).

## 0.5 Install the Claude crew (first task of Phase 0)

The folder `event-app-claude-setup/` contains this project's Claude configuration. Install it:

- Move `event-app-claude-setup/CLAUDE.md` to the project root, REPLACING the Corso CLAUDE.md.
- Move `event-app-claude-setup/agents/*` to `.claude/agents/`.
- Move `event-app-claude-setup/skills/ship/` to `.claude/skills/ship/`.
- Delete the now-empty `event-app-claude-setup/` folder, and delete Corso's `AGENTS.md`/`CODEX.md`
  if present (they describe Corso's workflow, not this project's).

The crew: **release-verifier** (run before every release), **ui-reviewer** (run after building any
screen), and the **ship** skill (the whole release ritual — use it whenever Stanley says "ship").

## 1. Source and setup

The codebase is a fork of Corso (github.com/corsoai/lbsview-estate). To create the new project:

```
# Stanley runs, from AI BUILDER folder:
git clone https://github.com/corsoai/lbsview-estate.git EVENTAPP
cd EVENTAPP
git remote remove origin
# after creating an empty new GitHub repo (e.g. corsoai/eventapp):
git remote add origin https://github.com/corsoai/EVENTAPP-REPO-NAME.git
git checkout main && git push -u origin main
```

**Infrastructure (same self-hosted Appwrite server, strictly separated):**

- Appwrite endpoint: `https://api.corso.ng/v1` (console at console.api.corso.ng). Create a **NEW
  Appwrite project** (e.g. `eventng`) and a **NEW database** (e.g. `eventng_db`). Never reuse
  project `lbsview-estate` or database `lbsview_estate` — data isolation between the two products
  is non-negotiable.
- New server API key for that project → env var (keep the neutral name pattern; Appwrite reserves
  `APPWRITE_*` injected vars): `CORSO_APPWRITE_API_KEY` or rename consistently.
- New Vercel project + new GitHub repo + Stanley's chosen domain.
- Email: Resend works; either reuse the corso.ng verified domain short-term or verify the new
  domain (DNS on Cloudflare, records: DKIM TXT `resend._domainkey`, MX+SPF on `send`, `_dmarc`).
- Env vars to update: `NEXT_PUBLIC_APPWRITE_PROJECT_ID`, `NEXT_PUBLIC_APPWRITE_PROJECT_NAME`,
  `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `APPWRITE_ENDPOINT`, `APPWRITE_DATABASE_ID`, API key,
  `RESEND_API_KEY`, `CORSO_EMAIL_FROM`.

## 2. Codebase orientation

Next.js 15 App Router + TypeScript + Tailwind. Almost all screens live in one large file:
`components/dashboard/pages.tsx` (~12k lines) — edit carefully, verify with
`node node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit` before handing over.

Key infrastructure (KEEP all of it):

- `lib/appwrite/server.ts` — REST helpers for Appwrite TablesDB (`appwriteUpsertRow` does
  GET→PATCH/POST, safe for partial updates), `ensureAppwriteSchemaReady()` (cached schema check —
  call it in write routes).
- `lib/appwrite/schema.ts` — declarative tables/columns/indexes; schema auto-provisions.
- `lib/appwrite/session-context.ts` — session cookie → role/estate resolution for API routes.
- Auth flow (`components/auth/auth-card.tsx` + `lib/appwrite/users.ts`): login by phone OR email
  (phone maps to `phone.<digits>@corso.local` auth email), roles, temp passwords. **Do not break
  auth. Ever.** Style it, relabel it, but leave the mechanics alone.
- `lib/email/resend.ts` — sendCorsoEmail + branded HTML template (rename brand).
- `components/layout/` — AppShell (sidebar + mobile nav), nav configs, MobileBottomNav.
- Module toggles: `estates.disabledModules` column + `/api/appwrite/estate-modules` +
  `NavItem.module` filtering — reuse for per-organizer feature control.
- `public/sw.js` — PWA service worker.

**Concept mapping — do a RELABEL first, not a rename refactor.** Internally "estate" = the tenant
workspace. Keep `estateId` in code (rename later if ever); in the UI call it the **organizer
workspace**. Mapping:

| Corso concept | Events concept |
|---|---|
| Estate | Organizer workspace (an events company) |
| Resident | (mostly removed) |
| Visitor + code + QR | **Guest + pass** — the crown jewel, reuse heavily |
| Verify Visitor / scan | Gate check-in scanning |
| Entry logs | Attendance log |
| estate_admin | Organizer (admin) |
| security_guard | Usher / gate staff |
| Guard tour checkpoints | (optional: venue patrol for big events) |
| Plate capture | VIP parking (optional module) |
| SOS + siren (components/security/sos-alarm.tsx) | Event security alert |
| Announcements | Guest broadcasts |

## 3. What to REMOVE (Phase 0 strip)

Billing/service charge/accounting (`lib/appwrite/accounting.ts`, billing-engine, billing-import,
payment-allocation, bills/payments pages), residents/units/properties import machinery,
facilities/work orders, household, marketplace, knowledge base, CSO command centre (keep if useful
for large events), LBS View / Corso branding, demo-estate logins in auth-card
(`EXHIBITION_DEMO_LOGINS` — replace with the new product's demo or remove), landing page content
(rewrite for events; keep the Apple-light design system from `app/page.tsx`).

Strip = hide via module toggles + delete nav entries first; physically delete code once stable.

## 4. What to BUILD (the event features)

Phase 1 — core (MVP demoable to a real organizer):
- **Events table**: name, venue, address, start/end datetime, gates, status (draft/live/ended),
  organizer workspace id, cover image optional.
- **Guest list**: bulk import (paste or CSV upload → preview → confirm), fields name/phone/email/
  category (Regular/VIP/Staff), per-guest 6-digit code + QR (reuse visitor-code generator).
- **Pass delivery**: WhatsApp share per guest (wa.me pattern exists), email pass (Resend), print
  sheet of QR passes.
- **Check-in**: usher scans QR or types code (reuse verify-visitor flow), live counter
  "142 of 300 arrived", per-gate logs with times, duplicate-scan warning ("already checked in at
  2:14 pm"), offline-tolerant (queue + sync pattern exists in `lib/guard-tour.ts`).
- **Attendance report**: per event, exportable (CSV), no-shows list.

Phase 2 — money:
- **Ticketing**: free RSVP link per event (public page → collects name/phone → issues pass) and
  paid tiers via **Paystack** (best self-service onboarding in Nigeria; Monnify keys pattern exists
  in .env.example). Webhook confirms payment → issues pass automatically.

Phase 3 — comms & polish: bulk WhatsApp-share queue, SMS via BulkSMSNigeria
(`BULKSMS_NG_API_TOKEN`), reminder emails ("event is tomorrow"), post-event thank-you broadcast,
multi-day/multi-entry passes (valid-from/valid-until — mirrors Corso's planned multi-entry guest).

Phase 4 — growth: per-event public microsite (event page with RSVP), organizer analytics across
events, seating/tables, vendor & budget tracker, NDPR-compliant data retention (purge guest PII
N days after event, configurable).

### Nigerian market notes (reference competitor: zikoro.com)

Event categories to support explicitly (event "type" field + landing-page use cases): weddings
(incl. owambe/asoebi culture — large guest lists, gate control matters), burials/memorials,
corporate events & product launches, **government functions** (protocol lists, VIP/dignitary
categories, security tie-in is a differentiator — our SOS + plate capture + gate logs are strong
here), religious events (crusades, conventions — very large counts), academic events
(convocations, matriculations), concerts, conferences/workshops, birthdays/house parties.

Zikoro-inspired features worth queueing AFTER Phase 2 (do not start with these):
- **Credentials**: auto-generated certificates of attendance and digital badges (academic,
  workshops, corporate trainings) — pairs naturally with our check-in data ("attended = gets
  certificate"), delivered by email.
- **Engagements**: live polls, Q&A, quizzes during the event (conference/corporate market).
- **Bookings**: appointment scheduling — probably out of scope; note only.

Differentiators to lean on vs Zikoro: gate security DNA (guards, scanning discipline, plate
capture, SOS), WhatsApp-first pass delivery, offline-tolerant check-in for Nigerian venue
network reality, and protocol/VIP handling for gover
## 6. Architecture rules (Overseer-approved, added Session 8 — follow these)

**6A. Proxy everything via API routes.** The frontend never talks to Appwrite directly — no
Web SDK, ever. Every gate/organizer operation targets our own Next.js API routes, which use
the existing server-side REST helpers in `lib/appwrite/server.ts` with the protected server
key.

**6B. Offline caching = reuse the guard-tour queue pattern.** No Dexie, no IndexedDB, no new
libraries. When a gate scan can't reach the server, serialize it into a localStorage queue
exactly like `lib/guard-tour.ts` does for patrols (synced flag, amber "saved offline"
feedback, flush on `online`/`visibilitychange`), batch-POSTing to our own `/api/gate/...`
endpoints when connectivity returns. Handle duplicates on sync ("already checked in at
HH:MM").

**6C. Check-in route: follow the house pattern, not external blueprints.** Model the gate
check-in route on the existing `app/api/appwrite/security/patrols/route.ts` — it is the exact
shape needed: `resolveSessionContext(request, { allowedRoles })` for identity (the scannedBy
staff ID comes from the session, never from the request body — client-supplied identity is
spoofable), `ensureAppwriteSchemaReady()` before writes, workspace scoping from context,
writes via `appwriteInsertRow`/`appwriteUpsertRow` with `safeAppwriteId`, and the standard
errorResponse mapping (SessionContextError / AppwriteRestError). Do NOT use `node-appwrite`,
`createDocument`, `'unique()'`, or any `..._COLLECTION_ID` env vars — none of those exist in
this codebase. Record every check-in with `scannedBy` (session profileId), `gate` label if
present, and timestamp.

## 7. Progress notes (updated each session — read this first)

**Product name: Corsvent.** **Domain: `event.corso.ng`** (subdomain of corso.ng, live now). A
dedicated domain (Stanley mentioned `corsven.com`) may be registered later — not yet, don't
build anything that assumes it.

### Session 1 (2026-07-20) — 0.5 crew install + Phase 0 first pass

**0.5 done:** `CLAUDE.md` moved to project root, `release-verifier` + `ui-reviewer` moved to
`.claude/agents/`, `ship` skill moved to `.claude/skills/ship/`, `event-app-claude-setup/`
deleted. No old Corso `AGENTS.md`/`CODEX.md` existed to delete.

**IMPORTANT — file-write reliability issue found and worked around:** Edit/Write tool calls on
this mounted folder intermittently corrupted files this session — some were truncated mid-file
(silently missing their tail, e.g. `public/sw.js` and `app/layout.tsx` cut off mid-statement),
others got trailing NUL-byte padding when the new content was shorter than the old (e.g.
`components/layout/nav.ts`, `components/auth/auth-card.tsx`, `components/dashboard/pages.tsx`,
`public/manifest.json`). This was caught by verifying every touched file at the byte level
(NUL-byte scan + brace/paren balance vs. `git show HEAD:<file>`) — do NOT skip this step in
future sessions. All corrupted files were recovered by pulling the clean `git show HEAD:<file>`
version and reapplying the intended change via a direct Python file write (bypassing the
Edit/Write tool), then re-verified byte-for-byte. Every file was confirmed clean before this
note was written. **Next session: keep verifying every edited file at the byte level
(`tail -c 80 <file>`, NUL scan, brace balance) before trusting an Edit/Write result on this
project — don't assume tool success messages reflect what actually landed on disk.**

**Also could not run `node node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit`**
this session — this sandbox's network blocks the npm registry (`registry.npmjs.org` returns
403 blocked-by-allowlist), so `npm ci` cannot complete and `node_modules` isn't fully installed.
**Stanley needs to run the typecheck command himself** (paste-ready command given below) before
pushing, until this sandbox gets registry access or a session runs with node_modules already
present.

**Phase 0 changes made (verified, ready to push):**
- Removed `EXHIBITION_DEMO_LOGINS` and all related state/effects/UI from
  `components/auth/auth-card.tsx` (login mechanics untouched — only the demo-account shortcut
  buttons were removed, since those Corso demo accounts don't exist in Corsvent's own Appwrite
  project anyway). Deleted the now-orphaned `app/api/public/demo-status/route.ts`.
- Nav strip (`components/layout/nav.ts`): removed Bills, Payments (admin + resident), Facilities,
  Household, Marketplace, Knowledge Base (admin + resident) nav entries. Kept Residents,
  Complaints, Announcements, Digital IDs, Reports, System Status, Settings, SOS, Visitor
  Logs/Invite Visitor/Visitors (guest/pass crown jewel), CSO nav, security/guard nav as-is.
- Removed the now-orphaned facilities/marketplace/household/knowledge_base entries from
  `TOGGLABLE_MODULE_OPTIONS` in `components/dashboard/pages.tsx` (settings page module toggle
  list) — kept guard_tour, plate_capture, digital_ids.
- **Underlying code for stripped modules was NOT physically deleted** (per the "hide nav first,
  delete code once stable" rule) — `lib/appwrite/accounting.ts`, `facilities.ts`, `household.ts`,
  `knowledge-base.ts`, the `app/admin/bills`, `app/admin/payments`, `app/admin/facilities`,
  `app/resident/household`, `app/marketplace`, `app/*/knowledge-base` routes, and their
  components in `pages.tsx` (`BillsAdminPage`, `PaymentsAdminPage`, `AdminFacilitiesPage`,
  `HouseholdPage`, `MarketplacePage`, `KnowledgeBase*Page`) all still exist and are still
  reachable by direct URL. Physically delete in a later pass once confirmed nothing is needed.
- **Not yet stripped — flagged for next session:** the residents/units/properties **import**
  machinery specifically named in section 3 (`ResidentOnboardingPanel` at
  `components/dashboard/pages.tsx` ~line 2597 and `AppwriteOnboardingPanel` ~line 2787, both
  rendered inside `ResidentsAdminPage`). These are wired into local demo state
  (`addProperty`/`addUnit`) and shared `onboardingMessage` state inside a large shared component,
  so removing them cleanly needs a careful, dedicated read-through rather than a quick edit.
  Residents nav entry itself was deliberately kept (not explicitly listed as a strip target,
  and may still be useful as a guest-list placeholder until Phase 1 replaces it) — revisit this
  call once Phase 1 guest-list work starts.
- Rebrand pass (Corso → Corsvent) — done for all persistent/high-visibility UI: page
  metadata/title (`app/layout.tsx`), PWA manifests (`public/manifest.json`,
  `public/manifest.webmanifest`), sidebar + mobile topbar brand text and dashboard link title
  (`components/layout/app-shell.tsx`), the shared `PageHeader` eyebrow label used on every
  admin/security screen and the resident dashboard eyebrow (`components/dashboard/pages.tsx`),
  brand mark alt text (`components/layout/brand-mark.tsx`), email template brand/tagline/footer
  (`lib/email/resend.ts`, from-name now "Corsvent <notifications@corso.ng>").
  **Not yet done — a large remaining sweep, deliberately deferred to its own session:** ~50+
  more "Corso"/"LBS View Estate" strings scattered through `components/dashboard/pages.tsx`
  (default placeholder values like "LBS View Estate" in estate/unit/address fields, description
  copy on Super Admin/Estates/Onboarding/Reports pages, CSV/PDF export text in
  `components/admin/reports/*`, `app/admin/system/page.tsx` diagnostics copy,
  `components/landing/demo-request-form.tsx`). Many of these live inside the modules being
  stripped (billing, facilities) and aren't worth polishing before deletion; the rest need
  judgment calls (e.g. "LBS View Estate" as an input placeholder should become an
  event-appropriate placeholder, not just a name swap) — do this as a dedicated copy pass.
  **The landing page (`app/page.tsx`) was deliberately left untouched** — section 3 calls for a
  full content rewrite (headline, feature copy, event categories, CTAs) keeping the existing
  Apple-light design system, which deserves its own focused session rather than a rushed
  find-replace.
- Bumped `CACHE_NAME` in `public/sw.js` to `corsvent-v2026-07-20-phase0-strip-1` (user-facing
  release).
- Checked cookie/session domain scoping since `event.corso.ng` is a subdomain of `corso.ng`:
  `app/api/appwrite/auth/login/route.ts` sets `corso_role`/`corso_appwrite_user`/
  `corso_appwrite_session` cookies with no explicit `domain` attribute, so they default to
  host-only scope — no session bleed with Corso's main site. No code change needed; verified only.
- Logo/icon **image assets** (`public/brand/corso-icon.png`, `public/icons/corso-*.png`,
  favicons) still say Corso and are the old artwork — need real Corsvent artwork from Stanley
  before swapping; left as-is (functional placeholders) for now.

**Push ritual for this session's changes** (Stanley runs, from the EVENTAPP folder):

```
node node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit
```

If that prints nothing and exits clean, continue with:

```
git add CLAUDE.md .claude/agents/release-verifier.md .claude/agents/ui-reviewer.md .claude/skills/ship/SKILL.md event-app-claude-setup app/api/public/demo-status/route.ts app/layout.tsx components/auth/auth-card.tsx components/dashboard/pages.tsx components/layout/app-shell.tsx components/layout/brand-mark.tsx components/layout/nav.ts lib/email/resend.ts public/manifest.json public/manifest.webmanifest public/sw.js EVENT-APP-HANDOFF.md
git commit -m "Install Claude crew; Phase 0 first pass: strip billing/facilities/household/marketplace/knowledge-base nav, remove Corso demo logins, rebrand core UI to Corsvent"
git push origin main
```

**Next session should:**
1. Confirm the typecheck Stanley ran was clean (or fix whatever it flagged).
2. Finish the remaining Corso→Corsvent copy sweep in `pages.tsx` and the reports/system/landing
   files listed above.
3. Rewrite `app/page.tsx` (landing page) for events, keeping the Apple-light design system.
4. Decide + execute the residents/units/properties import-machinery removal
   (`ResidentOnboardingPanel` / `AppwriteOnboardingPanel`) as its own careful pass.
5. Start Phase 1 (Events table, guest list, pass delivery, check-in) once the strip/rebrand is
   stable and Stanley has pushed + smoke-tested on `event.corso.ng`.
### Session 1 continued — Appwrite verified, seed data fixed, infra issues found

**Appwrite connection confirmed working end-to-end** on `event.corso.ng` (`eventng` project /
`eventng_db`). Root cause of an initial "Invalid login details" error: a stale deploy (predated
the env vars) plus a pasted-twice `CORSO_APPWRITE_API_KEY` value with an embedded newline
breaking the Authorization header — both fixed with a clean re-paste + rebuild. First super-admin
user now exists in the live Appwrite project; schema/tables auto-created on that first login as
designed.

**Fixed: Corso demo seed data replaced with event-appropriate defaults.** The bootstrap flow (any
new project's first login, or admin creating a user under no existing estate) auto-creates an
`estates` row via a hardcoded seed. Changed in `lib/utils.ts` (`DEFAULT_ESTATE_NAME`: "LBS View
Estate" → "Demo Organizer Workspace" — this one constant feeds ~9 call sites), and the literal
`address`/`contactEmail` fields in the three functions that actually write the seed row:
`lib/appwrite/users.ts` (`createAppwriteManagedUser` and `ensureAppwriteDefaultUser`, both write
"Lagos, Nigeria" / "admin@corsvent.example" now) and `lib/appwrite/access-requests.ts`
(`resolveEstate`, same values). Also updated the local-demo-mode estate list in
`lib/demo-data.ts` to match (name/address/contactEmail), so the offline demo dropdown is
consistent too. **Not changed** (didn't touch — protected/low-priority): the actual login/session
logic in these files, `gateName`/`contactPhone` literals (generic enough, not Corso-branded), and
the gate-name fallbacks in `lib/appwrite/visitors.ts` / `lib/local-store.ts` / the residents-import
seed in `lib/appwrite/onboarding-import.ts` (that whole import feature is already flagged for
removal in an earlier note — not worth polishing before deletion).

**Note: the estate row already created in the live database still says "LBS View Estate"** — the
code fix only affects *future* bootstraps (new environments, or if the DB is ever reset). To
rename the one that already exists, Stanley should edit it directly through the app UI once this
session's changes are live: log in as `super@corso.ng`, go to Super Admin → Estates → the
existing estate → edit name/address/contact fields there. No push needed for that part.

**Also found and fixed: a corrupted `.git/index`.** While re-verifying before giving push
commands, `git status` failed with "index file corrupt" — same underlying file-write reliability
issue as the earlier source-file corruption, this time hitting the index itself. Rebuilt cleanly
via `git read-tree HEAD` (safe: nothing had been staged yet, so no risk of losing anything).
`git fsck` confirms the repository objects/history are otherwise fully intact. **This can recur —
if `git status`/`git add` ever errors with anything mentioning "index" or "corrupt," don't panic:
it's very likely fixable the same way** (`rm .git/index && git read-tree HEAD`, then re-run
`git status` to confirm it shows the expected file list again before adding/committing).

**Stanley's local npm install was also broken** (missing `npm.cmd`/`npm.ps1` in his Node.js
install) — separate from this repo, fixed by reinstalling Node.js LTS. Worth remembering if npm
commands go silent (no output, exit 0, nothing actually happens) on his machine again.

**Full push list for this session (nothing has been pushed yet — all of Session 1's work lands in
one push):** see the commands in chat. Files: the crew install (`CLAUDE.md`, `.claude/agents/*`,
`.claude/skills/ship/SKILL.md`, minus `event-app-claude-setup/`), the Phase 0 nav
strip/rebrand/demo-login removal, and this session's seed-data fix
(`lib/utils.ts`, `lib/appwrite/users.ts`, `lib/appwrite/access-requests.ts`, `lib/demo-data.ts`).

**Next session should:**
1. Confirm the push went through, Vercel built green, and `event.corso.ng` shows Corsvent
   branding live (desktop + phone, Light + Dark).
2. Have Stanley rename the already-existing "LBS View Estate" record via the UI (see above).
3. Everything else from the prior progress note still stands (copy sweep, landing page rewrite,
   residents-import-machinery removal, then Phase 1).

### Session 2 (2026-07-21) — auth-card copy + full landing page rewrite

Confirmed via `git log` that Session 1's full push (crew install + Phase 0 strip/rebrand + seed-data
fix) already landed as commit `f3d4af0` on `origin/main`, and per Stanley/"Overseer": build green,
tab title = Corsvent, demo logins removed, live estate record renamed via the Appwrite console.

**This session's work — the two remaining visible-branding gaps Stanley flagged:**

1. **`components/auth/auth-card.tsx` — copy only, login mechanics untouched.** 11 text
   replacements: heading "Sign in to Corso" → "Sign in to Corsvent" (signup heading "Request
   estate access" → "Request access"), tagline → "Secure access for event organizers and staff.",
   `<Field label="Estate">` → "Organizer workspace", every "estate admin" reference → "organizer
   admin" (password reset hint, approval-pending message, rejection message, access-request
   submitted message ×2), old-demo-emails hint reworded, unavailable-login message simplified, and
   the hardcoded `estate: "LBS View Estate"` literal switched to reference the shared
   `DEFAULT_ESTATE_NAME` constant instead of a stale duplicate string.

2. **`app/page.tsx` — full landing page rewrite, Apple-light design system preserved verbatim**
   (every className/JSX structure kept identical, only text content changed). Hero now pitches
   "Run your event without the chaos" with guest-list/pass/gate-check-in copy and a re-themed
   mock dashboard card (check-in counter, VIP guest pass, progress bar). Rewrote the 8-item
   features grid (guest passes, VIP parking, Paystack ticketing, reports, SOS alert, venue
   patrols, broadcasts, digital badges), the 3-step "how it works", the 3 audience cards
   (organizers / ushers & gate staff / guests), section headings, and the contact/footer copy
   (copyright → "© 2026 Corsvent. Lagos, Nigeria.").
   **Self-caught bug, fixed before handoff:** the rewrite initially linked 3 CTAs to `/demo`
   (hero secondary button, contact section, footer nav) — but `app/demo/page.tsx` is just a
   `redirect("/login")` stub left over after Session 1 removed the actual demo-login buttons from
   auth-card.tsx, so `/demo` no longer does anything useful. Repointed all three to `/login`
   instead ("Sign in" / "Already have an account? Sign in." / removed the dead "Demo" footer link).

3. **`components/landing/demo-request-form.tsx`** — matching copy fixes: confirmation message
   "Corso team" → "Corsvent team", field label "Estate name" → "Company / event name" (placeholder
   updated to an event example), textarea placeholder reworded from "how many homes" to "what kind
   of events do you run."

**UI-review pass (done manually — no `ui-reviewer` subagent type available in this environment, so
I applied its checklist by hand):** both files preserve every existing className, so phone-width
(~380px), tap-target sizing, and Light/Dark theme behavior are inherited unchanged from the
already-shipped design system — nothing structural was touched, only strings. The one real issue
found was the `/demo` dead-link problem above, caught and fixed pre-handoff. No other broken links,
no empty/loading/error-state regressions (none of these 3 files touch data-fetching logic).

**Verification done:** typecheck (`tsc -p tsconfig.typecheck.json --noEmit`) exit 0 on the combined
change set; byte-level check on all 3 touched files (NUL-byte scan = 0, brace/paren balance vs
`git show HEAD:<file>` = matched) — the file-corruption bug from Session 1 did not recur, but the
verification step stayed in the workflow per that note's guidance.

**Push ritual for this session's changes** (Stanley runs, from the EVENTAPP folder):

```
node node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit
```

If that prints nothing and exits clean, continue with:

```
git add app/page.tsx components/auth/auth-card.tsx components/landing/demo-request-form.tsx EVENT-APP-HANDOFF.md
git commit -m "Rebrand auth-card copy and rewrite landing page for Corsvent"
git push origin main
```

**Next session should:**
1. Confirm this push built green and `event.corso.ng` shows the new landing page + login copy
   live (desktop + phone, Light + Dark) — Stanley said he'll log in after this to confirm the
   sidebar strip himself.
2. Finish the remaining Corso→Corsvent copy sweep in `pages.tsx` and the reports/system files
   (still deferred from Session 1 — ~50+ scattered strings, mostly in modules slated for deletion).
3. Decide + execute the residents/units/properties import-machinery removal
   (`ResidentOnboardingPanel` / `AppwriteOnboardingPanel`) as its own careful pass.
4. Start Phase 1 (Events table, guest list, pass delivery, check-in) once Stanley confirms the
   sidebar strip.

### Session 3 (2026-07-21) — Phase 1 vertical slice: Events, Guests, passes, gate check-in

Stanley asked to move straight into the real event features rather than wait on the sidebar
check. Confirmed via `git log` that Session 2's push (auth-card + landing page rebrand) had
**not yet been run by Stanley** — those commands are still pending from the prior note above and
should be run together with this session's files (see combined push list below).

**Scope for this session (Stanley picked "full flow, one event" as the starting slice):** a real,
working vertical slice — organizer creates an event, adds guests (manually or pasted CSV), each
guest gets a 6-digit code + QR pass shareable by WhatsApp, and gate staff can look up an event and
check guests in with a live "checked in / still expected" counter. Deferred to later passes: a
full per-scan audit log table (guest check-in currently just stores the latest status + timestamp
on the guest row, not a running log like `visitor_logs`), Paystack ticketing, offline-tolerant
scanning, and CSV file upload (v1 bulk import is copy/paste only).

**Data model — new tables added to `lib/appwrite/schema.ts`:**
- `events`: estateId, name, venue, address, startAt, endAt, gates, status (draft/live/ended),
  createdBy.
- `guests`: estateId, eventId, fullName, phone, email, category (regular/vip/staff), code (6-digit,
  unique per event), status (invited/checked-in/checked-out/cancelled), checkedInAt,
  checkedInGate, checkedInBy.
- **Important — these are the first genuinely new tables added since the estate's Appwrite
  database was already provisioned** (everything before this was part of the original one-time
  bootstrap). The cheap `ensureAppwriteSchemaReady()` guard used elsewhere in the codebase only
  checks that the *database* exists, not that every table does, so it would NOT have created these
  on its own. Fixed by having every entry point in the new `lib/appwrite/events.ts` call the full
  `setupAppwriteOnboardingSchema()` (via a small `ensureEventsSchema()` wrapper) — that function is
  already memoized per server instance in `server.ts`, so this only pays the full schema-check cost
  once per cold start; every later call in the same warm instance reuses the cached result. No
  manual setup step needed from Stanley — the first Events API call after this deploy creates the
  two new tables automatically.

**New backend (`lib/appwrite/events.ts`)** — mirrors the existing `visitors.ts` pattern closely:
event CRUD scoped by estate (organizer = `estate_admin`/`super_admin` only), guest CRUD +
6-digit unique-code generation (same collision-avoidance approach as visitor codes), bulk guest
import (loops single-create, collects per-row errors, caps at 500/import), and check-in by code
(gate staff = `security_guard`/`estate_admin`/`super_admin`, scoped so one estate's staff can never
see or check in another estate's guests).

**New API routes:**
- `/api/appwrite/admin/events` — GET (list, or `?eventId=` for one), POST (create), PATCH (status)
  — organizer-only.
- `/api/appwrite/admin/events/guests` — GET (`?eventId=`), POST (single guest, or `{eventId,
  guests: [...]}`  for bulk) — organizer-only.
- `/api/appwrite/events` — GET, lightweight event listing for gate staff (excludes ended events).
- `/api/appwrite/events/checkin` — POST `{eventId, code, gateName}` — gate staff + organizer.

**New client wrappers** appended to `lib/appwrite/browser-data.ts` (readAppwriteAdminEvents,
createAppwriteAdminEvent, updateAppwriteAdminEventStatus, readAppwriteEventGuests,
createAppwriteGuest, bulkCreateAppwriteGuests, readAppwriteGateEvents,
checkInAppwriteGuestByCode).

**New UI — per CLAUDE.md guardrail #7, built as new files under `components/events/` rather than
adding to the already-12k-line `pages.tsx`** (the only touch to `pages.tsx` itself was exporting
the existing `QRCodeImage` helper so the new screens could reuse it instead of duplicating QR
rendering logic):
- `components/events/events-admin-page.tsx` — event list (cards) + create-event form. Route:
  `/admin/events`.
- `components/events/event-detail-page.tsx` — event header with live stats (total/checked-in/VIP),
  guest table, add-guest form, paste-to-import bulk form, and a guest pass modal (QR + code +
  WhatsApp share, reusing the same `wa.me` share pattern as the existing visitor-invite flow).
  Route: `/admin/events/[eventId]`.
- `components/events/checkin-page.tsx` — event picker + 6-digit code entry (numeric, auto-focus)
  + live "checked in / still expected" counter for gate staff. Route: `/security/checkin`.
- All three reuse the existing `Card`/`CardHeader`/`Field`/`Input`/`Select`/`Textarea`/`Button`/
  `StatCard`/`StatusBadge` primitives from `components/ui/`, so mobile sizing and the dashboard's
  visual style are inherited automatically rather than rebuilt.

**Nav + icons:**
- Added "Events" to `adminNav` and "Guest Check-in" to `securityNav`
  (`components/layout/nav.ts`), using a new `CalendarDays` icon registered in
  `components/layout/app-shell.tsx`'s icon map.
- **Fixed a pre-existing mobile bottom-nav gap while I was in this file:** `MobileBottomNav.tsx`
  still had its own hardcoded "Payments" tab for admin even though Payments was removed from the
  desktop `adminNav` back in Session 1 — the strip only ever touched the desktop sidebar. Replaced
  it with "Events" (admin) and added a "Check-in" tab for security (replacing the old primary
  "Verify" slot, which moved down since visitor-code verification is now the secondary flow).

**Verification done:** typecheck clean (exit 0) after every batch of changes: schema/types edit,
new `events.ts` + routes, new UI components, and again after the nav/icon edits. Full-repo NUL
scan came back clean for every source file (the only NUL bytes found were in binary PNG/ICO/JPEG
assets, which is normal for those file types, not corruption). Brace/paren balance checked against
`git show HEAD:<file>` for every edited file and self-checked for every new file — all balanced.
`git fsck` shows only the same pre-existing harmless dangling tree noted in earlier sessions.

**Not done yet, flagged for the next pass (Phase 1b/1c, already tracked as follow-up tasks):**
finish the vertical slice with real device testing (I can't click through the live app myself —
Stanley should create a test event, add a couple of guests, and check one in from a phone before
trusting this fully), a proper per-scan check-in audit log/history table (mirrors `visitor_logs`),
CSV *file* upload (not just paste), duplicate-scan messaging polish, and eventually wiring the
Events nav item to replace/absorb the old Visitor Logs + Residents items once Phase 1 is confirmed
solid (left both in place this round to avoid breaking anything mid-flight).

**Combined push list for this session (includes Session 2's still-pending auth-card/landing-page
files, since Stanley hadn't pushed those yet):**

```
node node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit
```

If that prints nothing and exits clean, continue with:

```
git add app/page.tsx components/auth/auth-card.tsx components/landing/demo-request-form.tsx lib/types.ts lib/appwrite/schema.ts lib/appwrite/events.ts lib/appwrite/browser-data.ts components/dashboard/pages.tsx components/layout/nav.ts components/layout/app-shell.tsx components/layout/MobileBottomNav.tsx public/sw.js app/api/appwrite/admin/events/route.ts app/api/appwrite/admin/events/guests/route.ts app/api/appwrite/events/route.ts app/api/appwrite/events/checkin/route.ts app/admin/events/page.tsx "app/admin/events/[eventId]/page.tsx" app/security/checkin/page.tsx components/events/events-admin-page.tsx components/events/event-detail-page.tsx components/events/checkin-page.tsx EVENT-APP-HANDOFF.md
git commit -m "Phase 1 vertical slice: Events, guest list, QR passes, gate check-in"
git push origin main
```

**Next session should:**
1. Confirm the push built green, then have Stanley walk through the real flow on `event.corso.ng`:
   create a test event as organizer, add 2-3 guests, view a guest's pass/QR, then log in as
   security and check one guest in — confirm the counter updates.
2. Add a per-scan check-in log table if Stanley wants a full audit trail (currently only the
   latest check-in status/time is stored on the guest row).
3. Everything else from the Session 1/2 notes still stands (copy sweep, residents-import-machinery
   removal) — lower priority than confirming Phase 1 works end-to-end.

### Session 4 (2026-07-21) — live bug fixes from the first real walkthrough

Session 3's push went live and Stanley/"Overseer" did the first real walkthrough (trying to create
an organizer account as super-admin). Two real bugs surfaced, both fixed this session:

**Bug 1 — schema provisioning crash (the serious one).** Appwrite 1.9 rejected the `events` and
`guests` table creation outright: `"Attribute 'status' cannot have a default value when required
is true"`. My Phase 1 schema definitions in `lib/appwrite/schema.ts` combined `required: true` with
`default: "..."` on three columns (`events.status`, `guests.category`, `guests.status`) — every
other column in the whole schema file correctly pairs `default` with `required: false`, this was
the one place I got the combination backwards. Fixed by switching all three to `required: false`
(the create functions in `lib/appwrite/events.ts` always supply an explicit value anyway, so this
is a behavior-neutral fix — the `default` only matters as a DB-level fallback that should now
basically never fire). **Cascading symptom, not a separate bug:** because table creation failed,
the live `/api/appwrite/admin/events` etc. calls errored, which is unrelated to but happened
alongside the super-admin Users page's estate dropdown falling back to locally-cached demo data
showing "LBS View Estate" — grepped the whole codebase and confirmed there is no remaining
hardcoded "LBS View Estate" string anywhere; that name is almost certainly stale `localStorage`
on Stanley's device from before the Session 1 seed-data fix (the local store is an offline
fallback cache, not re-seeded by a code change alone). Once this schema fix ships and live data
loads successfully, the fallback branch shouldn't trigger — if "LBS View Estate" still shows after
this deploys, a hard refresh / PWA close-reopen-twice should clear it; flag it again if it
persists after that.

**Bug 2 — "Organizer" role missing from the create-user dropdown.** My instruction to pick
"Organizer" was wrong — the role is internally `estate_admin` (per the estate→organizer-workspace
concept mapping this whole project is built on) and the create-user dropdown was still displaying
its old Corso label, "Estate Admin," because `roleLabels.estate_admin` in `lib/auth.ts` had never
been updated. Fixed the label itself (`"Estate Admin"` → `"Organizer"`) rather than adding a new
role — this single map feeds the create-user dropdown, the edit-user dropdown, the user list
table, and the temporary-credential summary message, so all four are now consistent. Also found
and fixed the same stale label in `app/admin/layout.tsx`'s sidebar (`roleLabel="Estate Admin /
Manager"` → `"Organizer"`) while sweeping for other "estate admin" text — grepped the whole
codebase afterward and confirmed no other hardcoded "Estate Admin" strings remain.

**release-verifier checklist, run manually (no `release-verifier` subagent type available in this
environment) per Stanley's request before this push:**
- Typecheck: exit 0.
- Guardrail scan: no auth logic touched (auth-card.tsx submit flow / session-context.ts /
  users.ts login untouched this round), no env vars pointing at `lbsview-estate`/`lbsview_estate`,
  no hardcoded secrets — this round is schema column flags + two display-label strings only.
- No new screens this round, so the responsive/theme check doesn't apply.
- `CACHE_NAME` bumped (`public/sw.js`: `...phase1-events-1` → `...phase1-events-2`) since the
  Organizer label is a user-visible change and PWA caches hard on phones.
- `git add` list cross-checked against `git status` — exactly 4 files changed, nothing missing,
  nothing extra (`npm-install-log.txt` is stray local debug output, deliberately excluded).
- **Verdict: READY.**

**Push list for this session:**

```
node node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit
```

If that prints nothing and exits clean, continue with:

```
git add lib/appwrite/schema.ts lib/auth.ts app/admin/layout.tsx public/sw.js EVENT-APP-HANDOFF.md
git commit -m "Fix Appwrite schema validation error and Organizer role label"
git push origin main
```

**Next session should:**
1. Confirm this deploys green, then have Stanley redo the organizer account creation from
   Users & Roles (Super Admin) — this time picking "Organizer" from the dropdown — and confirm
   the events/guests tables provision successfully (no more "cannot have a default value" error).
2. If "LBS View Estate" still shows in the estate dropdown after this ships, have Stanley do a
   hard refresh (or the close-reopen-twice PWA cache ritual) before treating it as a new bug.
3. Once an organizer account exists, resume the original Phase 1 walkthrough: create a test event,
   add guests, check one in as security, confirm the live counter.

### Session 5 (2026-07-21) — "LBS View Estate" traced to real live data; added an in-app fix

Stanley asked why "LBS View Estate" still showed in the Users & Roles estate dropdown even
though the "Organizer" role label was now correct (confirming Session 4's push had landed). I
initially suspected a stale-cache/local-fallback issue again, but ruled that out properly this
time: grepped the whole codebase for the literal string "LBS View Estate" and found zero matches
anywhere — meaning no code path could produce that text from local/demo data. Also double-checked
two spots that looked suspicious mid-investigation (a fetch URL and a JSX snippet that appeared to
contain stray backslashes via the Grep tool's output) directly against the raw file bytes with
`sed`/`cat -A` — both were clean, forward-slash-correct code; the backslashes were a display
artifact in how the search tool rendered results, not real file content. Worth remembering for
future sessions: **always verify a suspected bug against raw file bytes before reporting it** —
this one would have been a false alarm.

**Real conclusion:** "LBS View Estate" is genuinine live data — the estate row in the actual
`eventng_db` database still has that name. Session 1's note that "Overseer renamed it via the
Appwrite console API" either didn't persist or was undone; there's no way to confirm which from
code alone. The bigger problem underneath: **the app had no in-app way to rename an organizer
workspace at all** — `EstateDetailPage` only ever rendered the name/address/contact/gate fields
read-only. That's why this needed Appwrite console access in the first place, and why it would
have kept needing it. Fixed properly instead of just renaming the one row again:

- Added `PATCH` to `app/api/appwrite/super/estates/route.ts` (super-admin only, reuses the same
  `appwriteUpsertRow` upsert pattern as create) and a matching `updateAppwriteSuperEstate` client
  wrapper in `lib/appwrite/browser-data.ts`.
- Added a real "Edit" button + inline form to `EstateDetailPage` (Super Admin → Organizer
  Workspaces → click a workspace) — Stanley can now rename a workspace, or fix its address/contact/
  gate details, entirely in-app. No console access needed for this again.

**Also swept the remaining "Estate" copy that was actively confusing this exact workflow** (all
display text only, no logic touched, same relabel-not-rename approach as the rest of this
project):
- Super Admin nav: "Estates" → "Organizer Workspaces" (desktop), "Workspaces" (mobile bottom nav,
  shorter for the tab label).
- `EstateDirectoryPage`: title, description, table headers, and loading text → "Organizer
  Workspaces" / "workspace" throughout.
- `EstateComposer` (the create-workspace form): card title, description, field labels, and the
  placeholder example (dropped "LBS View Estate Phase 2" as an example name — replaced with
  "Grand Events Ltd").
- `EstateDetailPage`: page title/description, breadcrumb button, stat card helper text, and the
  info card headings all now say "workspace" instead of "estate."
- `UserManagementPage` (Users & Roles): the create-user helper text ("Estate admins can create...")
  and both "Estate" field labels (create form + edit form) → "Organizer workspace", matching the
  pattern already established in `auth-card.tsx`.

**Verification:** typecheck exit 0 after the backend addition and again after the full copy sweep;
NUL-byte scan and brace/paren balance check (against `git show HEAD:<file>`) on every touched
file — all clean, nothing corrupted. Also re-confirmed the file list against `git status`.

**Push list for this session:**

```
node node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit
```

If that prints nothing and exits clean, continue with:

```
git add app/api/appwrite/super/estates/route.ts lib/appwrite/browser-data.ts components/dashboard/pages.tsx components/layout/nav.ts components/layout/MobileBottomNav.tsx public/sw.js EVENT-APP-HANDOFF.md
git commit -m "Add organizer workspace edit capability; relabel remaining Estate copy to Organizer"
git push origin main
```

**Next session should:**
1. Confirm this deploys green, then have Stanley open Super Admin → Organizer Workspaces → the
   existing workspace → Edit, and rename "LBS View Estate" to "Demo Organizer Workspace" (or
   whatever he wants) himself, in-app, confirming the new edit feature works end-to-end.
2. Resume the original Phase 1 walkthrough once an organizer account exists and the workspace name
   is fixed: create a test event, add guests, check one in as security, confirm the live counter.
3. There's still a broader "Corso"/"estate" copy sweep deferred from Session 1 covering
   `pages.tsx` reports/system pages — lower priority than confirming Phase 1 works end-to-end.

### Session 6 (2026-07-21) — sidebar sweep: removed estate-era nav items, renamed the rest

Stanley shared a corrected screenshot confirming Session 5 deployed cleanly (Organizer Workspaces
nav, Organizer role, Organizer admins/workspace copy all showing correctly), then asked what
"Residents" and "LBS View Estate" were still doing in the admin experience. Answered LBS View
Estate (unchanged since Session 5 — Stanley just hadn't used the new Edit button yet) and asked
whether to remove "Residents" from the admin nav now that Events/Guests replaces it. Stanley said
yes, and asked for a full sweep of the sidebar using the same logic — remove or rename anything
estate-era that doesn't map to events/guests/gates, done once instead of item by item.

**Research first:** used a subagent to audit every remaining admin nav item's underlying page and
data-model coupling before touching anything (report below, condensed):
- **Estate Profile** — a session-only settings form (no real backend save), hardcoded with
  "LBS View Estate" example values and a resident-era "service charge categories" field. Not
  actually resident/unit-coupled in the data layer — just mislabeled copy. → **rename + fix copy.**
- **Visitor Logs** — reads the `visitors` table, keyed by `residentId`/`unitCode`, joined against
  `residents`/`units`. Entirely separate data model from the new `guests` table backing Events,
  zero reuse path. → **remove from nav** (same reasoning as Residents).
- **Complaints** — property-maintenance ticketing (security/power/water/waste/noise/road/facility
  categories), every record carries `residentName`/`unitCode`. Doesn't map to an events company's
  workflow. → **remove from nav.**
- **Digital IDs** — resident ID-card system pulling from `state.residents`, and now redundant:
  Events already has its own QR guest-pass system (`GuestPassModal`). → **remove from nav.**
- **Announcements** — generic title/message/priority broadcaster with no resident/unit field
  coupling (just a `targetRole` enum). Structurally fine as-is. → **rename to "Broadcasts."**
- **Users & Roles** — "resident" is just one of four selectable role options, no special
  prominence now that Residents isn't a standalone nav item. → **keep as-is.**

**Changes made** (nav labels/removals only — per this project's "hide nav first, delete code once
stable" rule, none of the underlying pages/routes were deleted; they're still reachable by direct
URL and can be removed for real in a later cleanup pass once confirmed unused):
- `components/layout/nav.ts` (`adminNav`): removed Residents, Visitor Logs, Complaints, Digital
  IDs. Renamed "Estate Profile" → "Organizer Profile", "Announcements" → "Broadcasts".
- `components/layout/nav.ts` (`securityNav`): applied the same logic — removed "Verify Visitor",
  "Expected Visitors", "Entry Logs" (all read the same resident/visitor-coupled data as admin's
  Visitor Logs) and "Verify Digital ID" (same resident-ID system as admin's Digital IDs). Left
  with Dashboard, SOS, Guest Check-in, Guard Tour (module-gated, kept since venue patrol for large
  events is a plausible future use per the concept-mapping table in section 2).
- `components/layout/MobileBottomNav.tsx`: admin tab bar swapped "Residents" → "Users" (Users &
  Roles); security tab bar dropped "Verify" and "Logs" (mirrors the desktop removals) down to
  Dash / Check-in / SOS. Removed the now-unused `QrCode`/`ClipboardList` icon imports.
- `components/dashboard/pages.tsx`:
  - `EstateProfilePage` → full copy pass: "Estate profile" → "Organizer profile", dropped the
    "Service charge categories" field entirely (no equivalent concept for an events company),
    updated all hardcoded example values (LBS View Estate → Demo Organizer Workspace, address/
    email/payout account → Corsvent-appropriate examples).
  - `AnnouncementsAdminPage` → title/description/button copy relabeled to "Broadcasts" language
    (organizer-facing only — the resident-facing Announcements page/nav was deliberately left
    untouched this round, see below).

**Deliberately NOT touched this round — flagged for a future, separate decision:** the entire
resident portal (`residentNav`: Home, Invite Visitor, Complaints, Digital ID, Visitors,
Announcements, SOS) and `csoNav`. Whether an events app still needs a "resident" login type at
all — and if so, what it should become — is a bigger product question than a nav copy sweep;
didn't want to make that call silently mid-cleanup. Revisit with Stanley explicitly before
touching it.

**Verification:** typecheck exit 0 after all changes; NUL-byte scan and brace/paren balance check
(against `git show HEAD:<file>`) on every touched file — all clean. `CACHE_NAME` bumped again
(user-facing nav changes).

**Push list for this session:**

```
node node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit
```

If that prints nothing and exits clean, continue with:

```
git add components/layout/nav.ts components/layout/MobileBottomNav.tsx components/dashboard/pages.tsx public/sw.js EVENT-APP-HANDOFF.md
git commit -m "Sweep admin/security nav: remove estate-era items, rename the rest to organizer/event language"
git push origin main
```

**Next session should:**
1. Confirm this deploys green and the admin/security sidebars show the trimmed, renamed lists.
2. Have Stanley finish the Phase 1 walkthrough: rename the workspace via the new Edit button,
   create a test event, add guests, check one in as security.
3. Decide with Stanley (don't assume) what happens to the resident portal / "resident" role
   long-term — repurpose, keep as-is, or remove — before touching `residentNav`/`csoNav`.
4. Once confirmed genuinely unused, physically delete the hidden routes/components (Visitor Logs,
   Complaints, Digital IDs, Residents) rather than leaving them reachable by direct URL forever.

### Session 7 (2026-07-21) — DEMO DAY: fresh dashboards, QR camera scanning, live counters, final estate-word sweep

Stanley is demoing Corsvent TODAY. Everything this session optimizes the demo path only:
organizer creates event → adds guests → guest passes (QR + WhatsApp) → gate check-in →
live arrivals counter. Confirmed at session start that all of Sessions 1–6 was already
committed AND pushed (`origin/main` = `381d605`), and the Session 4 schema fix
(`required: false` + `default` on events.status / guests.category / guests.status) is
in that pushed code — the "Attribute 'status' cannot have a default when required" blocker
is resolved on disk and live.

**New screens (fresh files, event language only):**
- `components/events/organizer-dashboard.tsx` — new organizer home (`/admin` now renders this
  instead of the estate-era `AdminDashboard`): event stats, a featured-event "X of Y guests
  arrived" card with progress bar that auto-refreshes every 8s, and an event card list.
  `AdminDashboard` in pages.tsx still exists but is no longer routed.
- `components/events/gate-dashboard.tsx` — new gate-staff home (`/security` now renders this
  instead of `SecurityDashboard`): big Guest Check-in tile, Event SOS tile, live
  arrived/still-expected counters and a "latest arrivals" feed (auto-refresh 8s). The old
  visitor/plate-capture dashboard is no longer routed.

**Check-in screen (`components/events/checkin-page.tsx`) — QR scanning added:** "Scan QR with
camera" opens a live camera view using the browser-native BarcodeDetector API (no new npm
dependency — registry access is blocked in the cloud sandbox anyway). Works on Chrome/Android
(the realistic gate-staff phone); graceful fallback messages if the browser lacks
BarcodeDetector or camera permission is denied, with the type-the-code path always available.
Detected QR → digits → same submitCode() path as typing. Camera stops on detect/close/unmount.
Counter now also auto-refreshes every 8s (silent poll, no flicker), so it ticks up even if
another gate checks guests in.

**Event detail page:** silent 8s auto-refresh added, so the organizer's stats/guest table tick
up live while gate staff scan. Background poll failures don't flash error banners.
**Guest pass modal light-theme bug fixed:** the modal was `bg-slate-900` (hardcoded dark) while
the global light-theme CSS overrides `.text-white` to dark ink → invisible text in Light mode.
Now `bg-panel border-line shadow-glow`, correct in both themes.

**Estate-word sweep on the demo path (delete-not-rename per Stanley's rule):**
- `adminNav`: removed Broadcasts (its form says "all residents"), Reports, System Status,
  Settings (page says "Default resident status"/"Visitor code expiry"). Admin sidebar is now:
  Dashboard, SOS, Events, Organizer Profile, Users & Roles.
- `securityNav`: removed Guard Tour. Now: Dashboard, SOS, Guest Check-in.
- `MobileBottomNav` admin tabs: removed Reports → Dash/Events/SOS/Users.
- `lib/auth.ts`: `security_guard` label "Security Guard" → **"Gate Staff"**; local-demo user
  names de-Corso'd ("LBS View Estate Manager" → "Demo Organizer" etc.). Roles unchanged
  internally.
- `UserManagementPage` (pages.tsx): create-user description no longer lists "CSO, security,
  resident, and vendor"; role dropdowns now offer only Organizer + Gate Staff (super-admin
  scope: + Super Admin; admin scope: Gate Staff only — **verified against
  `app/api/appwrite/admin/users/route.ts`, which 403s an estate_admin creating another
  estate_admin, so the dropdown no longer offers a role the API would reject**). Default
  role selections changed from "resident" to "security_guard". Routes for the removed nav
  items still exist by direct URL (consistent with the hide-first rule); physically delete
  post-demo.
- `CACHE_NAME` bumped → `corsvent-v2026-07-21-demo-day-1`.

**Verification done this session:** all 11 touched/new files copied back to the device and
md5-verified byte-for-byte against the intended content (no corruption recurrence); NUL scan +
brace/paren balance clean; full-tree typecheck run in the cloud sandbox (project sources + all
node_modules type declarations bundled over, TypeScript 6.0.3) → **exit 0**. Note the sandbox
check needed a `declare module "*.css"` shim only because TS 6 added error TS2882 for
side-effect CSS imports — the project's own TS 5.x doesn't have that error; the shim was NOT
added to the repo. Stanley must still run the project's own typecheck before pushing (ritual
below), which is the authoritative gate.

**Environment notes for future sessions (cloud/device bridge quirks found today):**
- Running plain `git status`/`git diff` on the mounted folder from the cloud sandbox leaves a
  stale `.git/index.lock` (the VM can't delete files). Use `git --no-optional-locks <cmd>` for
  read-only git on the mount. Today's stray lock was moved to `_to_delete/stale-index.lock`.
- Device-side `git status` shows ~200 phantom "modified" files — CRLF noise from the Linux VM's
  viewpoint, not real changes. Trust `git status` run by Stanley on Windows instead.
- Background processes on the device VM are killed when each command returns, and commands cap
  at 45s, so the full tsc can't run device-side from here; the cloud-bundle approach above is
  the workaround (bundle script/chunks were built into `_to_delete/`).
- `_to_delete/` in the repo root is scratch (typecheck bundles + stale lock) — Stanley can
  delete the whole folder anytime; it must NOT be committed.

**Deferred / post-demo (recorded per Stanley's instruction):**
- **Full clean-slate rebuild of admin Reports + remaining estate-era pages comes AFTER the
  demo.** The hidden-but-reachable routes (bills, payments, facilities, residents, visitor
  logs, complaints, digital IDs, broadcasts, reports, system, settings, resident portal,
  cso) should then be rebuilt event-shaped or physically deleted.
- Per-scan check-in audit log table, CSV file upload, offline-tolerant scanning, Paystack —
  unchanged from earlier notes.
- jsQR/zxing fallback for iOS Safari camera scanning (BarcodeDetector is Chromium-only);
  needs npm registry access or vendoring the lib.

**Push ritual for this session** (Stanley runs, from the EVENTAPP folder): see chat — single
demo-day commit, 12 files (11 code + this handoff).


### Session 8 (2026-07-21) — Overseer architecture rules recorded + compliance audit

Appended the Overseer-approved architecture rules as section 6 above (6A proxy-only Appwrite
access, 6B guard-tour-pattern offline queue, 6C house-pattern check-in route). Audited the
existing Phase 1 code against them before recording:

- **6A: compliant today.** All event/guest/check-in UI goes through `lib/appwrite/browser-data.ts`
  wrappers → our own API routes → `lib/appwrite/server.ts` REST helpers. No Appwrite Web SDK
  anywhere in the frontend.
- **6C: compliant today.** `checkInAppwriteGuestByCode` (lib/appwrite/events.ts) takes identity
  from `resolveSessionContext` — `checkedInBy: context.profileId`, never from the request body;
  workspace-scoped reads; writes via `appwriteUpsertRow` with `safeAppwriteId`; no
  `node-appwrite`/`createDocument`/`'unique()'`/`_COLLECTION_ID` anywhere. Note the current
  vertical slice stores the latest check-in state on the guest row; the planned per-scan audit
  log table (next build) must ALSO follow 6C — one inserted row per scan with `scannedBy`,
  `gate`, timestamp, modeled on `app/api/appwrite/security/patrols/route.ts`.
- **6B: not yet built (as expected).** Offline check-in queueing is still on the backlog; when
  built, it must reuse the `lib/guard-tour.ts` localStorage queue pattern verbatim — this rule
  now pins the design so no new storage library sneaks in.

Doc-only change; no code touched this session.

### Session 9 (2026-07-21) — gate log, offline queue, CSV upload, Reports rebuild, estate-route deletion

Stanley said "continue till you finish every build" — this session executes the whole approved
backlog except Paystack/RSVP (**explicitly deferred by Stanley: no Paystack account exists yet;
do not start it until he says so**).

**Build 1 — per-scan gate log (rule 6C).** New `checkins` table in `lib/appwrite/schema.ts`
(auto-provisions on first API call, same memoized path as events/guests — columns follow the
required-false-with-default rule from Session 4). Every scan now inserts one row: `scannedBy`
from session profileId (never the body), `gate`, server `scannedAt`, `capturedAt`, guest
snapshot fields, and `result` — including `"duplicate"` rows when someone re-scans an
already-arrived guest (the check-in still throws the same duplicate error; logging is
non-fatal-wrapped so it can never break the check-in itself). New `listAppwriteEventCheckins`
+ GET on `/api/appwrite/events/checkin?eventId=` (gate + organizer roles), client wrapper
`readAppwriteEventCheckins`, and a "Gate log" card on the event detail page (newest first,
duplicate attempts badged amber).

**Build 2 — offline scan queue (rule 6B).** New `lib/gate-offline.ts` mirroring
`lib/guard-tour.ts` exactly: localStorage queue (`corsvent_pending_checkins`), flush on
`online`/`visibilitychange` + on mount, permanent rejections (no such guest / cancelled)
leave the queue, "already checked in" counts as duplicate, network failures stay queued.
Check-in screen: network-failed scans save with amber "Saved offline — will sync
automatically" feedback, a pending-count chip, and sync results reported in the message area.
Offline scans send `capturedAt`; the server accepts it only within [-48h, +5min] (clock-skew
guard, `normalizeCapturedAt` in events.ts) and uses it for the guest's `checkedInAt` so
arrival times stay honest after a sync.

**Build 3 — CSV file upload.** Bulk import card now has a file input (FileReader, no new
libraries) that loads the CSV into the existing preview textarea; the parser now skips a
"Name, Phone, Category" header row, strips simple quotes, handles CRLF, and normalizes
category case.

**Build 4 — Reports rebuilt for events.** New `components/events/event-reports-page.tsx`
(fresh file, event language only): event picker, guest-list/arrived/no-shows/VIP stat cards
with attendance %, arrivals + no-shows lists, and client-generated CSV export (full list and
no-shows-only, quoted-cell-safe). `/admin/reports` now renders this instead of the estate
`ReportsPage`; "Reports" restored to adminNav and the admin mobile tab bar.

**Build 5 — stale estate routes physically deleted** (git rm commands given to Stanley; the
cloud bridge cannot delete device files). Deleted route folders: admin announcements, bills,
complaints, digital-ids, facilities, knowledge-base, payments, residents, settings, system,
visitors; security expected-visitors, logs, scan-plate, verify-id, verify-visitor; plus
app/marketplace and the dead app/demo redirect stub. Kept: everything under app/resident and
app/cso (product decision still pending with Stanley — do NOT delete without him), security
checkin/guard-tour/sos-alerts, admin estate/events/users/reports/sos-alerts, super-admin.
The page COMPONENTS in `components/dashboard/pages.tsx` (BillsAdminPage etc.) still exist as
now-unrouted dead exports — deleting them from the 12k-line file is a separate careful pass.
Note `/admin/settings` is gone, so the module-toggle UI (EstateModulesCard) is unreachable;
guard_tour/plate_capture stay at their DB defaults until an event-shaped settings page is
built (backlog).

**Verification:** full-tree typecheck (cloud sandbox, TS 6.0.3) exit 0 after EVERY checkpoint
above, including one final run with all 18 route folders deleted. NUL scan + brace balance on
all touched files; md5 byte-verification cloud↔device on every committed file. `CACHE_NAME`
bumped → `corsvent-v2026-07-21-gatelog-1`.

**Still on the backlog (in rough order):** event-shaped Settings page (module toggles +
workspace defaults), iOS Safari QR scanning (needs a vendored decoder — BarcodeDetector is
Chromium-only; npm registry blocked in the cloud sandbox), physical deletion of dead
estate components inside pages.tsx, resident/cso portal decision with Stanley, then
RSVP + Paystack when Stanley has an account, broadcasts + certificates after that.

### Session 10 (2026-07-21) — live-failure fixes: table provisioning, form crash, honest errors

Overseer verified via the Appwrite console API that events/guests/checkins were NEVER created
in eventng_db — only estate-era tables existed. Root cause found in code: `ensureEventsSchema()`
called the FULL `setupAppwriteOnboardingSchema()` sweep, which walks all ~30 estate-era tables
(dozens of REST round-trips) with the event tables LAST in `appwriteOnboardingTables` — on a
serverless cold start the function time limit kills the request before provisioning ever
reaches them, the memoized promise clears on failure, and the next cold start repeats the same
doomed walk. The client meanwhile aborted at its own 12s timeout and showed the misleading
"taking too long" message.

**Fix 1 — targeted provisioning.** New `ensureAppwriteTablesExist(tableIds)` in
`lib/appwrite/server.ts`: ensures ONLY the named tables via the existing `ensureTable` helper
(which also heals missing columns on existing tables), memoized per instance with
clear-on-failure, falling back to the full setup only when the database itself is missing.
`ensureEventsSchema()` now calls `ensureAppwriteTablesExist(["events", "guests", "checkins"])`
— a handful of quick calls instead of the full sweep. Verified every events/guests/checkin
entry point ensures schema first, directly or via `getAppwriteEvent`. The schema definitions
already comply with the Appwrite 1.9 rule (no `default` on `required: true`) from Session 4.
No version marker needed — the targeted ensure is idempotent and self-healing, so "bump a
version to re-run" is replaced by "always cheaply verify the three tables".

**Fix 2 — create-event form crash** ("Cannot read properties of null (reading 'reset')"):
`event.currentTarget.reset()` after an await — React nulls currentTarget by then. Captured
`const formElement = event.currentTarget` at handler top in `events-admin-page.tsx` (create
event) and `event-detail-page.tsx` (add guest) — same fix as EstateComposer in the parent
repo. These were the only two `.reset()`-after-await sites in components/events/.

**Fix 3 — honest error messages.** All event/guest/gate wrappers in `browser-data.ts`: the
timeout message now says what actually happened ("The server did not respond within 12
seconds...") and non-OK fallbacks include the HTTP status (`(HTTP 500)`) when the server sends
no error text — the next failure diagnoses itself.

**Verification:** typecheck exit 0; md5 byte-verification on all committed files. CACHE_NAME →
`corsvent-v2026-07-21-checkin-fix-1`. No data cleanup needed (zero event rows existed).
After this deploys green, re-run the walkthrough from Step 1 (create event → guest → check-in).

### Roadmap addition (2026-07-21, from Stanley) — VIP Parking module (post-demo)

Resurrect the inherited plate-capture module as an optional **"VIP Parking"** feature:
- Organizer registers expected VIP plates per event (plate number ↔ guest/VIP name).
- Gate staff scan/enter plates at the car gate; arrivals logged with timestamp and staff ID
  (same rule-6C shape as the guest gate log — scannedBy from session, never the body).
- Kept behind the existing per-workspace module toggle (`plate_capture` in
  `estates.disabledModules` — the toggle plumbing survived the strip; the toggle UI needs a
  home again since /admin/settings was deleted, which is already on the backlog as the
  event-shaped Settings page).
- Build notes for whoever picks this up: the old plate-capture code was nav-hidden in Phase 0
  and its route (`app/security/scan-plate`) was deleted in Session 9 — the underlying
  components in `components/dashboard/pages.tsx` and any `vehicle_logs` table machinery still
  exist to salvage. Follow the concept-mapping table in section 2 (plate capture → VIP
  parking) and rules 6A/6B/6C: proxy via our API routes, guard-tour offline queue if offline
  support is wanted at the car gate, house-pattern route modeled on patrols.

Priority: after the current backlog (event-shaped Settings, iOS QR fallback, pages.tsx dead
component deletion, resident/cso decision) unless Stanley pulls it forward.

### Session 11 (2026-07-21) — event-shaped Settings page (module toggles restored)

Built the event-language replacement for the deleted estate Settings page:
- New `components/events/workspace-settings-page.tsx` (fresh file per guardrail #7): module
  toggle card reusing the existing `readDisabledEstateModules`/`saveDisabledEstateModules`
  wrappers → `/api/appwrite/estate-modules` (rule 6A respected — no new API surface). Options
  shown in event language: `guard_tour` → "Venue Patrols", `plate_capture` → "VIP Parking
  (feature in development)" — the same underlying module keys, so the VIP Parking roadmap item
  has its toggle ready. `digital_ids` deliberately not shown (redundant with guest QR passes).
- Recreated `app/admin/settings/page.tsx` rendering it; "Settings" restored to `adminNav`
  (desktop only — mobile tab bar stays at 5 tabs).
- The old `SettingsPage`/`EstateModulesCard` in pages.tsx remain as dead exports for the
  pages.tsx cleanup pass.

Verification: typecheck exit 0; md5 byte-verification on all committed files. CACHE_NAME →
`corsvent-v2026-07-21-settings-1`.

**Backlog state after this session:** iOS Safari QR scanning is BLOCKED on a decision — it
needs a vendored QR-decode library (BarcodeDetector is Chromium-only; npm registry blocked in
the cloud sandbox), and rule 6B's no-new-libraries spirit says don't vendor one silently: ask
Stanley/Overseer before adding ~40KB of vendored decoder code. The pages.tsx dead-component
deletion remains a dedicated careful pass (12k-line shared-state file — don't rush it at a
session tail). Resident/CSO portal decision still needs Stanley. Then VIP Parking, then
Paystack/RSVP when Stanley has an account.
