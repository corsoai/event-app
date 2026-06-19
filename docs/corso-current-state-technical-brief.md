# Corso LBSView Estate - Current-State Technical Brief

Generated: 2026-06-18  
Scope: current codebase inspection only. This document describes what is present in the repository now, not future plans. Where a point is inferred from code structure rather than directly executed in this audit, it is marked as an inference.

## 1. Stack And Structure

### Runtime Stack

- Frontend/runtime framework: Next.js 15 App Router.
- UI framework: React 19.
- Styling: Tailwind CSS with custom utility classes and a light/dark theme toggle.
- Language: TypeScript.
- Icons: `lucide-react`.
- QR generation: `qrcode`.
- QR scanning: `jsqr`.
- Backend access pattern: Next.js API routes call Appwrite REST APIs server-side.
- Primary backend: Appwrite TablesDB/Auth via REST.
- Payment integration: Monnify client and webhook code exists.
- Legacy/local/demo support: local-store and demo-data modules still exist and are used as fallbacks in some login/UI flows.

### Key Package Scripts

- `npm run dev`: Next.js dev server.
- `npm run dev:local`: local dev server on port 3012.
- `npm run build`: production build.
- `npm run start`: Next.js start.
- `npm run typecheck`: `tsc -p tsconfig.typecheck.json --noEmit`.
- `npm run verify`: typecheck plus production build.

### Folder Layout

- `app/`: Next.js routes.
  - `(auth)/login`, `(auth)/signup`, `(auth)/forgot-password`
  - `admin/*`
  - `resident/*`
  - `security/*`
  - `cso/*`
  - `super-admin/*`
  - `api/*`
- `components/`: reusable UI, auth, layout, dashboard/page components.
- `components/dashboard/pages.tsx`: large central file containing most admin, resident, security, CSO, marketplace, SOS, reports, and page-level UI.
- `components/layout/nav.ts`: role navigation configuration.
- `components/layout/app-shell.tsx`: shared authenticated layout, sidebar, theme, route prefetch, SOS badge polling.
- `components/layout/mobile-bottom-nav.tsx`: mobile bottom nav.
- `lib/appwrite/`: Appwrite server helpers, schema setup, users, residents, accounting, visitors, SOS, patrols, complaints, announcements, knowledge base, billing engine, payment allocation, payment intents, virtual accounts, webhook events.
- `lib/monnify/client.ts`: Monnify API wrapper.
- `lib/local-store.ts`: browser local storage state and legacy/demo local operations.
- `lib/demo-data.ts`: static demo data.
- `functions/`: Appwrite function-related folder exists, but the current application primarily uses Next.js API routes.
- `scripts/`: setup/import/verification scripts.
- `docs/`: project documentation.
- `public/`: static assets, images, service worker.

### Appwrite Client And Server Configuration

Appwrite server configuration is in `lib/appwrite/server.ts`.

Environment variables used:

- `NEXT_PUBLIC_APPWRITE_PROJECT_ID`
- `NEXT_PUBLIC_APPWRITE_ENDPOINT`
- `APPWRITE_ENDPOINT`
- `APPWRITE_DATABASE_ID`
- `CORSO_APPWRITE_API_KEY`
- Fallback API key names also accepted: `APPWRITE_RUNTIME_API_KEY`, `APPWRITE_SERVER_API_KEY`, `APPWRITE_API_KEY`.

Default database ID from code:

- `lbsview_estate`

Default estate ID from code:

- `lbsview-estate`

Important implementation details:

- Server-side Appwrite access uses REST against `/tablesdb/...`.
- Requests include `X-Appwrite-Project`, `X-Appwrite-Key`, and `X-Appwrite-Response-Format: 1.9.5`.
- `setupAppwriteOnboardingSchema()` creates the database and TablesDB tables.
- Tables are created with `rowSecurity: false` and empty table permissions in code. Access control is mainly enforced by the Next.js API routes and middleware, not by Appwrite row-level permissions.
- `appwriteUpsertRow()` writes with `PUT /tablesdb/{databaseId}/tables/{tableId}/rows/{rowId}`.

Runtime note:

- `.env.example` still points examples at Appwrite Cloud (`https://fra.cloud.appwrite.io/v1`).
- The code supports changing endpoint/project/database through environment variables, so the same build can point at self-hosted Appwrite such as `https://api.corso.ng/v1`.

## 2. Appwrite Backend Schema

### Databases

The code defines one Appwrite TablesDB database:

- Database ID: `lbsview_estate`

### Tables

The code defines 26 TablesDB tables in `lib/appwrite/schema.ts`.

Every table except `estates` has an `estateId` field.

### Schema Reference

#### 1. `estates`

Has `estateId`: No.

Fields:

- `name`: string, size 128, required.
- `address`: string, size 255, required.
- `contactEmail`: string, size 128, optional.
- `contactPhone`: string, size 64, optional.
- `gateName`: string, size 128, optional.
- `createdAt`: datetime, optional.
- `updatedAt`: datetime, optional.

Indexes:

- `estate_name_idx`: key index on `name`.

#### 2. `profiles`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `createdAt`: datetime, optional.
- `updatedAt`: datetime, optional.
- `userId`: string, size 64, required.
- `fullName`: string, size 160, required.
- `email`: string, size 160, required.
- `phone`: string, size 64, optional.
- `role`: string, size 32, required.
- `status`: string, size 32, required.
- `houseNumber`: string, size 64, optional.

Indexes:

- `profile_user_unique`: unique index on `userId`.
- `profile_email_unique`: unique index on `email`.
- `profile_estate_idx`: key index on `estateId`.
- `profile_role_idx`: key index on `role`.

#### 3. `access_requests`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `createdAt`: datetime, optional.
- `updatedAt`: datetime, optional.
- `authUserId`: string, size 64, optional.
- `fullName`: string, size 160, required.
- `email`: string, size 160, required.
- `phone`: string, size 64, optional.
- `requestedRole`: string, size 32, required.
- `status`: string, size 32, required.
- `requestedAt`: datetime, required.
- `reviewedAt`: datetime, optional.
- `reviewedBy`: string, size 64, optional.
- `estateName`: string, size 128, optional.

Indexes:

- `access_request_status_idx`: key index on `status`.
- `access_request_estate_idx`: key index on `estateId`.
- `access_request_phone_idx`: key index on `phone`.
- `access_request_email_idx`: key index on `email`.

#### 4. `properties`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `createdAt`: datetime, optional.
- `updatedAt`: datetime, optional.
- `propertyCode`: string, size 32, required.
- `name`: string, size 128, required.
- `description`: string, size 512, optional.
- `street`: string, size 255, optional.
- `legacyName`: string, size 255, optional.
- `status`: string, size 32, required.

Indexes:

- `property_code_unique`: unique index on `estateId`, `propertyCode`.
- `property_status_idx`: key index on `status`.

#### 5. `units`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `createdAt`: datetime, optional.
- `updatedAt`: datetime, optional.
- `propertyId`: string, size 64, required.
- `unitCode`: string, size 32, required.
- `label`: string, size 128, optional.
- `apartmentType`: string, size 128, optional.
- `status`: string, size 32, required.
- `currentResidentId`: string, size 64, optional.
- `moveInDate`: string, size 32, optional.
- `legacyName`: string, size 255, optional.

Indexes:

- `unit_code_unique`: unique index on `estateId`, `unitCode`.
- `unit_property_idx`: key index on `propertyId`.
- `unit_status_idx`: key index on `status`.

#### 6. `residents`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `createdAt`: datetime, optional.
- `updatedAt`: datetime, optional.
- `propertyId`: string, size 64, optional.
- `unitId`: string, size 64, optional.
- `fullName`: string, size 160, required.
- `phone`: string, size 64, optional.
- `email`: string, size 160, optional.
- `residentType`: string, size 32, required.
- `status`: string, size 32, required.
- `moveInDate`: string, size 32, optional.
- `legacyName`: string, size 255, optional.
- `legacyAddress`: string, size 512, optional.
- `sourceRow`: integer, optional.
- `openingOutstanding`: float, optional, default 0.
- `expectedMonthly`: float, optional, default 0.
- `totalPaidAllTime`: float, optional, default 0.
- `advanceCredit`: float, optional, default 0.
- `coverageThroughDate`: string, size 32, optional.
- `nextDueDate`: string, size 32, optional.
- `lastPaymentDate`: string, size 32, optional.
- `lastPaymentAmount`: float, optional, default 0.
- `onboardingStatus`: string, size 32, optional, default `verified`.
- `reviewReasons`: string, size 1024, optional.

Indexes:

- `resident_unit_idx`: key index on `unitId`.
- `resident_status_idx`: key index on `status`.
- `resident_phone_idx`: key index on `phone`.

#### 7. `resident_unit_history`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `createdAt`: datetime, optional.
- `updatedAt`: datetime, optional.
- `residentId`: string, size 64, required.
- `propertyId`: string, size 64, optional.
- `unitId`: string, size 64, required.
- `unitCode`: string, size 32, required.
- `residentStatus`: string, size 32, required.
- `moveInDate`: string, size 32, optional.
- `moveOutDate`: string, size 32, optional.
- `source`: string, size 64, optional.
- `legacyNote`: string, size 512, optional.

Indexes:

- `history_resident_idx`: key index on `residentId`.
- `history_unit_idx`: key index on `unitId`.

#### 8. `bills`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `createdAt`: datetime, optional.
- `updatedAt`: datetime, optional.
- `propertyId`: string, size 64, optional.
- `unitId`: string, size 64, optional.
- `propertyCode`: string, size 64, optional.
- `unitCode`: string, size 64, optional.
- `residentId`: string, size 64, required.
- `category`: string, size 64, required.
- `title`: string, size 160, required.
- `amount`: float, required.
- `paidAmount`: float, optional, default 0.
- `dueDate`: string, size 32, required.
- `billingMonth`: string, size 16, optional.
- `status`: string, size 32, required.
- `createdBy`: string, size 64, optional.

Indexes:

- `bill_resident_idx`: key index on `residentId`.
- `bill_status_idx`: key index on `status`.

#### 9. `payments`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `createdAt`: datetime, optional.
- `updatedAt`: datetime, optional.
- `propertyId`: string, size 64, optional.
- `unitId`: string, size 64, optional.
- `propertyCode`: string, size 64, optional.
- `unitCode`: string, size 64, optional.
- `residentId`: string, size 64, required.
- `billId`: string, size 64, optional.
- `amount`: float, required.
- `reference`: string, size 128, required.
- `processor`: string, size 64, optional.
- `channel`: string, size 64, required.
- `providerReference`: string, size 128, optional.
- `date`: string, size 32, required.
- `status`: string, size 32, required.
- `source`: string, size 64, required.
- `confirmedAt`: datetime, optional.
- `confirmedBy`: string, size 128, optional.
- `recordedBy`: string, size 128, optional.
- `allocations`: string, size 4096, optional.
- `advanceCreditGenerated`: float, optional, default 0.
- `monnifyTransactionRef`: string, size 128, optional.
- `monnifyPaymentRef`: string, size 128, optional.
- `notes`: string, size 1024, optional.

Indexes:

- `payment_reference_unique`: unique index on `reference`.
- `payment_resident_idx`: key index on `residentId`.
- `payment_status_idx`: key index on `status`.

#### 10. `resident_virtual_accounts`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `createdAt`: datetime, optional.
- `updatedAt`: datetime, optional.
- `residentId`: string, size 64, required.
- `propertyId`: string, size 64, optional.
- `unitId`: string, size 64, optional.
- `propertyCode`: string, size 64, optional.
- `unitCode`: string, size 64, optional.
- `provider`: string, size 64, required.
- `accountNumber`: string, size 32, required.
- `accountName`: string, size 160, required.
- `bankName`: string, size 128, optional.
- `bankCode`: string, size 32, optional.
- `providerReference`: string, size 128, optional.
- `status`: string, size 32, required.
- `assignedAt`: datetime, optional.
- `deactivatedAt`: datetime, optional.

Indexes:

- `virtual_account_unique`: unique index on `provider`, `accountNumber`.
- `virtual_account_resident_idx`: key index on `residentId`.
- `virtual_account_status_idx`: key index on `status`.

#### 11. `resident_subscriptions`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `createdAt`: datetime, optional.
- `updatedAt`: datetime, optional.
- `residentId`: string, size 64, required.
- `propertyId`: string, size 64, optional.
- `unitId`: string, size 64, optional.
- `category`: string, size 64, required.
- `amount`: float, required.
- `currency`: string, size 8, optional, default `NGN`.
- `billingCycle`: string, size 32, required.
- `nextDueDate`: string, size 32, required.
- `status`: string, size 32, required.
- `autoBill`: boolean, optional, default true.

Indexes:

- `subscription_resident_idx`: key index on `residentId`.
- `subscription_due_idx`: key index on `nextDueDate`.
- `subscription_status_idx`: key index on `status`.

#### 12. `payment_intents`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `createdAt`: datetime, optional.
- `updatedAt`: datetime, optional.
- `residentId`: string, size 64, required.
- `billId`: string, size 64, optional.
- `subscriptionId`: string, size 64, optional.
- `virtualAccountId`: string, size 64, optional.
- `amount`: float, required.
- `currency`: string, size 8, optional, default `NGN`.
- `reference`: string, size 128, required.
- `processor`: string, size 64, required.
- `channel`: string, size 64, required.
- `checkoutUrl`: string, size 1024, optional.
- `transactionReference`: string, size 128, optional.
- `paymentReference`: string, size 128, optional.
- `status`: string, size 32, required.
- `expiresAt`: datetime, optional.
- `metadata`: string, size 4096, optional.
- `errorMessage`: string, size 1024, optional.

Indexes:

- `payment_intent_reference_unique`: unique index on `reference`.
- `payment_intent_resident_idx`: key index on `residentId`.
- `payment_intent_status_idx`: key index on `status`.

#### 13. `payment_webhook_events`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `createdAt`: datetime, optional.
- `updatedAt`: datetime, optional.
- `provider`: string, size 64, required.
- `eventId`: string, size 128, required.
- `eventType`: string, size 128, required.
- `reference`: string, size 128, optional.
- `status`: string, size 32, required.
- `receivedAt`: datetime, required.
- `processedAt`: datetime, optional.
- `payloadHash`: string, size 128, optional.
- `errorMessage`: string, size 512, optional.

Indexes:

- `webhook_event_unique`: unique index on `provider`, `eventId`.
- `webhook_reference_idx`: key index on `reference`.
- `webhook_status_idx`: key index on `status`.

#### 14. `visitors`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `createdAt`: datetime, optional.
- `updatedAt`: datetime, optional.
- `residentId`: string, size 64, required.
- `visitorName`: string, size 160, required.
- `phone`: string, size 64, optional.
- `visitDate`: string, size 32, required.
- `arrivalTime`: string, size 16, required.
- `purpose`: string, size 255, optional.
- `count`: integer, optional, default 1.
- `code`: string, size 16, required.
- `expiresAt`: datetime, optional.
- `status`: string, size 32, required.

Indexes:

- `visitor_code_unique`: unique index on `code`.
- `visitor_resident_idx`: key index on `residentId`.
- `visitor_status_idx`: key index on `status`.

#### 15. `visitor_logs`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `createdAt`: datetime, optional.
- `updatedAt`: datetime, optional.
- `visitorId`: string, size 64, required.
- `visitorName`: string, size 160, required.
- `code`: string, size 16, required.
- `gateName`: string, size 128, optional.
- `guardName`: string, size 128, optional.
- `entryTime`: string, size 64, optional.
- `exitTime`: string, size 64, optional.
- `decision`: string, size 32, required.

Indexes:

- `visitor_log_visitor_idx`: key index on `visitorId`.
- `visitor_log_code_idx`: key index on `code`.

#### 16. `guard_checkpoints`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `createdAt`: datetime, optional.
- `updatedAt`: datetime, optional.
- `checkpointId`: string, size 64, optional.
- `checkpointCode`: string, size 64, required.
- `checkpointName`: string, size 128, optional.
- `name`: string, size 128, required.
- `gateName`: string, size 128, optional.
- `locationLabel`: string, size 255, optional.
- `qrToken`: string, size 128, required.
- `latitude`: float, optional.
- `longitude`: float, optional.
- `allowedRadius`: integer, optional, default 25.
- `status`: string, size 32, required.
- `sortOrder`: integer, optional, default 0.

Indexes:

- `checkpoint_code_unique`: unique index on `estateId`, `checkpointCode`.
- `checkpoint_token_unique`: unique index on `qrToken`.
- `checkpoint_status_idx`: key index on `status`.

#### 17. `guard_patrol_events`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `createdAt`: datetime, optional.
- `updatedAt`: datetime, optional.
- `checkpointId`: string, size 64, required.
- `checkpointCode`: string, size 64, required.
- `checkpointName`: string, size 128, optional.
- `qrToken`: string, size 128, optional.
- `guardId`: string, size 64, optional.
- `guardProfileId`: string, size 64, required.
- `guardName`: string, size 128, optional.
- `scanType`: string, size 32, required.
- `scannedAt`: datetime, required.
- `status`: string, size 32, required.
- `deviceLatitude`: float, optional.
- `deviceLongitude`: float, optional.
- `checkpointLatitude`: float, optional.
- `checkpointLongitude`: float, optional.
- `allowedRadius`: integer, optional.
- `distanceMeters`: float, optional.
- `isGpsVerified`: boolean, optional, default false.
- `isOfflineLog`: boolean, optional, default false.
- `deviceLabel`: string, size 128, optional.
- `note`: string, size 512, optional.

Indexes:

- `patrol_checkpoint_idx`: key index on `checkpointId`.
- `patrol_guard_idx`: key index on `guardProfileId`.
- `patrol_scanned_idx`: key index on `scannedAt`.

#### 18. `security_incidents`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `createdAt`: datetime, optional.
- `updatedAt`: datetime, optional.
- `incidentType`: string, size 64, required.
- `alertType`: string, size 64, optional.
- `severity`: string, size 32, required.
- `status`: string, size 32, required.
- `reportedByRole`: string, size 32, required.
- `reportedByProfileId`: string, size 64, optional.
- `assignedToProfileId`: string, size 64, optional.
- `residentName`: string, size 160, optional.
- `unitCode`: string, size 64, optional.
- `locationLabel`: string, size 255, optional.
- `summary`: string, size 160, required.
- `details`: string, size 2048, optional.
- `openedAt`: datetime, required.
- `acknowledgedAt`: datetime, optional.
- `acknowledgedBy`: string, size 160, optional.
- `respondingAt`: datetime, optional.
- `resolvedAt`: datetime, optional.

Indexes:

- `incident_status_idx`: key index on `status`.
- `incident_severity_idx`: key index on `severity`.
- `incident_assignee_idx`: key index on `assignedToProfileId`.

#### 19. `cso_reviews`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `createdAt`: datetime, optional.
- `updatedAt`: datetime, optional.
- `incidentId`: string, size 64, required.
- `csoProfileId`: string, size 64, required.
- `decision`: string, size 64, required.
- `note`: string, size 2048, optional.
- `reviewedAt`: datetime, required.
- `followUpDate`: string, size 32, optional.
- `status`: string, size 32, required.

Indexes:

- `cso_review_incident_idx`: key index on `incidentId`.
- `cso_review_profile_idx`: key index on `csoProfileId`.
- `cso_review_status_idx`: key index on `status`.

#### 20. `audit_logs`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `createdAt`: datetime, optional.
- `updatedAt`: datetime, optional.
- `actor`: string, size 128, required.
- `action`: string, size 160, required.
- `entityType`: string, size 64, required.
- `entityId`: string, size 64, required.
- `metadata`: string, size 4096, optional.

Indexes:

- `audit_entity_idx`: key index on `entityType`, `entityId`.

#### 21. `announcements`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `title`: string, size 160, required.
- `message`: string, size 4096, required.
- `priority`: string, size 32, required.
- `targetRole`: string, size 32, required.
- `createdBy`: string, size 64, required.
- `createdByName`: string, size 160, required.
- `publishedAt`: datetime, optional.
- `expiresAt`: datetime, optional.
- `status`: string, size 32, required.
- `isPinned`: boolean, optional, default false.
- `createdAt`: datetime, required.
- `updatedAt`: datetime, required.

Indexes:

- `announcement_estate_status_idx`: key index on `estateId`, `status`.
- `announcement_target_idx`: key index on `targetRole`.
- `announcement_published_idx`: key index on `publishedAt`.

#### 22. `complaints`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `residentId`: string, size 64, required.
- `residentName`: string, size 160, required.
- `unitCode`: string, size 64, required.
- `propertyCode`: string, size 64, required.
- `category`: string, size 32, required.
- `priority`: string, size 32, required.
- `subject`: string, size 160, required.
- `description`: string, size 4096, required.
- `status`: string, size 32, required.
- `assignedTo`: string, size 64, optional.
- `assignedToName`: string, size 160, optional.
- `adminResponse`: string, size 4096, optional.
- `resolvedAt`: datetime, optional.
- `createdAt`: datetime, required.
- `updatedAt`: datetime, required.

Indexes:

- `complaint_resident_idx`: key index on `residentId`.
- `complaint_status_idx`: key index on `status`.
- `complaint_priority_idx`: key index on `priority`.
- `complaint_created_idx`: key index on `createdAt`.

#### 23. `knowledge_base`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `title`: string, size 160, required.
- `content`: string, size 8192, required.
- `category`: string, size 32, required.
- `targetRole`: string, size 32, required.
- `createdBy`: string, size 64, required.
- `createdByName`: string, size 160, required.
- `isPublished`: boolean, optional, default false.
- `viewCount`: integer, optional, default 0.
- `sortOrder`: integer, optional, default 0.
- `tags`: string, size 1024, optional.
- `createdAt`: datetime, required.
- `updatedAt`: datetime, required.

Indexes:

- `knowledge_category_idx`: key index on `category`.
- `knowledge_target_idx`: key index on `targetRole`.
- `knowledge_published_idx`: key index on `isPublished`.
- `knowledge_sort_idx`: key index on `sortOrder`.

#### 24. `household_members`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `residentId`: string, size 64, required.
- `unitCode`: string, size 64, required.
- `propertyCode`: string, size 64, required.
- `fullName`: string, size 160, required.
- `relationship`: string, size 32, required.
- `phone`: string, size 64, optional.
- `idType`: string, size 32, optional.
- `idNumber`: string, size 128, optional.
- `photoFileId`: string, size 128, optional.
- `hasEstateAccess`: boolean, optional, default false.
- `accessNote`: string, size 1024, optional.
- `addedBy`: string, size 64, required.
- `status`: string, size 32, required.
- `createdAt`: datetime, required.
- `updatedAt`: datetime, required.

Indexes:

- `household_resident_idx`: key index on `residentId`.
- `household_unit_idx`: key index on `unitCode`.
- `household_status_idx`: key index on `status`.

#### 25. `subscription_rates`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `apartmentType`: string, size 64, required.
- `monthlyRate`: integer, required.
- `effectiveFrom`: datetime, required.
- `effectiveTo`: datetime, optional.
- `createdBy`: string, size 64, required.
- `reason`: string, size 512, required.
- `createdAt`: datetime, required.
- `updatedAt`: datetime, required.

Indexes:

- `subscription_rate_unique`: unique index on `estateId`, `apartmentType`, `effectiveFrom`.
- `subscription_rate_type_idx`: key index on `apartmentType`.
- `subscription_rate_effective_idx`: key index on `effectiveFrom`.

#### 26. `monthly_billing_runs`

Has `estateId`: Yes.

Fields:

- `estateId`: string, size 64, required.
- `billingMonth`: string, size 16, required.
- `runDate`: datetime, required.
- `runBy`: string, size 64, required.
- `runByName`: string, size 160, required.
- `totalResidents`: integer, required.
- `billsCreated`: integer, required.
- `autoPaidFromCredit`: integer, required.
- `requiresPayment`: integer, required.
- `skipped`: integer, required.
- `errors`: integer, required.
- `errorDetails`: string, size 4096, optional.
- `status`: string, size 32, required.
- `createdAt`: datetime, required.

Indexes:

- `billing_run_unique`: unique index on `estateId`, `billingMonth`.
- `billing_run_status_idx`: key index on `status`.
- `billing_run_date_idx`: key index on `runDate`.

### Seeded Subscription Rates In Code

`setupAppwriteOnboardingSchema()` seeds these subscription rates for `lbsview-estate`:

- `SELF_CONTAINED`: 2000
- `ONE_BEDROOM`: 3000
- `TWO_BEDROOM`: 4000
- `THREE_BEDROOM`: 5000
- `DUPLEX`: 7000
- `LANDLORD_OCCUPIER`: 10000
- `CUSTOM`: 0

## 3. Data Model And Relationships

### Estate Model

- `estates` is the top-level estate registry.
- Most operational tables include `estateId`.
- Code has a hard-coded default estate constant `APPWRITE_LBSVIEW_ESTATE_ID = "lbsview-estate"`.
- Multi-estate structure exists in schema, but many service functions still filter or default to `lbsview-estate`.

### Property, Unit, Resident

- `properties` belong to an estate.
- `units` belong to a property and estate.
- `residents` can reference `propertyId` and `unitId`.
- `units.currentResidentId` can point to a resident.
- `resident_unit_history` tracks resident/unit movement over time.

### Users And Profiles

- Appwrite Auth users are separate from resident rows.
- `profiles.userId` maps an Appwrite Auth user to an app role, estate, phone, email, and house number.
- Resident account matching often resolves from login identity to resident row by phone, email, name, or house/unit number.

### Billing And Payments

- `bills` belong to a resident and optionally property/unit.
- `payments` belong to a resident and optionally a bill.
- Payment allocation applies payments against unpaid/partial bills oldest-first, prioritizing opening balance bills.
- Overpayment is represented as `advanceCredit` on the resident summary and `advanceCreditGenerated` on the payment.
- `payment_intents` stores online checkout/payment attempt state.
- `payment_webhook_events` stores Monnify webhook idempotency and processing status.
- `resident_virtual_accounts` stores resident-specific Monnify reserved account details.
- `monthly_billing_runs` stores monthly subscription run history.

### Visitors

- `visitors` belong to a resident and estate.
- `visitor_logs` record gate movement and verification decisions.
- Visitor codes are six-digit codes in current implementation.
- The QR code payload uses the visitor code.

### SOS / Panic Alerts

- SOS alerts are stored in `security_incidents`.
- SOS alerts are distinguished by `incidentType = "sos"`.
- `cso_reviews` stores CSO/admin review or sign-off activity.
- `audit_logs` stores incident creation/status activity.

### Guard Tour

- `guard_checkpoints` stores checkpoint definitions and QR token.
- Checkpoint QR tokens are normalized with `CP_` prefix.
- `guard_patrol_events` stores checkpoint scans, GPS/device data, distance calculation, GPS verification result, and offline flag.
- CSO dashboard reads patrol events, security incidents, and CSO reviews.

## 4. User Roles And Permissions

### Defined Roles

The app defines these roles in `lib/types.ts`:

- `super_admin`
- `estate_admin`
- `cso`
- `resident`
- `security_guard`
- `vendor`

### Role Home Routes

From `lib/auth.ts`:

- `super_admin`: `/super-admin`
- `estate_admin`: `/admin`
- `cso`: `/cso`
- `resident`: `/resident`
- `security_guard`: `/security`
- `vendor`: `/resident/digital-id`

### Middleware Route Access

`middleware.ts` protects routes using the `corso_role` cookie:

- `/admin`: `estate_admin`, `super_admin`
- `/super-admin`: `super_admin`
- `/cso`: `cso`, `estate_admin`, `super_admin`
- `/resident`: `resident`
- `/security`: `security_guard`

If no valid role cookie exists, the user is redirected to `/login?next=...`.

### API-Level Access Enforcement

Access is generally enforced in API routes by checking:

- `corso_role` cookie.
- `corso_appwrite_user` cookie.
- Function-specific role checks.

Examples:

- Resident payment initiation requires `role === "resident"` and an Appwrite user cookie.
- Visitor verification is allowed for `security_guard`, `estate_admin`, `super_admin`.
- Admin visitor listing is allowed for `estate_admin`, `super_admin`, `cso`.
- SOS listing/update is exposed through `/api/appwrite/admin/sos` for admin/security/CSO-style surfaces.

Important limitation:

- Appwrite table row security is disabled in schema setup. Direct Appwrite client access would need to be controlled carefully. The current security model depends on server-side Next.js API routes and cookies.

## 5. Auth Flow

### Login UI

Login UI is in `components/auth/auth-card.tsx`.

Flow:

1. User enters phone/email and password.
2. The client posts to `/api/appwrite/auth/login`.
3. If Appwrite login succeeds, the client stores a simplified user session in `localStorage` under `corso_user`.
4. The client sets `corso_role` cookie for route middleware.
5. The API route sets:
   - `corso_role`
   - `corso_appwrite_user` as httpOnly cookie.
6. The user is routed to the role home route or the `next` URL.

### Appwrite Auth Backend

`app/api/appwrite/auth/login/route.ts` calls `loginWithAppwrite()` from `lib/appwrite/users.ts`.

The login function:

- Accepts email or phone identifier.
- Resolves phone to Appwrite Auth email by scanning users and prefs.
- Validates by creating an Appwrite session through `/account/sessions/email`.
- Fetches the Appwrite Auth user.
- Reads role/estate data from Appwrite user prefs.
- Falls back to a matching `profiles` row when needed.

### Default Users

Default/demo Appwrite users are defined in `lib/appwrite/users.ts` and `lib/auth.ts`.

Roles included:

- super admin
- estate admin
- resident
- security guard
- CSO

Passwords are set by `DEMO_PASSWORD` in `lib/auth.ts` and default user creation code.

### Estate ID Determination

Estate ID can come from:

- Appwrite Auth user prefs.
- Matching `profiles` row.
- Hard-coded fallback `lbsview-estate`.

Important current limitation:

- `canonicalEstateId()` in `lib/appwrite/users.ts` currently normalizes most non-super-admin users back to `lbsview-estate`. This means the schema is multi-estate capable, but the auth/user creation path is still strongly LBS View-focused.

## 6. Built Features

### Resident Directory And Onboarding

Status: Built, with some review/import complexity.

What exists:

- Admin resident directory.
- Excel/import preview workflow.
- Appwrite onboarding setup/import routes.
- Residents, properties, units, opening balances, payment totals.
- Needs-review flags for records that cannot be matched cleanly.
- Admin editing of resident rows.
- Mobile resident detail overlay and desktop sticky detail panel.
- CSV export API exists under `/api/appwrite/admin/export`.

Known caveat:

- Some resident list and accounting functions list whole tables and filter in memory.
- Estate scoping is inconsistent; many paths still assume `lbsview-estate`.

### Billing And Accounting

Status: Built and functional, but still LBS-focused.

What exists:

- Admin bills page.
- Manual bill creation.
- Monthly subscription billing engine.
- Subscription rate table and seeded rates.
- Payment allocation against bills.
- Overpayment/credit handling.
- Resident dashboard accounting summary.
- Reports dashboard summary.
- CSV/export route.
- Opening balances and imported legacy payment totals.

Important behavior:

- Outstanding never goes negative in allocation logic.
- Overpayment becomes resident `advanceCredit`.
- Credit can be auto-applied by monthly billing run using channel `credit_applied`.

Known caveat:

- Subscription billing engine reads all rows, then filters active residents by `estateId`.
- Some descriptions and payment references still use "LBS View Estate" text.

### Payments

Status: Partially built online payment flow plus working manual/admin allocation logic.

What exists:

- Monnify checkout initiation route: `/api/monnify/initiate`.
- Monnify confirmation route: `/api/monnify/confirm`.
- Monnify webhook route: `/api/webhooks/monnify`.
- Payment intent table.
- Webhook event idempotency table.
- Manual admin payment recording and allocation.
- Monnify reserved virtual account creation code.

What is not fully complete:

- Paystack, Flutterwave, and GTBank Squad are represented in types/UI language but not wired like Monnify.
- Full production Monnify operational verification depends on correct environment variables and live webhook setup.

### Visitors

Status: Built.

What exists:

- Resident invite visitor page.
- Visitor QR code generation.
- Security code/QR verification.
- Expected visitors page.
- Entry logs page.
- Admin visitor logs.
- Resident visitor history.
- Status progression: pending, verified, checked-in, checked-out, expired, cancelled.
- Gate log rows in `visitor_logs`.

Known caveat:

- DB index makes visitor `code` globally unique, while code generation checks uniqueness within an estate. In a future multi-estate production scenario, this mismatch may matter.

### Guard Tour

Status: Built for checkpoint creation/scanning and CSO visibility.

What exists:

- CSO checkpoint management UI.
- Checkpoint QR token generation with `CP_` prefix.
- GPS capture for checkpoint creation.
- Checkpoint rename without changing QR token.
- Security patrol scan API.
- Haversine distance calculation.
- GPS verified / GPS violation / checkpoint missing statuses.
- Offline log flag field.
- CSO patrol feed and metrics.

Known caveat:

- `lib/guard-tour.ts` still uses localStorage for pending offline patrol logs.
- Some guard tour code defaults to `lbsview-estate`.

### SOS / Panic Alarm

Status: Built and visible in code; UI visibility was recently addressed, but this brief does not verify the deployed UI state.

What exists:

- Resident SOS page: `/resident/sos`.
- Admin SOS alerts page: `/admin/sos-alerts`.
- Security SOS alerts page: `/security/sos-alerts`.
- CSO SOS alerts page: `/cso/sos-alerts`.
- SOS API create/list/update routes.
- Storage in `security_incidents`.
- CSO review/sign-off via `cso_reviews`.
- Audit logs.
- Sidebar/mobile nav entries exist in code.
- SOS badge polling in `AppShell`/mobile nav.
- Optional alert sound setting stored in localStorage.

Known caveat:

- Navigation labels for SOS contain mojibake text in `components/layout/nav.ts`, indicating an encoding/display issue.
- Real-time delivery is not clearly implemented through Appwrite Realtime for SOS in the inspected code; badge polling is implemented.

### Complaints

Status: Built.

What exists:

- Resident complaint creation.
- Resident complaint list/details.
- Admin complaint listing/filtering.
- Admin complaint status/assignment/response updates.
- Audit logs.

Known caveat:

- Admin complaint list filters to `APPWRITE_LBSVIEW_ESTATE_ID`.

### Announcements

Status: Built.

What exists:

- Admin create/update/archive announcements.
- Resident announcement list.
- Target roles: all, resident, security, cso.
- Published/draft/archive status.
- Pinned announcements.
- Audit logs.

Known caveat:

- Listing filters to `APPWRITE_LBSVIEW_ESTATE_ID`.

### Knowledge Base

Status: Built.

What exists:

- Admin knowledge base management.
- Resident/security knowledge base viewing.
- Published filtering.
- Categories and role targets.
- Soft delete by tagging and unpublishing.
- View count increment.
- Audit logs.

Known caveat:

- Listing filters to `APPWRITE_LBSVIEW_ESTATE_ID`.

### Household Members

Status: Built in schema and API/UI surface.

What exists:

- Household member table.
- Resident household page.
- Admin household route.
- Fields for relationship, access, ID type, photo file ID.

Known caveat:

- Actual file upload/storage handling for member photos is not evident in the inspected code.

### Digital IDs

Status: UI exists; deeper production verification not confirmed.

What exists:

- Admin digital IDs page.
- Resident digital ID page.
- QR-style identity display components.

Known caveat:

- No dedicated Appwrite table for digital ID records exists in schema; the feature appears to derive identity from resident/user data.

### Marketplace

Status: Placeholder/planned.

What exists:

- `/marketplace` page and resident nav link.
- UI copy says version 2 marketplace placeholder.

Not built:

- Vendor onboarding.
- Resident ordering.
- Admin approval workflow for marketplace services.

## 7. Integrations

### Appwrite

Status: Primary backend.

Used for:

- Auth users.
- User prefs.
- TablesDB database and tables.
- Data import/setup.
- Residents/properties/units.
- Billing/payments.
- Visitors/logs.
- Complaints/announcements/knowledge/household.
- SOS/security incidents.
- Guard checkpoints/patrol events.

Access method:

- Server REST wrapper, not the browser Web SDK for most operations.

### Monnify

Status: Partially wired production-capable integration.

Code exists for:

- Authentication token request.
- Transaction initialization.
- Transaction verification.
- Reserved virtual account creation.
- Webhook HMAC SHA512 signature verification.
- Webhook idempotency via `payment_webhook_events`.
- Payment allocation into Appwrite rows.

Required env vars:

- `MONNIFY_API_KEY`
- `MONNIFY_SECRET_KEY`
- `MONNIFY_CONTRACT_CODE`
- `MONNIFY_BASE_URL`

Default base URL:

- `https://sandbox.monnify.com`

### Paystack / Flutterwave / GTBank Squad

Status: Planned or typed only.

Evidence:

- Payment processor type includes `paystack`, `flutterwave`, `gtbank_squad`.
- Admin/payment UI text refers to them.
- No equivalent client implementation was found in the inspected code.

### Supabase

Status: Legacy references only.

Evidence:

- `.env.example` contains optional legacy Supabase variables.
- Search did not find active Supabase client code in inspected TypeScript/TSX results.
- Earlier UI errors mentioning Supabase likely came from older deployed/local state, not the current inspected Appwrite path.

## 8. API Route Surface

Major API route groups present:

- Access request:
  - `/api/access-requests`
  - `/api/access-requests/status`
  - `/api/admin/access-requests`
- Admin:
  - `/api/admin/residents`
  - `/api/admin/users`
- Appwrite admin:
  - `/api/appwrite/admin/accounting`
  - `/api/appwrite/admin/accounting/summary`
  - `/api/appwrite/admin/announcements`
  - `/api/appwrite/admin/billing/run`
  - `/api/appwrite/admin/complaints`
  - `/api/appwrite/admin/export`
  - `/api/appwrite/admin/household`
  - `/api/appwrite/admin/knowledge-base`
  - `/api/appwrite/admin/residents`
  - `/api/appwrite/admin/sos`
  - `/api/appwrite/admin/system`
  - `/api/appwrite/admin/users`
  - `/api/appwrite/admin/visitors`
- Appwrite auth:
  - `/api/appwrite/auth/login`
- Appwrite onboarding:
  - `/api/appwrite/onboarding/setup`
  - `/api/appwrite/onboarding/import`
  - `/api/appwrite/onboarding/billing-import`
  - `/api/appwrite/onboarding/status`
- Appwrite resident:
  - `/api/appwrite/resident/accounting`
  - `/api/appwrite/resident/announcements`
  - `/api/appwrite/resident/complaints`
  - `/api/appwrite/resident/household`
  - `/api/appwrite/resident/knowledge-base`
  - `/api/appwrite/resident/sos`
- Appwrite security:
  - `/api/appwrite/security/checkpoints`
  - `/api/appwrite/security/knowledge-base`
  - `/api/appwrite/security/patrols`
- Visitor:
  - `/api/resident/visitors`
  - `/api/security/visitors`
  - `/api/security/visitor-history`
  - `/api/appwrite/admin/visitors`
- Monnify:
  - `/api/monnify/initiate`
  - `/api/monnify/confirm`
  - `/api/monnify/virtual-accounts`
  - `/api/webhooks/monnify`
- Utility:
  - `/api/public/estates`
  - `/api/ping`
  - `/api/local/visitors`

## 9. UI Route Surface

Public/auth:

- `/`
- `/login`
- `/signup`
- `/forgot-password`

Admin:

- `/admin`
- `/admin/residents`
- `/admin/users`
- `/admin/visitors`
- `/admin/bills`
- `/admin/payments`
- `/admin/complaints`
- `/admin/announcements`
- `/admin/digital-ids`
- `/admin/knowledge-base`
- `/admin/reports`
- `/admin/settings`
- `/admin/system`
- `/admin/sos-alerts`

Resident:

- `/resident`
- `/resident/invite-visitor`
- `/resident/visitors`
- `/resident/bills`
- `/resident/payments`
- `/resident/complaints`
- `/resident/new-complaint`
- `/resident/announcements`
- `/resident/household`
- `/resident/digital-id`
- `/resident/knowledge-base`
- `/resident/sos`

Security:

- `/security`
- `/security/verify-visitor`
- `/security/expected-visitors`
- `/security/logs`
- `/security/verify-id`
- `/security/sos-alerts`

CSO:

- `/cso`
- `/cso/sos-alerts`

Super admin:

- `/super-admin`
- `/super-admin/estates`
- `/super-admin/estates/[estateId]`
- `/super-admin/users`
- `/super-admin/reports`
- `/super-admin/settings`

Marketplace:

- `/marketplace`

## 10. Multi-Estate Readiness

### What Is Ready

- Most tables include `estateId`.
- Properties and unit codes are unique by estate.
- Billing runs are unique by `estateId` and month.
- Access requests include `estateId`.
- Profiles include `estateId`.
- `estates` table exists.
- Super-admin estate pages exist.

### What Is Not Fully Ready

- Many functions hard-code or filter to `APPWRITE_LBSVIEW_ESTATE_ID`.
- `canonicalEstateId()` in user creation/auth normalizes most non-super-admin users to LBS View.
- Default estate creation/upsert is LBS View-specific.
- Some UI copy and payment references still say LBS View Estate.
- Admin/resident/CSO data isolation is not consistently driven by the logged-in user's estate.
- Table row security is disabled, so multi-estate isolation depends entirely on API-route filtering.

Conclusion:

- The database design is mostly multi-estate capable.
- The application logic is only partially multi-estate ready.
- Creating a demo estate is structurally possible, but full isolation and user/session estate switching require additional code hardening.

## 11. Known Gaps And Technical Debt

### Estate Scoping

- Highest priority gap.
- Several modules list all rows and filter in memory.
- Several modules filter to `lbsview-estate` directly.
- Logged-in estate context is not consistently propagated to every query/mutation.

### Appwrite Permissions

- Tables are created with row security disabled.
- Server-side route checks exist, but Appwrite itself is not enforcing row ownership or estate isolation.

### Local/Demo State

- `lib/local-store.ts` and `lib/demo-data.ts` still exist.
- Login can fallback to demo/local behavior in some conditions.
- `app/api/local/visitors` still exists.
- `lib/guard-tour.ts` uses localStorage for offline guard logs.

### Performance

- Many Appwrite helpers call `listAppwriteTableRows()` and paginate entire tables, then filter/sort locally.
- This affects residents, accounting, complaints, knowledge base, patrol, and reports as data grows.
- Some client-side caching exists for accounting, but query-side filtering/index usage should be improved.

### Encoding/UI Issues

- SOS nav labels contain mojibake characters in `components/layout/nav.ts`.
- This should be corrected to plain ASCII or valid Unicode.

### Payment Providers

- Monnify is wired.
- Paystack, Flutterwave, and GTBank Squad are not implemented beyond type/UI mention.

### Realtime

- CSO/patrol prompts previously requested Appwrite Realtime.
- Current inspected code shows polling and normal fetch calls; full Realtime wiring is not clearly present for every alert surface.

### Digital ID

- UI exists, but there is no dedicated digital ID table in schema.
- It appears to be derived from resident/user data.

### Marketplace

- Placeholder only.

### File Storage

- Household member schema has `photoFileId`, but storage bucket setup and upload flow were not evident in this inspection.

### Email

- `lib/appwrite/users.ts` says Appwrite email setup is not connected yet and recommends reset password/manual temporary password flow.

### Migration State

- Code supports Appwrite Cloud or self-hosted Appwrite through env vars.
- Live deployment state may differ from this repository depending on Vercel/Coolify/Appwrite environment variables.

## 12. Honest Feature Status Summary

| Feature | Status | Notes |
|---|---|---|
| Appwrite schema setup | Built | 26 tables in one database. |
| Appwrite auth login | Built | Phone/email login supported through server routes and Appwrite Auth. |
| Role middleware | Built | Cookie-based route protection. |
| Multi-estate schema | Partial | Schema supports it; logic still LBS-focused. |
| Super-admin estates | Partial | UI/routes exist; isolation needs hardening. |
| Resident import/onboarding | Built | Excel/preview/import paths exist. |
| Resident directory | Built | Editable admin UI, mobile/desktop detail behavior. |
| CSV export | Built | Admin export route exists. |
| Billing engine | Built | Monthly subscription run and credit application. |
| Accounting reports | Built | Summary/dashboard calculations exist. |
| Manual payments | Built | Allocation and audit logs exist. |
| Monnify checkout | Partial/Built | Code exists; production depends on env/webhook setup. |
| Monnify webhook | Built | Signature check, idempotency, allocation. |
| Monnify virtual accounts | Built | Reserved account creation code exists. |
| Paystack/Flutterwave/Squad | Planned | Types/UI references only. |
| Visitor invitations | Built | Resident create, QR, security verify, admin logs. |
| Guard tour checkpoints | Built | Create, GPS pin, QR token, rename. |
| Guard patrol scan | Built | GPS verification and patrol event creation. |
| CSO command dashboard | Built/Partial | Patrol/SOS/security dashboard exists; realtime completeness unclear. |
| SOS panic alerts | Built/Partial | Pages/API/storage exist; polling visible; realtime/audio status needs verification. |
| Complaints | Built | Resident/admin flows exist. |
| Announcements | Built | Admin and resident flows exist. |
| Knowledge base | Built | Admin and audience reader flows exist. |
| Household members | Built/Partial | Data flow exists; file upload not evident. |
| Digital ID | Partial | UI exists; no dedicated table. |
| Marketplace | Planned | Placeholder page only. |

## 13. Recommended Next Engineering Priorities

These are not future-feature promises; they are technical cleanup priorities visible from the current code:

1. Make estate scoping explicit everywhere.
   - Add a single server-side `resolveSessionContext()` helper returning `userId`, `role`, `estateId`, `profileId`.
   - Replace hard-coded `APPWRITE_LBSVIEW_ESTATE_ID` filters in feature modules with session estate context.

2. Replace full-table scans with indexed queries.
   - Use Appwrite query parameters against indexed fields such as `estateId`, `residentId`, `status`, `billingMonth`, `phone`, and `code`.

3. Decide whether local/demo fallback should remain in production.
   - If production, isolate it behind a development-only flag.
   - Remove `/api/local/visitors` from production routing if not needed.

4. Harden Appwrite security.
   - Either keep all access server-side and ensure routes are complete, or enable table row security and permissions where appropriate.

5. Complete multi-estate support before onboarding demo estates.
   - Do not rely only on schema readiness.
   - Auth, profile creation, admin queries, reports, billing, visitors, SOS, and patrols must all respect session estate.

6. Normalize payment provider support.
   - Treat Monnify as the first live provider.
   - Mark Paystack/Flutterwave/Squad as unavailable in UI until implementation exists.

7. Fix known UI text/encoding issues.
   - Correct SOS navigation labels.
   - Audit all display text for LBS-only hard-coding.

8. Add integration smoke tests.
   - Login by role.
   - Resident accounting.
   - Admin resident directory.
   - Visitor creation/verification.
   - SOS creation/acknowledge/resolve.
   - Guard checkpoint scan.
   - Monthly billing dry run.
   - Monnify webhook sample payload.

