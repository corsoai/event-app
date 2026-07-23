# Known issues & technical debt

*Evidence-based, with file references, at git `77dcf5c`. Severity is this author's judgment.*

## High
- **`lbsview-estate` isolation fallback.** `scopeForContext` (in `lib/appwrite/events.ts` and
  `lib/appwrite/vip-parking.ts`) falls back to `APPWRITE_LBSVIEW_ESTATE_ID = "lbsview-estate"`
  (`lib/appwrite/server.ts:9`) when a session has no `estateId`. A session missing `estateId` could
  read/write a shared fallback workspace named after the OTHER product. Audit how `estateId` is set
  on every session/role before relying on isolation for multi-tenant production.
- **No automated tests.** No `test` npm script; only 3 legacy estate smoke scripts. No event-feature
  coverage. Combined with no end-to-end click-through, runtime correctness of most "Partial" features
  is unverified.

## Medium
- **Organizer workspace-detail screen is estate-shaped.** `/super-admin/estates/[estateId]`
  (`EstateDetailPage` in `pages.tsx`) still renders Residents/Visitors/Bills/Complaints tiles and a
  resident directory from dead/estate data - misleading for an event platform. Needs event metrics
  + an "events in this workspace" list.
- **Super Admin dashboard is minimal.** Shows only a real workspace count; no cross-platform event
  metrics yet.
- **Landing page advertises unbuilt features** (`app/page.tsx`): Paystack ticketing and some comms
  are not implemented.
- **Legacy dead code in `pages.tsx`** and legacy `lib/appwrite/*` modules (accounting, billing-*,
  complaints, facilities, household, knowledge-base, residents, visitors, vehicles, monnify) remain;
  removal pending decisions on resident/CSO portals.
- **No in-app reset-password action** surfaced for gate/organizer accounts (passwords are hashed and
  unrecoverable; only a reset path helps).

## Low / cosmetic
- `package.json` name is `corso-estate`; `.env.example` and several `scripts/` still say
  Corso/lbsview.
- Mixed line endings: files touched recently are LF; the rest are CRLF. Device-side `git status`
  shows phantom CRLF-only "modified" files - trust `git diff HEAD` content and Windows git.
- `components/dashboard/pages.tsx` has a harmless pre-existing brace off-by-one inside a string
  literal (builds green); verify edits by preserving the delta, not by expecting perfect balance.
- Two `next.config.*` files exist (`.mjs` and `.ts`) - confirm which Next uses.

## Operational notes for agents editing on the mounted repo
Some tooling cannot delete/rename files on the mount (`git checkout`/`rm` may fail "Operation not
permitted"); restore a file by writing exact `git show HEAD:<file>` bytes in place. The cloud
"uploads" mirror only contains explicitly-staged files - inspect the real tree via the device shell.
