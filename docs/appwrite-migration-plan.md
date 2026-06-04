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
| `audit_logs` | Who or what changed each sensitive record |

These are implemented for Appwrite TablesDB in `lib/appwrite/schema.ts`. The setup endpoint is:

- `POST /api/appwrite/onboarding/setup`

The resident import endpoints are:

- `GET /api/appwrite/onboarding/status`
- `POST /api/appwrite/onboarding/import`

Mutation endpoints require the existing admin or super-admin role cookie and a server-only `APPWRITE_API_KEY` with Auth Users and TablesDB permissions.

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
