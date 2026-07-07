# Corso

A modern Next.js + TypeScript Progressive Web App for gated estate and community management. The MVP focuses on visitor access, resident management, billing/payment tracking, complaints, announcements, digital IDs, admin reporting, and role-based dashboards.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Appwrite Sites deployment
- Appwrite Auth and Appwrite TablesDB
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
MONNIFY_API_KEY=your_monnify_api_key
MONNIFY_SECRET_KEY=your_monnify_secret_key
MONNIFY_CONTRACT_CODE=your_contract_code
MONNIFY_BASE_URL=https://sandbox.monnify.com
```

The current Appwrite Sites deployment uses Appwrite Auth and Appwrite TablesDB. Local demo mode is only for localhost development when `NEXT_PUBLIC_ENABLE_LOCAL_DEMO=true`.

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
MONNIFY_API_KEY=your_monnify_api_key
MONNIFY_SECRET_KEY=your_monnify_secret_key
MONNIFY_CONTRACT_CODE=your_contract_code
MONNIFY_BASE_URL=https://sandbox.monnify.com
```

Backend migration notes are tracked in `docs/appwrite-migration-plan.md`. The target model is property first, unit second, resident third, with online payment webhooks updating bills, balances, reports, and audit logs automatically.

## Monnify Payment Links

Resident online payments use Monnify payment links in Phase 1. Residents can pay a specific outstanding bill or choose 1, 3, 6, or 12 subscription months from `/resident/bills`. Monnify redirects back to `/api/monnify/confirm`, where the transaction is verified before the existing Appwrite allocation flow updates `payments`, `bills`, resident balances, reports, and audit logs.

Required server environment variables:

```bash
MONNIFY_API_KEY=your_monnify_api_key
MONNIFY_SECRET_KEY=your_monnify_secret_key
MONNIFY_CONTRACT_CODE=your_contract_code
MONNIFY_BASE_URL=https://sandbox.monnify.com
NEXT_PUBLIC_APP_URL=https://lbsview-estate.appwrite.network
```

Use `MONNIFY_BASE_URL=https://sandbox.monnify.com` for testing and `MONNIFY_BASE_URL=https://api.monnify.com` for production. Manual payment recording remains available in the admin payment screen for bank transfer, POS, cash, and WhatsApp receipt updates.

### Monnify Reserved Accounts And Webhooks

Webhook URL to register in the Monnify dashboard:

```text
https://lbsview-estate.appwrite.network/api/webhooks/monnify
```

Register this URL under Monnify Webhook settings. The webhook signature secret must match the same `MONNIFY_SECRET_KEY` configured in the Appwrite Sites environment. The app verifies the `Monnify-Signature` header with HMAC-SHA512 before processing any event.

To assign a reserved virtual account:

1. Sign in as estate admin or super admin.
2. Open `/admin/residents`.
3. Select a resident.
4. Click `Assign virtual account` in the resident detail panel.
5. The generated Monnify account number, bank name, and account name are saved to `resident_virtual_accounts`.

Residents see their dedicated payment account on `/resident/payments`. Bank transfers into that account are processed by the Monnify webhook, then allocated through the same Appwrite payment allocation flow used by online payment links and manual admin payments.

To switch from sandbox to production, change:

```bash
MONNIFY_BASE_URL=https://api.monnify.com
```

Then update the Monnify dashboard webhook URL and credentials for the production Monnify account.

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

All default accounts use `Corso@2026!`.

- Super Admin: `super@corso.ng`
- Estate Admin: `admin@corso.ng`
- Resident: `resident@corso.ng`
- Security Guard: `security@corso.ng`
- CSO: `cso@corso.ng`

## Local Account Approval Demo

On localhost, residents should use `/signup` to request access. The request is saved in browser local storage and does not become an active login until an estate admin approves it.

Approval flow:

1. Resident opens `/signup`.
2. Resident enters name, phone number, password, role, and estate.
3. Resident submits the access request.
4. Estate admin logs in with `admin@corso.ng / Corso@2026!`.
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

## Appwrite TablesDB Setup

The Appwrite schema includes these MVP tables:

- `estates`
- `profiles`
- `access_requests`
- `residents`
- `visitors`
- `visitor_logs`
- `bills`
- `payments`
- `resident_virtual_accounts`
- `resident_subscriptions`
- `payment_intents`
- `payment_webhook_events`
- `guard_checkpoints`
- `guard_patrol_events`
- `security_incidents`
- `cso_reviews`
- `audit_logs`

Use `/admin/system` to verify Appwrite environment variables and initialize/repair the TablesDB schema.

## Panic / SOS Setup

The SOS feature adds:

- Resident emergency alert submission at `/resident/sos`
- Security response console at `/security/sos-alerts`
- Estate admin oversight at `/admin/sos-alerts`
- Device speaker siren after security/admin taps `Enable alert sound`

Browser audio still requires each guard/admin device to tap `Enable alert sound` once.

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
