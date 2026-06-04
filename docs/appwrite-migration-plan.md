# Appwrite Migration Plan

This is the target backend model for the LBS View Estate build.

## Identity Model

Corso should identify the property first, the unit second, and the resident third.

- Estate: `LBS View Estate`
- Property: `LDI-01`
- Unit: `LDI-01-B`
- Resident: person currently attached to that unit

Recommended collections:

| Collection | Purpose |
| --- | --- |
| `estates` | Estate profile, gate, contact, and service categories |
| `profiles` | Appwrite Auth user profile, role, estate assignment, and unit ID |
| `properties` | Compound/property records such as `LDI-01`, `LDI-14`, `LDI-22` |
| `units` | Apartment/unit records such as `LDI-01-A`, `LDI-01-B` |
| `residents` | Current and historical resident profiles attached to units |
| `resident_unit_history` | Move-in, move-out, ownership/tenancy history |
| `visitors` | Visitor invitations and access-code lifecycle |
| `visitor_logs` | Gate verification, check-in, checkout, rejection audit |
| `bills` | Expected charges by resident/unit/property/category |
| `payments` | Online and manual payment records |
| `resident_virtual_accounts` | Dedicated or reserved virtual bank accounts for resident/unit payments |
| `resident_subscriptions` | Recurring estate dues and service charge schedules |
| `payment_intents` | Online checkout or virtual-account payment references before confirmation |
| `payment_webhook_events` | Raw gateway webhook processing audit and idempotency guard |
| `guard_checkpoints` | QR-coded security patrol/checkpoint locations |
| `guard_patrol_events` | Guard scan events at checkpoint QR locations |
| `security_incidents` | Gate, patrol, SOS, complaint, or security escalation records |
| `cso_reviews` | Chief Security Officer review decisions and follow-up notes |
| `audit_logs` | Who or what changed each sensitive record |

These are implemented for Appwrite TablesDB in `lib/appwrite/schema.ts`. The setup endpoint is:

- `POST /api/appwrite/onboarding/setup`

The resident import endpoints are:

- `GET /api/appwrite/onboarding/status`
- `POST /api/appwrite/onboarding/import`

Mutation endpoints require the existing admin or super-admin role cookie and a server-only `CORSO_APPWRITE_API_KEY` with Auth Users and TablesDB permissions.

## Property And Unit Fields

`properties`

- `estateId`
- `propertyCode`, for example `LDI-01`
- `name`
- `description`
- `street`
- `legacyName`
- `status`

`units`

- `estateId`
- `propertyId`
- `unitCode`, for example `LDI-01-B`
- `label`
- `apartmentType`
- `status`: `occupied`, `vacant`, `moved_out`
- `currentResidentId`
- `moveInDate`
- `legacyName`

`residents`

- `estateId`
- `propertyId`
- `unitId`
- `fullName`
- `phone`
- `email`
- `residentType`: `owner`, `tenant`, `family_member`, `staff`
- `status`: `active`, `inactive`, `moved_out`
- `moveInDate`

## Payment Flow

Online payment is the default.

1. Resident opens a bill in Corso.
2. Resident chooses Paystack, Flutterwave, Monnify, or GTBank Squad.
3. Corso creates a payment intent/reference.
4. Resident completes payment on the processor checkout.
5. Processor sends webhook to Corso.
6. Corso verifies webhook signature with the processor secret.
7. Corso confirms payment and updates:
   - `payments.status`
   - `payments.providerReference`
   - `bills.paidAmount`
   - `bills.status`
   - resident balance/report totals
   - `audit_logs`

Manual payment remains as fallback.

- Admin can record bank transfer, cash, POS, or WhatsApp receipt payment.
- Manual payments remain `pending` until confirmed by an admin.
- Admin confirmation updates the bill and writes an audit log.

## Payment Fields

`bills`

- `estateId`
- `propertyId`
- `unitId`
- `residentId`
- `category`
- `title`
- `amount`
- `paidAmount`
- `dueDate`
- `status`: `unpaid`, `partially_paid`, `paid`, `overdue`

`payments`

- `estateId`
- `propertyId`
- `unitId`
- `residentId`
- `billId`
- `amount`
- `reference`
- `processor`: `paystack`, `flutterwave`, `monnify`, `gtbank_squad`, `manual`
- `channel`: `online`, `bank_transfer`, `cash`, `pos`, `whatsapp_receipt`
- `providerReference`
- `status`: `pending`, `confirmed`, `rejected`
- `source`: `resident`, `admin`, `webhook`
- `confirmedAt`
- `confirmedBy`

`resident_virtual_accounts`

- `estateId`
- `residentId`
- `propertyId`
- `unitId`
- `provider`: `monnify`, `gtbank_squad`, `paystack_titan`, or another virtual account provider
- `accountNumber`
- `accountName`
- `bankName`
- `bankCode`
- `providerReference`
- `status`: `active`, `inactive`, `suspended`
- `assignedAt`
- `deactivatedAt`

`resident_subscriptions`

- `estateId`
- `residentId`
- `propertyId`
- `unitId`
- `category`
- `amount`
- `currency`
- `billingCycle`: `monthly`, `quarterly`, `annual`, `one_time`
- `nextDueDate`
- `status`: `active`, `paused`, `cancelled`
- `autoBill`

`payment_intents`

- `estateId`
- `residentId`
- `billId`
- `subscriptionId`
- `virtualAccountId`
- `amount`
- `currency`
- `reference`
- `processor`
- `channel`
- `checkoutUrl`
- `status`: `created`, `pending`, `confirmed`, `expired`, `cancelled`
- `expiresAt`

`payment_webhook_events`

- `estateId`
- `provider`
- `eventId`
- `eventType`
- `reference`
- `status`: `received`, `processed`, `ignored`, `failed`
- `receivedAt`
- `processedAt`
- `payloadHash`
- `errorMessage`

## Security And CSO Provisions

Guard checkpoint QR and CSO workflows should use these reserved tables:

`guard_checkpoints`

- `estateId`
- `checkpointCode`
- `name`
- `gateName`
- `locationLabel`
- `qrToken`
- `status`: `active`, `inactive`
- `sortOrder`

`guard_patrol_events`

- `estateId`
- `checkpointId`
- `checkpointCode`
- `guardProfileId`
- `guardName`
- `scanType`: `routine`, `handover`, `incident`, `missed`
- `scannedAt`
- `status`: `valid`, `late`, `manual_review`
- `deviceLabel`
- `note`

`security_incidents`

- `estateId`
- `incidentType`: `visitor`, `checkpoint`, `sos`, `complaint`, `manual`
- `severity`: `low`, `medium`, `high`, `critical`
- `status`: `open`, `assigned`, `resolved`, `closed`
- `reportedByRole`
- `reportedByProfileId`
- `assignedToProfileId`
- `locationLabel`
- `summary`
- `details`
- `openedAt`
- `resolvedAt`

`cso_reviews`

- `estateId`
- `incidentId`
- `csoProfileId`
- `decision`
- `note`
- `reviewedAt`
- `followUpDate`
- `status`

## Reporting Requirements

Corso reports should compute:

- Expected revenue
- Paid amount
- Outstanding balance
- Debtors
- Payment channels
- Monthly revenue
- Bill categories
- Confirmed/manual/unconfirmed payments
- Audit trail of who updated what

## Webhook Endpoints

Target server routes:

- `POST /api/payments/paystack/webhook`
- `POST /api/payments/flutterwave/webhook`
- `POST /api/payments/monnify/webhook`
- `POST /api/payments/squad/webhook`

Each route must verify provider signature before updating Appwrite.

## Migration Sequence

1. Import old balances and payment history into `bills` and `payments`.
2. Create `properties` and `units` from old address/compound data.
3. Attach each resident to the correct `unitId`.
4. Preserve old names in `legacyName`.
5. Turn on online payment initiation.
6. Turn on verified webhooks.
7. Keep manual admin payment recording for offline cases.
8. Assign resident virtual bank accounts after provider credentials are approved.
9. Add guard checkpoint QR setup and CSO dashboard after security role permissions are finalized.
