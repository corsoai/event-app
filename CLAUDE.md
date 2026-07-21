# Event App — Project Rules (CLAUDE.md)

You are building an all-in-one event management platform for Nigeria, forked from the Corso
estate-management codebase. Full context: EVENT-APP-HANDOFF.md in the project root — read it at
the start of every session.

## The person you work with

Stanley is a novice bridging you and the computer. Always give paste-ready commands with the
exact folder to be in. Never ask him to edit code by hand. He types all passwords/API keys/secrets
himself — you never see or handle them. He runs git; you never push.

## Hard guardrails

1. **Never break auth.** `components/auth/auth-card.tsx`, `lib/appwrite/users.ts` login mechanics,
   and `lib/appwrite/session-context.ts` may be relabeled/styled but their logic stays untouched.
2. **Mobile-first.** Every screen must work at ~380px width. Test Light AND Dark theme (the app's
   own toggle; Tailwind darkMode follows `[data-theme="dark"]`).
3. **Data isolation.** This app uses its OWN Appwrite project + database on the shared server.
   Never point env vars at `lbsview-estate` / `lbsview_estate`.
4. **Verify before handover.** Run
   `node node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit`
   and require exit 0 before giving Stanley push commands. Vercel's build is the final gate — a
   red build never replaces the live site.
5. **Stage exact files.** Never `git add -A` (CRLF noise). List every file explicitly.
6. **Bump `CACHE_NAME` in `public/sw.js`** on every user-facing release (PWA caches hard).
7. Most screens live in `components/dashboard/pages.tsx` (~12k lines). Edit surgically; prefer
   extracting NEW screens into their own files under `components/events/`.

## Release ritual (Stanley runs, from the project folder)

```
git add <exact files>
git commit -m "<message>"
git push origin main
```

(Single-branch flow on `main` unless Stanley says otherwise.)

## Session protocol

- Start: read EVENT-APP-HANDOFF.md → say which phase you're on and the plan for this session.
- End (or when Stanley says "wrap up"): update EVENT-APP-HANDOFF.md's progress notes so the next
  chat can continue cold, then give any pending push commands.
