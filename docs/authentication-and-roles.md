# Authentication and roles

*Verified against `middleware.ts`, `lib/auth.ts`, `lib/appwrite/session-context.ts`, and the event
API routes at git `77dcf5c`.*

## Login flow
Login is by phone OR email. A phone maps internally to `phone.<digits>@corso.local`.
`app/api/appwrite/auth/login/route.ts` authenticates against Appwrite and sets cookies:
`corso_role`, `corso_appwrite_user`, `corso_appwrite_session` (no explicit domain => host-scoped to
event.corso.ng; no bleed with corso.ng). Logout: `app/api/appwrite/auth/logout/route.ts`.
DO NOT change the login mechanics in `components/auth/auth-card.tsx`, `lib/appwrite/users.ts`, or
`lib/appwrite/session-context.ts`.

## Accounts & passwords
Accounts are created by a Super Admin (and Organizers, scoped) via Users & Roles; a one-time
temporary password is shown on screen at creation. Passwords are hashed in Appwrite and are NOT
recoverable - only resettable to a new temporary password. (A dedicated reset-password UI action is
a known gap - see known-issues.md / feature-status.md.)

## Middleware route gating (`middleware.ts`)
```
/admin        -> estate_admin, super_admin
/super-admin  -> super_admin
/cso          -> cso, estate_admin, super_admin        (legacy)
/resident     -> resident                              (legacy)
/security     -> security_guard
```
No `corso_role` cookie -> redirect to `/login?next=...`. Wrong role -> redirect to the role home
(`super_admin`->/super-admin, `estate_admin`->/admin, `security_guard`->/security,
`cso`->/cso, `resident`->/resident, `vendor`->/resident/digital-id).

## Roles (`lib/auth.ts roleLabels`)
`super_admin` = "Super Admin"; `estate_admin` = **"Organizer"**; `security_guard` = **"Gate Staff"**;
legacy `cso`, `resident`, `vendor`. Internally the tenant workspace is an `estate`; UI calls it the
organizer workspace.

## API authorization (verified)
All event routes call `resolveSessionContext(request, { allowedRoles })`:
- `admin/events`, `admin/events/guests`, `admin/events/vip-plates`, `super/estates`,
  `estate-modules` -> organizer/super-admin (`requireOrganizer` in events.ts).
- `events` (gate list), `events/checkin`, `events/vip-arrival` -> gate staff + organizer
  (`requireGateStaff`).
- `security/plate-recognize` -> security_guard, cso, estate_admin, super_admin.
- `public/events/[eventId]` -> intentionally UNAUTHENTICATED (public RSVP); GET returns only
  public-safe fields, POST issues a pass (guarded: name/phone validation, per-event cap, same-phone
  returns existing pass).

## Isolation
`scopeForContext` scopes non-super-admins to their `estateId`; event child rows are keyed by
`eventId`. Identity for writes always comes from the session, never the request body. Fallback debt:
`APPWRITE_LBSVIEW_ESTATE_ID` (see known-issues.md).
