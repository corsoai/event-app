# Corso

A modern Next.js + TypeScript Progressive Web App for gated estate and community management. The MVP focuses on visitor access, resident management, billing/payment tracking, complaints, announcements, digital IDs, admin reporting, and role-based dashboards.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Appwrite Sites deployment
- Optional legacy Supabase Auth and Postgres schema
- Manual PWA manifest and service worker
- Mobile-first resident navigation and desktop admin sidebar

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env.local`.

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ESTATE_APP_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_LOCAL_DEMO=true
NEXT_PUBLIC_APPWRITE_PROJECT_ID=lbsview-estate
NEXT_PUBLIC_APPWRITE_PROJECT_NAME=LBS View Estate
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
APPWRITE_DATABASE_ID=lbsview_estate
# CORSO_APPWRITE_API_KEY=server-api-key-with-users-and-tablesdb-access
```

The current Appwrite Sites deployment runs with local demo mode enabled while the backend is migrated to Appwrite. Do not set placeholder Supabase values in Appwrite environment variables. If Supabase variables are not set, the login page supports local demo routing so the MVP can be reviewed without a backend. When Supabase is configured, local demo login is disabled unless `NEXT_PUBLIC_ENABLE_LOCAL_DEMO=true`.

## Appwrite Sites Deployment

Production URL:

```text
https://lbsview-estate.appwrite.network
```

Appwrite project:

```text
Project ID: lbsview-estate
Endpoint: https://fra.cloud.appwrite.io/v1
Site ID: 6a1f926d0037a05007c7
```

Site settings:

```text
Repository: corsoai/lbsview-estate
Branch: main
Framework: Next.js
Root directory: ./
Install command: npm install
Build command: npm run build
Start command: bash helpers/next-js/server.sh
Output directory: ./.next
```

Site environment variables:

```bash
NEXT_PUBLIC_APP_URL=https://lbsview-estate.appwrite.network
NEXT_PUBLIC_ESTATE_APP_URL=https://lbsview-estate.appwrite.network
NEXT_PUBLIC_ENABLE_LOCAL_DEMO=true
NEXT_PUBLIC_APPWRITE_PROJECT_ID=lbsview-estate
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
APPWRITE_DATABASE_ID=lbsview_estate
CORSO_APPWRITE_API_KEY=server-api-key-with-users-and-tablesdb-access
```

Backend migration notes are tracked in `docs/appwrite-migration-plan.md`. The target model is property first, unit second, resident third, with online payment webhooks updating bills, balances, reports, and audit logs automatically.

## Appwrite Resident Import

Admin import controls are available at `/admin/residents` under `Appwrite import`.

1. Generate the private preview with `.\scripts\lbsview-resident-import-preview.ps1 -WorkbookPath "C:\Users\MICROSOFT PC\Desktop\AI BUILDER\LBSView Resident Data.xlsx"`.
2. Sign in as estate admin or super admin.
3. Open `/admin/residents`.
4. Confirm `CORSO_APPWRITE_API_KEY` is configured with Auth Users and TablesDB permissions.
5. Click `Setup schema`.
6. Upload `.local-import/lbsview-onboarding-preview.json`.
7. Review the dry-run counts, then click `Import`.

The importer writes only approved rows. Rows flagged for review, unknown property groups, blank unit IDs, and duplicate active residents on one unit are skipped for manual cleanup.

## Demo Accounts

All default accounts use `Admin247#`.

- Super Admin: `super@corso.test`
- Estate Admin: `admin@lbsview.test`
- Resident: `resident@lbsview.test`
- Security Guard: `security@lbsview.test`

## Local Account Approval Demo

On localhost, residents should use `/signup` to request access. The request is saved in browser local storage and does not become an active login until an estate admin approves it.

Approval flow:

1. Resident opens `/signup`.
2. Resident enters name, phone number, password, role, and estate.
3. Resident submits the access request.
4. Estate admin logs in with `admin@lbsview.test / Admin247#`.
5. Admin opens `/admin/residents`.
6. Admin approves the pending access request.
7. The resident can now log in with the phone number and password they submitted.

With Appwrite configured, admin-created users are created in Appwrite Auth and mirrored into the Appwrite `profiles`, `properties`, `units`, and `residents` tables.

## Routes

Public:

- `/`
- `/login`
- `/signup`
- `/forgot-password`

Admin:

- `/admin`
- `/admin/estate`
- `/admin/residents`
- `/admin/visitors`
- `/admin/sos-alerts`
- `/admin/bills`
- `/admin/payments`
- `/admin/complaints`
- `/admin/announcements`
- `/admin/digital-ids`
- `/admin/knowledge-base`
- `/admin/reports`
- `/admin/settings`

Resident:

- `/resident`
- `/resident/sos`
- `/resident/invite-visitor`
- `/resident/visitors`
- `/resident/bills`
- `/resident/payments`
- `/resident/new-complaint`
- `/resident/complaints`
- `/resident/announcements`
- `/resident/digital-id`
- `/resident/household`
- `/resident/knowledge-base`

Security:

- `/security`
- `/security/sos-alerts`
- `/security/verify-visitor`
- `/security/expected-visitors`
- `/security/logs`
- `/security/verify-id`

Super Admin:

- `/super-admin`
- `/super-admin/estates`
- `/super-admin/reports`

Other:

- `/marketplace`

## Supabase Setup

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `supabase/schema.sql`.
4. Run `supabase/seed.sql`.
5. Create auth users matching the demo emails or invite real users.
6. Run `supabase/link-demo-auth-users.sql` to connect matching auth users to `profiles.auth_user_id`.

The schema includes these MVP tables:

- `estates`
- `profiles`
- `access_requests`
- `residents`
- `household_members`
- `domestic_staff`
- `vehicles`
- `visitors`
- `visitor_logs`
- `digital_ids`
- `bills`
- `payments`
- `complaints`
- `emergency_alerts`
- `announcements`
- `knowledge_base`
- `activity_logs`

Row-level security policies enforce estate scoping and role-based access at the database layer.

For production demo accounts, create matching Supabase Auth users, then update `profiles.auth_user_id` to match each auth user ID. Local demo passwords do not work online unless local demo mode is explicitly enabled.

## Panic / SOS Setup

The SOS feature adds:

- Resident emergency alert submission at `/resident/sos`
- Security response console at `/security/sos-alerts`
- Estate admin oversight at `/admin/sos-alerts`
- Device speaker siren after security/admin taps `Enable alert sound`
- Supabase Realtime refresh for `emergency_alerts` while the app is open

For a fresh Supabase setup, run the current `supabase/schema.sql` and `supabase/seed.sql`.

If your database already has the older SOS test schema, run this before deploying the hardened version:

```sql
alter type public.emergency_alert_status add value if not exists 'cancelled';
```

Then confirm Realtime is enabled for `public.emergency_alerts` in Supabase so security/admin dashboards receive new SOS alerts immediately while open. Browser audio still requires each guard/admin device to tap `Enable alert sound` once.

## PWA Notes

The project includes:

- `public/manifest.webmanifest`
- `public/sw.js`
- `public/offline.html`
- Corso PNG app icons in `public/icons`

The service worker registers in production builds. Run this to test the installable PWA flow:

```bash
npm run build
npm run start
```

## Future Payment And Security Extensions

The MVP tracks bills, payments, visitor access, and gate logs. The Appwrite schema also reserves production tables for:

- resident virtual bank accounts through Monnify, GTBank Squad, Paystack/Titan, or another provider
- estate dues subscriptions and recurring bill generation
- payment intents and gateway webhook idempotency logs
- guard QR checkpoints and patrol scan events
- security incidents and Chief Security Officer review notes

Payment gateways should confirm through verified webhooks before updating `payments`, `bills`, reports, and `audit_logs`. Guard checkpoint and CSO dashboards should be built on top of `guard_checkpoints`, `guard_patrol_events`, `security_incidents`, and `cso_reviews`.
