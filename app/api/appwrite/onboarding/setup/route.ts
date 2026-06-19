import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError, setupAppwriteOnboardingSchema } from "@/lib/appwrite/server";
import { seedLbsviewSubscriptionRates } from "@/lib/appwrite/subscription-rates";

export async function POST(request: NextRequest) {
  if (!hasValidSetupSecret(request)) {
    return NextResponse.json({ error: "Setup access is forbidden." }, { status: 403 });
  }

  try {
    const result = await setupAppwriteOnboardingSchema();
    if (!result.ok) {
      return NextResponse.json(
        { error: `Appwrite server configuration is missing: ${result.missing.join(", ")}`, result },
        { status: 400 }
      );
    }

    const subscriptionRates = await seedLbsviewSubscriptionRates();

    return NextResponse.json({
      result: {
        ...result,
        seeded: {
          subscriptionRates: subscriptionRates.length
        }
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
  return error instanceof Error ? error.message : "Appwrite schema setup failed.";
}

function hasValidSetupSecret(request: NextRequest) {
  const expected = process.env.CORSO_SETUP_SECRET?.trim() ?? "";
  const provided = request.headers.get("x-corso-setup-secret")?.trim() ?? "";
  return Boolean(expected && provided && provided === expected);
}
