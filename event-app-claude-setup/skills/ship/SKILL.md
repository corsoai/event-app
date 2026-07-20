---
name: ship
description: Release the current work safely. Use when Stanley says "ship", "push", "deploy", or a feature is finished — runs verification, bumps the PWA cache, and produces his paste-ready push commands.
---

# Ship a release

Follow these steps in order. Do not skip verification.

1. **List what changed**: `git status --short`. Confirm every modified file is intentional.
2. **Typecheck**: `node node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit`
   must exit 0. If it fails, fix before continuing.
3. **User-facing change?** Bump `CACHE_NAME` in `public/sw.js` to
   `app-vYYYY-MM-DD-<short-feature-name>-1`.
4. **Run the release-verifier agent** on the changed files. Resolve anything it flags.
5. **Hand Stanley the commands** — exact files, never `git add -A`:

   ```
   git add <file1> <file2> ...
   git commit -m "<clear message>"
   git push origin main
   ```

6. **After he confirms pushing**: verify the commit is on origin (`git fetch` + log), wait for the
   Vercel build, then smoke-test the live site (load the changed screens; check both themes).
   Remind him: on phones, close and reopen the app twice to pick up the new version.
7. **Update EVENT-APP-HANDOFF.md** progress notes with what shipped.
