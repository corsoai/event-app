# Plan: Vehicle/ANPR module + multi-vertical demo strategy

## Where we are
- Cloud ANPR (Plate Recognizer, free 2,500/mo) reads plates reliably; guard confirms + picks vehicle class.
- On-device Tesseract is the offline-only fallback.
- **Gap:** scans are in-memory only (session list) — they vanish on reload. Nothing is recorded.

---

## Part A — Vehicle/ANPR module roadmap

### Phase 1 — Persistence + entry/exit log  ← building now
New collection `vehicle_logs`:
- `plate`, `vehicleClass`, `direction` (in/out), `gate`/`postLabel`
- `guardId`, `guardName`, `scannedAt`
- `visitorId`, `visitorCode`, `residentId` (links, filled later by Phase 3)
- `knownVehicleId`, `matchStatus` (known / unknown / visitor / watchlist) — filled by Phase 2/3/4
- `region`, `score`, `rawRead`, `note`
UI: add an **In / Out** toggle on the scan-confirm step; "Confirm & log" writes to the backend; a **Recent vehicle log** view (search by plate, filter by date/direction).

### Phase 2 — Vehicle registry / whitelist
New collection `vehicles`: `plate`, `ownerType` (resident/staff/tenant/member), `ownerName`, `ownerRef`, `vehicleClass`, `makeModel`, `color`, `status` (active/blocked), `notes`.
On scan: match plate → show **"Known — <name>"** or **"Unknown vehicle."** Known = fast pass.

### Phase 3 — Visitor-code ↔ plate linking + auto check-out  ← headline feature
- When a resident invites a visitor (existing 6-digit code), optionally capture/expect a plate.
- At gate: scanning the plate pulls up the matching visitor + code (no manual entry); logs entry tied to that visitor.
- On exit: ANPR re-scan auto-matches and **checks the visitor out**; **flags if a different plate** leaves on that visit.

### Phase 4 — Watchlist / blacklist + alerts
`vehicle_watchlist`: flagged plates (ex-staff, banned, stolen). Scan hit → guard alert / SOS escalation.

### Phase 5 — Vehicle dashboard + reports
Vehicles currently inside, daily traffic in/out, dwell time, search-by-plate history, CSV export.

---

## Part B — Multi-vertical demo strategy (one codebase, many demos)

The platform core = **access control + visitors + vehicles/ANPR + staff + attendance + facilities/work-orders + SOS**. Each vertical is a *reconfiguration*, not a rebuild: terminology, enabled modules, roles, branding, and which flow is emphasized.

Recommended mechanism: an **`estateType` / vertical config** on the estate record — a small config object that sets the display terminology map, enabled modules, and theme. One build serves all demos; you flip a setting per demo tenant.

### Verticals and what changes

**Residential estate (current).** Residents, visitor codes, vehicles, SOS, bills. Baseline.

**Clubhouse / resort.** "Residents" → **Members**; visitors → **Guests / day-passes**; add **amenity access** (pool, gym, court booking), **valet/vehicle** log. Emphasis: member recognition + guest passes + vehicle/valet.

**Hotel.** Guests via **reservation = access credential**; "household" → **room/booking**; visitor mgmt for guest visitors; **valet/parking** via ANPR; staff + attendance (already built). Emphasis: reservation-driven access + parking.

**Commercial / office / mall.** "Residents" → **Tenants/Employees**; visitors → **visitors + deliveries tied to appointments**; **parking access + occupancy/billing** via ANPR; facilities/work-orders (already built). Emphasis: tenant parking + visitor/delivery + facilities.

**Factory / industrial / warehouse.** "Residents" → **Workers** (shift + attendance already built); **contractors**; **fleet/truck** tracking via ANPR matched to dispatch; **facilities/asset + work orders** (already built); safety/compliance. Emphasis: fleet/truck logs + workforce attendance + assets.

### What's reusable as-is across all verticals
Access codes, ANPR + vehicle logs, staff registry + attendance, facilities + work orders, SOS, dashboards. ~80% shared; per-vertical work is mostly labels, branding, and which 1–2 flows lead.

### Demo-readiness checklist (per vertical)
1. Set `estateType` + terminology map + theme/branding.
2. Seed demo data (members/guests/tenants/workers + vehicles + a few logs).
3. Pick the 1–2 "hero" flows to showcase.
4. Spin up a demo tenant/estate; record a short walkthrough.

---

## Suggested order
1. Phase 1 persistence (now) → 2. Phase 3 visitor linking → 3. Phase 2 registry/whitelist → 4. vertical config scaffolding → 5. watchlist + dashboard.
