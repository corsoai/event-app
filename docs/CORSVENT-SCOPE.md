# Corsvent — Scope & Workflow Map

*Snapshot as of 2026-07-21 (through Session 14). Live at `event.corso.ng`. This document is
the bird's-eye view for deciding what to improve and what to build next.*

---

## 1. What Corsvent is

An all-in-one event management platform for Nigeria, mobile-first, built around one core
promise: **the guest list is the gate list.** Organizers build a guest list, every guest gets
a QR/code pass delivered over WhatsApp, gate staff scan people in on ordinary phones, and the
organizer watches arrivals live. Its DNA (forked from an estate-security platform) gives it a
differentiator competitors like Zikoro lack: real gate discipline — per-scan audit logs,
duplicate-scan detection, offline-tolerant scanning, SOS alerts, and VIP vehicle handling.

## 2. Who uses it (roles)

| Role (display name) | Internal key | Home screen | Can do |
|---|---|---|---|
| Super Admin | `super_admin` | /super-admin | Create organizer workspaces, create any user, edit workspace details, platform reports |
| Organizer | `estate_admin` | /admin | Everything below in their own workspace only |
| Gate Staff | `security_guard` | /security | Check guests in, log VIP vehicles, raise/see SOS |
| (Resident, CSO, Vendor) | legacy | — | Inherited estate roles; portals still exist but are outside the event product. **Decision pending: repurpose or remove.** |

Multi-tenancy: every workspace (internally "estate") is isolated — an organizer or their gate
staff can never see another workspace's events, guests, or logs. Optional features are
toggled per workspace (Settings → Venue Patrols, VIP Parking).

## 3. The core workflows, end to end

**Organizer — before the event.** Log in → Organizer dashboard → Events → create event
(name, venue, date, gates) → open the event → build the guest list three ways: add one guest
(name/phone/email/category Regular-VIP-Staff), paste rows from Excel, or upload a CSV file.
Every guest instantly has a unique 6-digit code + QR pass. Delivery: open a guest's pass →
"Share by WhatsApp." Or share the **public RSVP link** (`/e/<event-id>`, with copy +
WhatsApp buttons) and let guests register themselves — each gets their pass on-screen with a
"Save to WhatsApp" button; re-entering the same phone shows the existing pass. Optionally
register expected VIP plates ("ABC123DE — Chief Adeyemi"). Press **Go live**.

**Guest.** Receives pass via WhatsApp (or self-serves via the RSVP link). At the venue, shows
the QR or reads out the 6-digit code. VIPs' cars are waved through the car gate against the
plate list.

**Gate staff — during the event.** Log in on a phone → Gate dashboard (big Check-in tile,
live arrived/expected counters, latest-arrivals feed) → Guest Check-in → pick event → scan
the QR with the camera (native on Android Chrome; jsqr fallback on iPhone Safari) or type the
code. Confirmation shows the guest's name and category. Re-scans get "already checked in at
2:14 pm." If the network dies, scans queue locally with amber "Saved offline" feedback and
sync automatically when it returns. VIP Parking screen logs car arrivals the same way.

**Organizer — during and after.** The event page and dashboard tick live every 8 seconds:
"X of Y arrived," progress bar, guest statuses, and the Gate log (every scan, including
duplicate attempts, with time/gate/staff). After the event: Reports → attendance summary
(arrived %, no-shows, VIPs, total scans) → export full list or no-shows as CSV.

**Super Admin.** Creates workspaces and Organizer accounts; edits workspace details in-app;
platform-level reports. (Bootstrap flow: first login of a fresh environment auto-provisions
the database schema.)

## 4. Under the hood (what makes it trustworthy)

All data access is proxied through our own API routes with the server key — the browser never
talks to the database directly (rule 6A). Staff identity on every scan comes from the login
session, never from the request, so logs can't be spoofed (rule 6C). Offline scans reuse the
proven patrol-queue pattern (rule 6B). New tables self-provision on first use. The app is a
PWA with Light/Dark themes, ~380px-first layouts, and cache-busting on every release.

Tables: workspaces, users/profiles, events, guests, checkins (per-scan log), vip_plates,
plus inherited SOS/patrol/staff tables. Landing + auth pages are Corsvent-branded; auth
pages force Light theme.

## 5. Known gaps and rough edges (improvement areas)

1. **Untested pile.** Sessions 9–14 (gate log, offline queue, CSV upload, Reports, Settings,
   iPhone scanning, VIP Parking, RSVP) are typechecked but not yet clicked through on real
   phones. One catch-up test hour is the single highest-value next activity.
2. **Pass delivery is manual.** WhatsApp share is per-guest, tap by tap. No bulk send (needs
   WhatsApp Business API or SMS), no email passes yet despite Resend being wired.
3. **RSVP page is bare-bones.** No cover image, no event description, no capacity/RSVP
   deadline controls, no organizer branding, no map link. It's also unlisted-but-public —
   fine for now, worth a per-event on/off switch.
4. **Reports are attendance-only.** No per-gate breakdown, no arrivals-over-time chart, no
   check-in peak analysis, no cross-event analytics for an organizer's season.
5. **Organizer can't edit an event** after creation (name/venue/date are create-only; only
   status changes). No event delete/archive either.
6. **Guest management gaps.** No edit/remove guest, no cancel invitation from the UI (the
   status exists), no search/filter on long guest lists, no undo for a wrong check-in.
7. **Roles are thin.** One organizer tier; no per-event staff assignment (any gate staff in
   the workspace sees every event); no multi-day/multi-entry passes.
8. **Legacy leftovers.** Resident/CSO portals await a decision; orphaned helpers remain in
   pages.tsx; logo/icon files are still old artwork awaiting real Corsvent branding.
9. **Camera scanning depends on HTTPS + permission UX** — no in-app guidance if a user
   blocked the camera once; plate entry is typed (no ANPR).

## 6. Feature menu (candidates to add, grouped)

**Money (Phase 2 completion)** — Paystack paid tickets (tiers, webhook → auto-pass) once the
account exists; ticket quantities/capacity; promo codes; revenue view in Reports.

**Comms (Phase 3)** — email passes + reminders via the already-wired Resend ("event is
tomorrow"); SMS passes via BulkSMSNigeria for non-WhatsApp guests; post-event thank-you
broadcast; certificates of attendance auto-issued from check-in data (strong for academic/
corporate/religious markets).

**Event depth** — event edit/archive; per-event gate staff assignment; multi-day events and
re-entry passes; seating/tables for weddings; guest +1s; check-in undo; guest search.

**Growth** — richer public event page (cover image, description, map, organizer brand);
event discovery/listing page; organizer analytics across events; protocol-list features for
government functions (dignitary categories, convoy plates — leans on our security DNA);
NDPR data-retention (auto-purge guest PII N days after the event, configurable).

**Platform polish** — real Corsvent logo/icons; guided onboarding for a new organizer;
role-aware in-app help; audit log viewer for super admin.

## 7. Suggested order (engineer's opinion)

Test the untested pile first — it's a week of features waiting on one hour of clicking. Then
event edit + guest management gaps (they'll embarrass us at the first real event), then email
passes + reminders (cheap, Resend is ready), then Paystack when the account lands, then
certificates, then the richer public page. Everything else follows demand.

---

*Companion docs: `EVENT-APP-HANDOFF.md` (session-by-session build history and architecture
rules) and `CLAUDE.md` (working rules). This scope doc should be refreshed when phases close.*
