import { NextRequest, NextResponse } from "next/server";
import {
  importOnboardingPreviewRows,
  summarizeOnboardingPreview,
  type LbsviewOnboardingPreviewRow
} from "@/lib/appwrite/onboarding-import";
import { AppwriteRestError, getAppwriteServerConfig, setupAppwriteOnboardingSchema } from "@/lib/appwrite/server";

const adminRoles = new Set(["estate_admin", "super_admin"]);

type ImportRequest = {
  dryRun?: boolean;
  rows?: LbsviewOnboardingPreviewRow[];
};

export async function POST(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  if (!adminRoles.has(role)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as ImportRequest | LbsviewOnboardingPreviewRow[] | null;
  const rows = Array.isArray(body)
    ? body
    : Array.isArray(body?.rows)
      ? body.rows
      : [];
  if (!rows.length) {
    return NextResponse.json({ error: "Upload the generated onboarding preview JSON first." }, { status: 400 });
  }

  if (Array.isArray(body) || body?.dryRun !== false) {
    return NextResponse.json({
      dryRun: true,
      imported: false,
      summary: summarizeOnboardingPreview(rows)
    });
  }

  const config = getAppwriteServerConfig();
  if (!config.configured) {
    return NextResponse.json(
      { error: `Appwrite server configuration is missing: ${config.missing.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const schema = await setupAppwriteOnboardingSchema();
    if (!schema.ok) {
      return NextResponse.json(
        { error: `Appwrite server configuration is missing: ${schema.missing.join(", ")}` },
        { status: 400 }
      );
    }

    const result = await importOnboardingPreviewRows(rows);
    return NextResponse.json({
      ...result,
      schema: {
        database: schema.database,
        tables: schema.tables.length
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: appwriteErrorMessage(error) },
      { status: error instanceof AppwriteRestError ? error.status : 500 }
    );
  }
}

function appwriteErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Appwrite import failed.";
}
