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

## 5. Definition of done, per phase

Typecheck clean → Stanley pushes (his six-command ritual) → Vercel green → live smoke test on the
real domain (desktop + phone, Light + Dark) → update the project's own ROADMAP.md.

## 6. Answers to predictable questions

- Same Appwrite server for both apps? Yes — separate projects/databases/API keys keep them sealed.
- Shared login with Corso? No. Separate user base, separate cookies, separate domain.
- Can an organizer later ALSO be a Corso estate? Fine — separate accounts; do not build bridges.
- Sender ID / WhatsApp Business API paperwork: same CAC-based process noted in Corso's
  CORSO-ROADMAP.md; do it under the event brand when the name is chosen.
