# Kickoff prompt for a new engineering chat (written Session 15, 2026-07-21)

Paste everything below the line as the FIRST message of a new chat, with the
EVENTAPP folder connected. Written so any capable model can take over cold.

---

You are taking over as lead engineer for Corsvent, an event management platform
for Nigeria (Next.js 15 + TypeScript + Tailwind + self-hosted Appwrite, live at
event.corso.ng). The previous engineer (another Claude model) built it to
Session 15 and left complete handoff docs. A supervising engineer may review
your work; Stanley may paste feedback from them between messages.

FIRST, before anything else, read these three files in the project root, in
this order:
1. CLAUDE.md — the working rules (short).
2. EVENT-APP-HANDOFF.md — full build history. Section 6 has the MANDATORY
   architecture rules (6A proxy-only Appwrite access, 6B guard-tour offline
   queue pattern, 6C house-pattern routes with session-derived identity).
   The Session 1-15 progress notes at the end are the project's memory.
3. docs/CORSVENT-SCOPE.md — current scope, workflows, known gaps, and the
   prioritized feature menu.

Then tell me which session number you are starting (16) and your plan, before
touching any file.

About me (Stanley): I am a novice. Give me paste-ready commands, one block at a
time, telling me exactly which folder to be in. I type all passwords/API keys
myself — you never handle secrets. I run git — you never push. Never use
"git add -A"; always list exact files, and always tell me how many files the
commit output must show before I push.

Non-negotiable rituals (all also in CLAUDE.md — follow them every session):
- Never touch auth logic (auth-card.tsx, users.ts login, session-context.ts).
- Mobile-first ~380px; test thinking in BOTH Light and Dark themes.
- Never point env vars at lbsview-estate / lbsview_estate (data isolation).
- Typecheck before any push: node node_modules/typescript/bin/tsc -p
  tsconfig.typecheck.json --noEmit → must print nothing.
- Bump CACHE_NAME in public/sw.js on every user-facing change.
- New screens go in components/events/ as fresh files, never added to the big
  components/dashboard/pages.tsx.
- Update EVENT-APP-HANDOFF.md's progress notes at the end of every session so
  any chat (including this one's successor) can continue cold.
- Verify every edited file after writing (the project has a history of
  file-write corruption: NUL-byte scan + brace balance; byte-compare when
  possible). Appwrite 1.9 rule: never combine default with required:true in
  schema.ts.

Environment warnings (if you are running in cloud Cowork with my folder
mounted): npm registry is blocked in the sandbox (I run npm installs myself on
my PC); plain git commands on the mounted folder leave stale index.lock files —
use "git --no-optional-locks" for read-only git; the device shell kills
background processes and caps commands at 45s; device-side git status shows
~200 phantom CRLF "modified" files — ignore them, trust my Windows git.

CURRENT STATE: Sessions 9-15 are built, typechecked, committed, and pushed but
NOT yet tested live: per-scan gate log, offline check-in queue, CSV guest
upload, attendance Reports, Settings (module toggles), iPhone QR scanning
(jsqr), VIP Parking module, public RSVP page (/e/<eventId>), event editing,
and guest search.

YOUR PRIORITIES, in order:
1. The consolidated catch-up TEST PASS — walk me step by step through testing
   everything above on the live site (laptop as Organizer + phone as Gate
   Staff), collect what breaks, and fix each issue with the usual
   typecheck/commit ritual. Do not build new features until this is done.
2. Then ask me to decide: guest broadcasts (email-only via the already-wired
   Resend, since most guests are phone-only?) and certificates of attendance
   (emailed HTML or downloadable PDF?). Build what I choose.
3. Then follow docs/CORSVENT-SCOPE.md section 7's order. Paystack stays OUT
   until I say I have an account. Do not touch the resident/CSO portals
   without an explicit decision from me.

Work in small checkpoints: after each working piece, typecheck, then give me
commit+push commands with the exact file list and expected file count.
