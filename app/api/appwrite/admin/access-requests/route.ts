import { NextRequest, NextResponse } from "next/server";
import {
  accessRequestErrorResponse,
  listAppwriteAccessRequests,
  reviewAppwriteAccessRequest
} from "@/lib/appwrite/access-requests";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";

const adminRoles = ["estate_admin", "super_admin"] as const;

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const requests = await listAppwriteAccessRequests({
      adminRole: context.role,
      estateId: context.role === "super_admin" ? null : context.estateId
    });
    return jsonResponse({ requests });
  } catch (error) {
    return routeError(error, "Access requests could not be loaded.");
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return jsonResponse({ error: "Invalid access request update." }, 400);
  }

  const requestId = String(body.requestId ?? "").trim();
  const action = String(body.action ?? "").trim();
  if (!requestId || (action !== "approve" && action !== "reject")) {
    return jsonResponse({ error: "Choose a valid access request action." }, 400);
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const result = await reviewAppwriteAccessRequest({
      requestId,
      action,
      reviewerUserId: context.userId,
      adminRole: context.role,
      adminEstateId: context.role === "super_admin" ? null : context.estateId
    });

    return jsonResponse(result);
  } catch (error) {
    return routeError(error, "Access request could not be reviewed.");
  }
}

function routeError(error: unknown, fallback: string) {
  if (error instanceof SessionContextError) {
    return jsonResponse({ error: error.message }, error.status);
  }

  const response = accessRequestErrorResponse(error, fallback);
  return jsonResponse({ error: response.message }, response.status);
}

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}
