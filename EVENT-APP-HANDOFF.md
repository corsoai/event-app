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
