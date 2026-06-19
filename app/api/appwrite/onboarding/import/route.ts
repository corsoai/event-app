import { NextRequest, NextResponse } from "next/server";
import {
  importOnboardingPreviewRows,
  summarizeOnboardingPreview,
  type LbsviewOnboardingPreviewRow
} from "@/lib/appwrite/onboarding-import";
import { AppwriteRestError, getAppwriteServerConfig, setupAppwriteOnboardingSchema } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";

const adminRoles = ["estate_admin", "super_admin"] as const;

type ImportRequest = {
  dryRun?: boolean;
  offset?: number;
  limit?: number;
  estateId?: string;
  estateName?: string;
  rows?: LbsviewOnboardingPreviewRow[];
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as ImportRequest | LbsviewOnboardingPreviewRow[] | null;
  const rows = Array.isArray(body)
    ? body
    : Array.isArray(body?.rows)
      ? body.rows
      : [];
  if (!rows.length) {
    return NextResponse.json({ error: "Upload the generated onboarding preview JSON first." }, { status: 400 });
  }
  const requestBody = Array.isArray(body) ? null : body;
  const offset = typeof requestBody?.offset === "number" ? requestBody.offset : 0;
  const limit = typeof requestBody?.limit === "number" ? requestBody.limit : undefined;
  let target: ReturnType<typeof importTargetFor>;
  try {
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    target = importTargetFor(context, requestBody);
  } catch (error) {
    return NextResponse.json(
      { error: appwriteErrorMessage(error) },
      { status: error instanceof SessionContextError ? error.status : 403 }
    );
  }

  if (Array.isArray(body) || requestBody?.dryRun !== false) {
    return NextResponse.json({
      dryRun: true,
      imported: false,
      summary: summarizeOnboardingPreview(rows)
    });
  }
  if (typeof limit !== "number") {
    return NextResponse.json(
      { error: "Refresh this page before importing. The current import must run in smaller batches." },
      { status: 409 }
    );
  }

  const config = getAppwriteServerConfig();
  if (!config.configured) {
    return NextResponse.json(
      { error: `Appwrite server configuration is missing: ${config.missing.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    let schema: Awaited<ReturnType<typeof setupAppwriteOnboardingSchema>> | null = null;
    if (offset <= 0) {
      schema = await setupAppwriteOnboardingSchema();
      if (!schema.ok) {
        return NextResponse.json(
          { error: `Appwrite server configuration is missing: ${schema.missing.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const result = await importOnboardingPreviewRows(rows, {
      offset,
      limit,
      estateId: target.estateId,
      estateName: target.estateName
    });
    return NextResponse.json({
      ...result,
      schema: schema
        ? {
            database: schema.database,
            tables: schema.tables.length
          }
        : {
            database: "skipped",
            tables: 0
          }
    });
  } catch (error) {
    return NextResponse.json(
      { error: appwriteErrorMessage(error) },
      { status: error instanceof SessionContextError ? error.status : error instanceof AppwriteRestError ? error.status : 500 }
    );
  }
}

function importTargetFor(context: SessionContext, body: ImportRequest | null) {
  if (context.role !== "super_admin") {
    return { estateId: context.estateId, estateName: body?.estateName };
  }

  const estateId = String(body?.estateId ?? "").trim();
  if (!estateId) {
    throw new Error("Super admin imports require an estateId.");
  }

  return { estateId, estateName: body?.estateName };
}

function appwriteErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Appwrite import failed.";
}
