# Appwrite schema

*Event tables verified in `lib/appwrite/schema.ts` at git `77dcf5c`. Column lists are the declared
keys; types noted where checked. Inherited estate tables are summarized, not exhaustively listed.*

## Project & database
Corsvent uses its OWN dedicated Appwrite project + database on the shared self-hosted server
(endpoint via `APPWRITE_ENDPOINT` / `NEXT_PUBLIC_APPWRITE_ENDPOINT`; ids via
`NEXT_PUBLIC_APPWRITE_PROJECT_ID` / `APPWRITE_DATABASE_ID`). NEVER point these at
`lbsview-estate` / `lbsview_estate`. Tables auto-provision on first use.

## Event tables
### events  (table id `events`)
`name` string, `venue` string, `address` string, `startAt` datetime, `endAt` datetime, `gates`
string, `status` string (draft|live|ended), `createdBy` string. `estateId` is set on write (owning
workspace). Status/category columns follow `required:false` + `default` (Appwrite 1.9 rule).

### guests  (table id `guests`)
`eventId` (-> events), `fullName`, `phone`, `email`, `category` (regular|vip|staff), `code`
(unique 6-digit per event), `status` (invited|checked-in|checked-out|cancelled), `checkedInAt`,
`checkedInGate`, `checkedInBy`. `estateId` set on write.

### checkins  (table id `checkins`) - per-scan audit log (rule 6C)
`eventId` (-> events), `guestId` (-> guests), `guestName`, `category`, `code`, `gate`, `scannedBy`
(session profileId), `scannedAt` (server time), `capturedAt` (client/offline time), `result`
(includes "duplicate"). One row per scan attempt; logging is non-fatal-wrapped so it never breaks a
check-in.

### vip_plates  (table id `vip_plates`)
`eventId` (-> events), `plate` (normalized A-Z0-9), `label` (owner/name), `status`
(expected|arrived), `arrivedAt`, `arrivedGate`, `loggedBy` (session profileId). `estateId` set on write.

## Relationships
`events (1) -> (N) guests | checkins | vip_plates` by `eventId`. `checkins.guestId -> guests`. All
event rows belong to a workspace (`estateId`). No Appwrite relationship attributes are used; joins
are done in code by id.

## Inherited estate tables (present from the fork)
estates, profiles, access_requests, properties, units, residents, resident_unit_history, bills,
payments, resident_virtual_accounts, plus security patrols/checkpoints/staff/attendance,
vehicle_logs, sos, announcements, complaints, facilities, household, knowledge_base, visitors. These
back legacy screens (mostly nav-hidden / Deprecated - see feature-status.md). Do not extend them for
event features.

## Provisioning helpers
`ensureAppwriteTablesExist(["events","guests","checkins","vip_plates"])` (targeted, memoized,
self-healing) provisions/repairs only the named tables. `appwriteUpsertRow` does GET->PATCH/POST for
safe partial updates. `safeAppwriteId(prefix, seed)` builds deterministic ids.
