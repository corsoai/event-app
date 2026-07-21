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
