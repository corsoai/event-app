import { NextRequest, NextResponse } from "next/server";
import {
  importBillingPreviewRows,
  previewBillingImportRows
} from "@/lib/appwrite/billing-import";
import type { LbsviewOnboardingPreviewRow } from "@/lib/appwrite/onboarding-import";
import { AppwriteRestError, getAppwriteServerConfig } from "@/lib/appwrite/server";

const adminRoles = new Set(["estate_admin", "super_admin"]);

type BillingImportRequest = {
  dryRun?: boolean;
  offset?: number;
  limit?: number;
  rows?: LbsviewOnboardingPreviewRow[];
};

export async function POST(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  if (!adminRoles.has(role)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as BillingImportRequest | LbsviewOnboardingPreviewRow[] | null;
  const rows = Array.isArray(body)
    ? body
    : Array.isArray(body?.rows)
      ? body.rows
      : [];
  if (!rows.length) {
    return NextResponse.json({ error: "Upload the generated onboarding preview JSON first." }, { status: 400 });
  }

  const config = getAppwriteServerConfig();
  if (!config.configured) {
    return NextResponse.json(
      { error: `Appwrite server configuration is missing: ${config.missing.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const requestBody = Array.isArray(body) ? null : body;
    if (Array.isArray(body) || requestBody?.dryRun !== false) {
      const result = await previewBillingImportRows(rows);
      return NextResponse.json(result);
    }

    if (typeof requestBody.limit !== "number") {
      return NextResponse.json(
        { error: "Refresh this page before importing balances. The billing update must run in smaller batches." },
        { status: 409 }
      );
    }

    const result = await importBillingPreviewRows(rows, {
      offset: typeof requestBody.offset === "number" ? requestBody.offset : 0,
      limit: requestBody.limit
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Appwrite billing import failed." },
      { status: error instanceof AppwriteRestError ? error.status : 500 }
    );
  }
}
