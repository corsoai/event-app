# Development history (condensed)

*Full session-by-session detail is in `EVENT-APP-HANDOFF.md` (root). This is a summary through
Session 16 / git `77dcf5c`.*

- **S1-2:** Forked from Corso (estate app). Installed project rules, stripped billing/facilities/
  household/marketplace/knowledge-base nav, removed demo logins, rebranded core UI + landing page to
  Corsvent. Stood up the dedicated Appwrite project/database; fixed seed data.
- **S3:** Phase 1 vertical slice - `events`/`guests` tables, event CRUD, guest list, 6-digit code +
  QR passes, WhatsApp share, gate check-in by code. New screens under `components/events/`.
- **S4-5:** Live bug fixes - Appwrite 1.9 schema rule (`required:false` + default), Organizer role
  label, in-app organizer-workspace edit; relabeled Estate->Organizer copy.
- **S6-7:** Nav sweep to event language; demo-day polish - organizer/gate dashboards, QR camera
  scanning (BarcodeDetector), live counters.
- **S8:** Recorded architecture rules 6A (proxy-only), 6B (offline queue), 6C (house-pattern route).
- **S9:** Per-scan gate log (`checkins`), offline queue (`lib/gate-offline.ts`), CSV upload, Reports
  rebuild, deleted many stale estate routes.
- **S10-11:** Fixed table provisioning cold-start timeout (targeted `ensureAppwriteTablesExist`),
  form-reset crash, honest errors; event-shaped Settings (module toggles).
- **S12:** iPhone QR scanning via `jsqr`; deleted 17 dead estate components from `pages.tsx`.
- **S13:** VIP Parking module (`vip_plates`, register + car-gate arrival) behind `plate_capture`.
- **S14:** Free public RSVP page `/e/<eventId>` (idempotent by phone).
- **S15:** Event editing + guest search.
- **S16 (this batch):** Verified/shipped S15 (it had been left uncommitted); cleaned estate copy off
  the Super Admin dashboard; added event details + a downloadable QR invite image to the guest pass;
  added camera **plate scanning** to VIP Parking (reused the existing ANPR scanner - cloud Plate
  Recognizer + tesseract fallback); wrote this docs set. Still pending: full end-to-end test pass;
  the workspace-detail "fusion" fix; per-event microsite; reset-password action; larger V2 vision.

## Roadmap / vision
See `docs/CORSVENT-SCOPE.md` (section 8) for near-term fusion fixes and the expanded product vision
(registration + abstract collection, networking, analytics, hybrid + smart badges, marketing
automation, floor-plan management, exhibitor management). Paystack stays out until an account exists;
resident/CSO portal removal awaits an explicit decision.
