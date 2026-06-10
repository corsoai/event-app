import { NextRequest, NextResponse } from "next/server";
import { APPWRITE_LBSVIEW_ESTATE_ID } from "@/lib/appwrite/server";
import { listMonthlyBillingRuns, runMonthlyBilling } from "@/lib/appwrite/billing-engine";

const adminRoles = new Set(["estate_admin", "super_admin"]);

export async function GET(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  if (!adminRoles.has(role)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const runs = await listMonthlyBillingRuns(APPWRITE_LBSVIEW_ESTATE_ID);
    return NextResponse.json({ runs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load billing runs.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  const userId = request.cookies.get("corso_appwrite_user")?.value ?? "system";
  if (!adminRoles.has(role)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    billingMonth?: string;
    dryRun?: boolean;
  } | null;
  const billingMonth = String(body?.billingMonth ?? "");
  const dryRun = Boolean(body?.dryRun);

  if (!/^\d{4}-\d{2}$/.test(billingMonth)) {
    return NextResponse.json({ error: "Billing month must use YYYY-MM format." }, { status: 400 });
  }

  try {
    const runs = await listMonthlyBillingRuns(APPWRITE_LBSVIEW_ESTATE_ID);
    const alreadyCompleted = runs.some((run) => run.billingMonth === billingMonth && run.status === "completed");
    if (alreadyCompleted && !dryRun) {
      return NextResponse.json({ error: "Billing already run for this month. Use dryRun to preview." }, { status: 409 });
    }

    const result = await runMonthlyBilling({
      estateId: APPWRITE_LBSVIEW_ESTATE_ID,
      billingMonth,
      runBy: userId,
      runByName: role === "super_admin" ? "Super admin" : "Estate admin",
      dryRun
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to run monthly billing.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
