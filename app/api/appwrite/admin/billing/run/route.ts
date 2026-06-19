import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { listMonthlyBillingRuns, runMonthlyBilling } from "@/lib/appwrite/billing-engine";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";

const adminRoles = ["estate_admin", "super_admin"] as const;

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const runs = await listMonthlyBillingRuns(estateScopeFor(context));
    return NextResponse.json({ runs });
  } catch (error) {
    return adminRouteError(error, "Unable to load billing runs.");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as {
    billingMonth?: string;
    dryRun?: boolean;
    estateId?: string;
  } | null;
  const billingMonth = String(body?.billingMonth ?? "");
  const dryRun = Boolean(body?.dryRun);

  if (!/^\d{4}-\d{2}$/.test(billingMonth)) {
    return NextResponse.json({ error: "Billing month must use YYYY-MM format." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const estateId = writableEstateId(context, body);
    const runs = await listMonthlyBillingRuns(estateId);
    const alreadyCompleted = runs.some((run) => run.billingMonth === billingMonth && run.status === "completed");
    if (alreadyCompleted && !dryRun) {
      return NextResponse.json({ error: "Billing already run for this month. Use dryRun to preview." }, { status: 409 });
    }

    const result = await runMonthlyBilling({
      estateId,
      billingMonth,
      runBy: context.profileId,
      runByName: context.role === "super_admin" ? "Super admin" : "Estate admin",
      dryRun
    });

    return NextResponse.json(result);
  } catch (error) {
    return adminRouteError(error, "Unable to run monthly billing.");
  }
}

function estateScopeFor(context: SessionContext) {
  return context.role === "super_admin"
    ? { includeAllEstates: true }
    : { estateId: context.estateId };
}

function writableEstateId(context: SessionContext, body: { estateId?: string } | null) {
  if (context.role !== "super_admin") {
    return context.estateId;
  }

  const estateId = String(body?.estateId ?? "").trim();
  if (!estateId) {
    throw new Error("Super admin billing runs require an estateId.");
  }

  return estateId;
}

function adminRouteError(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage;
  const status = error instanceof SessionContextError
    ? error.status
    : error instanceof AppwriteRestError
      ? error.status
      : 400;

  return NextResponse.json({ error: message }, { status });
}
