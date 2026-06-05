# Appwrite Deployment Checklist

Use this before every production change so Appwrite failures are diagnosed from facts instead of retries.

## Site settings

- Runtime: Next.js site.
- Install command: `npm install` or `npm ci`.
- Build command: `npm run build`.
- Output directory: `./.next`.
- Production branch: `main`.
- Redeploy after changing any build command, output directory, framework setting, or environment variable.

## Required environment variables

- `NEXT_PUBLIC_APPWRITE_ENDPOINT`
- `NEXT_PUBLIC_APPWRITE_PROJECT_ID`
- `CORSO_APPWRITE_API_KEY`
- Optional override: `APPWRITE_DATABASE_ID`

Do not paste the label text from the Appwrite console into `CORSO_APPWRITE_API_KEY`. Paste only the one-time key value from **Copy API key**.

## Pre-push verification

Run the production checks locally before pushing:

```powershell
& "C:\Program Files\nodejs\node.exe" "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run verify
```

The local PowerShell `npm` shim can behave inconsistently on this machine, so the direct Node/npm command above is the safer local command.

## After deploy

1. Confirm the latest Appwrite deployment is `Active`.
2. Open `/admin/system` and confirm the status is `ok`.
3. Open `/admin/residents` and confirm Appwrite resident counts load.
4. Test `Residents CSV` and `All data CSV`.
5. Treat old failed deployments in Appwrite history as historical records unless they are the active deployment.

## If a build fails

1. Read the failed deployment logs first.
2. Run `npm run verify` locally.
3. If local verification passes and the failure has no code-level error, retry the same commit once.
4. If the same failure repeats, check Appwrite site settings and environment variables before changing application code.
