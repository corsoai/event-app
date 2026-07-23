# Feature status

*Evidence-based classification against the repository at git `77dcf5c` (Session 16). This is the
most important doc: do not treat a feature as done just because a screen exists.*

## Read this first (verification caveats)
- **No automated test suite is wired.** `package.json` has no `test` script. Only 3 legacy estate
  smoke scripts exist (`tests/account-approval-smoke.mjs`, `local-demo-smoke.mjs`,
  `visitor-window-smoke.mjs`) and are not event tests. So **check #6 (tests) fails for every event
  feature.**
- **Most event features have NOT been click-tested end to end.** Where "manually observed" is noted,
  the operator saw it work in the live app this session; everything else is implemented-but-unverified.
- Verification checks per feature: (1) UI exists, (2) API/server action exists, (3) reads/writes real
  Appwrite data, (4) authz + workspace/event isolation, (5) error/loading states, (6) tests,
  (7) production-suitable. `Y`=verified present, `N`=absent, `~`=partial/unverified.

## Status legend
Complete = implemented, real data, and verified working. Partial = implemented on real data but
some required behavior/verification remains. UI only = screen exists, backend missing. Mocked =
uses sample/fallback/estate data. Broken = present but failing. Planned = not implemented.
Deprecated = should be removed.

## Event product

| Feature | Status | UI | API | Real data | Authz/iso | Err/Load | Tests | Notes |
|---|---|---|---|---|---|---|---|---|
| Auth / login / sessions | Complete | Y | Y | Y | Y | Y | N | Inherited, everyone logs in. Do NOT modify. |
| Event create + list | Complete | Y | Y | Y | Y | Y | N | Manually observed working. |
| Event edit (details) | Partial | Y | Y | Y | Y | Y | N | Built S15; not verified live. |
| Guest add (manual) | Complete | Y | Y | Y | Y | Y | N | Observed (3 guests, one checked-in). |
| Guest paste import | Partial | Y | Y | Y | Y | Y | N | Built; unverified. |
| Guest CSV upload | Partial | Y | Y | Y | Y | Y | N | FileReader parse; unverified. |
| Guest search (list + check-in) | Partial | Y | Y | Y | Y | Y | N | Built S15; unverified. |
| QR pass (view) | Complete | Y | Y | Y | Y | Y | N | Observed via "View pass". |
| Downloadable invite image | Partial | Y | n/a | Y | Y | Y | N | Client canvas via `qrcode`; built S16, not verified live. |
| WhatsApp share | Complete | Y | n/a | Y | Y | Y | N | wa.me link with event details + code. |
| Public RSVP `/e/<id>` | Partial | Y | Y | Y | public by design | Y | N | Built S14; idempotent by phone; unverified live. |
| Gate check-in by code | Complete | Y | Y | Y | Y | Y | N | Observed working. |
| QR camera scan (Android/iPhone) | Partial | Y | Y | Y | Y | Y | N | BarcodeDetector + jsqr fallback; needs HTTPS+perm; unverified on phones. |
| Duplicate detection + per-scan gate log | Partial | Y | Y | Y | Y | Y | N | `checkins` table (rule 6C); built S9; unverified. |
| Offline check-in queue | Partial | Y | Y | Y | Y | Y | N | `lib/gate-offline.ts`; built S9; unverified. |
| VIP Parking register + arrival | Partial | Y | Y | Y | Y | Y | N | Built S13; behind `plate_capture` toggle; unverified. |
| VIP plate camera scan (ANPR) | Partial | Y | Y | Y | Y | Y | N | Built S16; cloud needs `PLATE_RECOGNIZER_TOKEN` (unset => tesseract OCR); unverified. |
| Reports + CSV export | Partial | Y | Y | Y | Y | Y | N | Built S9; unverified. |
| Settings module toggles | Partial | Y | Y | Y | Y | Y | N | Built S11; unverified. |
| Super Admin: workspaces (list/create/edit) | Partial | Y | Y | Y | Y | Y | N | Real data; not fully verified. |
| Super Admin dashboard metrics | Partial | Y | Y | Y | Y | Y | N | Cleaned to one real "Organizer workspaces" count (S16); richer event metrics Planned. |
| Organizer workspace detail `/super-admin/estates/[id]` | Mocked | Y | ~ | N | Y | Y | N | Still shows estate tiles (Residents/Visitors/Bills/Complaints) + resident directory from dead/estate data - not event data. |
| Email passes / reminders (events) | Planned | N | N | N | - | - | N | `events.ts` sends no email; Resend is wired only for user provisioning. |
| Payments - Paystack | Planned | landing copy only | N | N | - | - | N | Advertised on `app/page.tsx`; no integration. |
| Payments - Monnify | Deprecated | ~ | Y (legacy) | ~ | ~ | ~ | N | Inherited routes; not for events. |

## Inherited estate features (from the fork)

| Feature | Status | Notes |
|---|---|---|
| Resident portal (`/resident/**`) | Deprecated | Present; removal pending an explicit decision. |
| CSO portal (`/cso/**`) | Deprecated | Present; removal pending decision. |
| Billing / accounting | Deprecated | Legacy `lib/appwrite/accounting.ts`, billing-*, Monnify. |
| Complaints, facilities, household, knowledge-base | Deprecated | Legacy modules + routes, mostly nav-hidden. |
| Visitor logs / digital IDs | Deprecated | Replaced by guest passes; routes deleted or nav-hidden. |
| SOS alerts | Partial | Inherited; routes exist; not event-adapted or tested. |
| Venue patrols (guard tour) | Partial | Behind `guard_tour` toggle; inherited; unverified for events. |

## Assumptions / could not verify
- Runtime correctness of any "Partial" item (no automated tests; no live click-through this session).
- Whether the live Appwrite database currently holds the four event tables with all columns (they
  auto-provision on first use; not inspected against the live DB here).
- Exact behavior of legacy routes under current data (out of scope; assumed Deprecated).
