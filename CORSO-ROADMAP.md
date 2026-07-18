# Corso Roadmap & Ideas Bank

Living list of features, modules and fixes we have agreed or discussed, so nothing gets forgotten.
(Companion to "Corso Fix and Upgrade List.docx". Newest thinking wins.)

Last updated: 19 July 2026

## Now / next (agreed, waiting to start)

- **Multi-entry guest** — invite form gets "One-time / Multi-entry" choice with valid-from and
  valid-until dates (nanny, contractor, event staff). Gate can check the same code in/out
  repeatedly until expiry. Touches gate verification rules, so it ships as its own release.
- **SMS via BulkSMSNigeria** — instant API token, wallet-funded. First use case: visitor codes
  texted to guests automatically. Register "CORSO" sender ID in parallel (needs CAC certificate +
  letterhead letter; ~24h approval). Env var: `BULKSMS_NG_API_TOKEN`.
- **Events module (prospect request)** — event = name + date + venue/gate; bulk guest list import;
  a code/QR per guest; live "142 of 300 arrived" check-in counter; attendance export afterwards.
  Reuses the visitor code + verify + scan machinery. Qualify the prospect first: recurring events
  business? guests per event? pay per event or monthly?

## Email (engine is LIVE — these are the next messages to switch on)

- Visitor code emailed to the resident when an invite is created (they forward to the guest).
- Service-charge payment reminders to debtors (manual "email all debtors" button first, scheduled later).
- Payment receipt email when a payment is recorded.
- Work-order assignment notification (needs assignee email — today assignedTo is free text).
- Monthly estate summary email to admins/EXCO.
- Tighten DMARC from `p=none` to `p=quarantine` once sending is stable for a few weeks.

## WhatsApp

- Free wa.me share buttons already live: visitor codes (to guest's number), new-user login details,
  debtor "Send reminder" on Reports → Debtors aging.
- Fix: debtor reminder message hardcodes "LBS View Estate" — should use the estate's real name.
- Automated WhatsApp (Business API, ~₦11–17/utility msg) — bundle with the SMS provider phase
  (Termii/Sendchamp offer both). Needs Meta business verification + template approval.

## Payments

- Monnify integration exists in code but is not live — activate online service-charge payment
  (env keys present in .env.example). Alternative processors noted: Paystack, Flutterwave.
- Power/utility recharge resale idea (Monnify/Interswitch) — parked.

## Module toggles (v1 shipped 19 Jul 2026)

- Admin → Settings → Modules: per-estate On/Off for Guard Tour, Plate Capture, Facilities,
  Marketplace, Household, Knowledge Base, Digital IDs. Hides nav items + security dashboard tiles.
- v2 ideas: block direct URL access to disabled modules (today they are hidden, not locked);
  super-admin editing modules per estate from the Estates page; toggle for Payments/Complaints.

## Product polish backlog

- Demo accounts: suspend all three to hide the demo experience pre-launch (switch already built —
  it follows account status). Rotate the public demo password after exhibition season.
- Super-admin Estate detail page still mixes live estates with local sample stats — wire residents/
  bills/complaints per selected estate to live data.
- Super-admin Reports & Settings pages are placeholders.
- Demo-button UX: tapping a demo button in the first second (before the enable-check returns) does
  nothing — queue the tap instead.
- Complaints image upload: field exists on the form — verify it actually stores/shows the photo.
- Estate onboarding wizard: turn the spreadsheet import into a guided self-service flow
  (upload → preview → confirm) so new estates don't need engineering help.
- Landing page: consider testimonials + pricing section when there are 2–3 paying estates.

## Data hygiene (LBS View)

- William Akpabio unit ID — needs Stanley's naming decision ("Plot 001 Chief Meme Otone Road FLAT 6").
- Deznie Oliver — invalid phone (00171844045) and AA-7 unit conflict.
- Shalom Lawrence staff login — password moment (Stanley does it).
- Confirm resident count 157 vs 156 against the master sheet.
- Delete TEST123 vehicle log from LBS View records.
- Scan sheet for duplicate phones/emails; rotate any passwords that were shared in chats.

## Testing

- Holistic page-by-page test pass in both Light and Dark themes ("start the test pass").
- Guard phone: confirm GPS indicator goes green at the gate and checkpoint scans verify.
- SOS drill end-to-end on a real guard phone (siren + silence + resolve).
