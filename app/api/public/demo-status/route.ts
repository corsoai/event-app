import { NextResponse } from "next/server";
import { listAppwriteTableRows } from "@/lib/appwrite/residents";

const DEMO_ESTATE_ID = "corso-demo-estate";
const DEMO_EMAILS = new Set(["demo.resident@corso.ng", "demo.guard@corso.ng", "demo.manager@corso.ng"]);

type ProfileRow = {
  email?: string;
  status?: string;
};

/**
 * Public flag for the login page: the demo experience is "on" while at least
 * one demo account is active. Suspending all three demo users in
 * Users & Roles hides the demo buttons; reactivating brings them back.
 * Fails closed (disabled) on any error.
 */
export async function GET() {
  try {
    const profiles = await listAppwriteTableRows<ProfileRow>("profiles", { estateId: DEMO_ESTATE_ID });
    const enabled = profiles.some(
      (profile) => DEMO_EMAILS.has((profile.email ?? "").toLowerCase()) && profile.status !== "inactive"
    );

    return NextResponse.json({ enabled });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
