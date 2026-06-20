import { NextRequest, NextResponse } from "next/server";
import {
  importBillingPreviewRows,
  previewBillingImportRows
} from "@/lib/appwrite/billing-import";
import type { LbsviewOnboardingPreviewRow } from "@/lib/appwrite/onboarding-import";
import { AppwriteRestError, getAppwriteServerConfig } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";

const adminRoles = ["estate_admin", "super_admin"] as const;

type BillingImportRequest = {
  dryRun?: boolean;
  offset?: number;
  limit?: number;
  estateId?: string;
  rows?: LbsviewOnboardingPreviewRow[];
};

export async function POST(request: NextRequest) {
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
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const scope = importScopeFor(context, requestBody);
    if (Array.isArray(body) || requestBody?.dryRun !== false) {
      const result = await previewBillingImportRows(rows, scope);
      return NextResponse.json(result);
    }

    if (typeof requestBody.limit !== "number") {
      return NextResponse.json(
        { error: "Refresh this page before importing balances. The billing update must run in smaller batches." },
        { status: 409 }
      );
    }

    const result = await importBillingPreviewRows(rows, {
      ...scope,
      offset: typeof requestBody.offset === "number" ? requestBody.offset : 0,
      limit: requestBody.limit
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Corso billing import failed." },
      { status: error instanceof SessionContextError ? error.status : error instanceof AppwriteRestError ? error.status : 500 }
    );
  }
}

function importScopeFor(context: SessionContext, body: BillingImportRequest | null) {
  if (context.role !== "super_admin") {
    return { estateId: context.estateId };
  }

  const estateId = String(body?.estateId ?? "").trim();
  if (!estateId) {
    throw new Error("Super admin billing imports require an estateId.");
  }

  return { estateId };
}
