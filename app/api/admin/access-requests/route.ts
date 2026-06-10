import { NextRequest, NextResponse } from "next/server";
import {
  accessRequestErrorResponse,
  listAppwriteAccessRequests,
  reviewAppwriteAccessRequest
} from "@/lib/appwrite/access-requests";

const adminRoles = new Set(["estate_admin", "super_admin"]);

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const requests = await listAppwriteAccessRequests(auth);
    return jsonResponse({ requests });
  } catch (error) {
    const response = accessRequestErrorResponse(error, "Access requests could not be loaded.");
    return jsonResponse({ error: response.message }, response.status);
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

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
    const result = await reviewAppwriteAccessRequest({
      requestId,
      action,
      reviewerUserId: auth.appwriteUserId,
      adminRole: auth.adminRole,
      adminEstateId: auth.estateId
    });

    return jsonResponse(result);
  } catch (error) {
    const response = accessRequestErrorResponse(error, "Access request could not be reviewed.");
    return jsonResponse({ error: response.message }, response.status);
  }
}

function requireAdmin(request: NextRequest) {
  const adminRole = request.cookies.get("corso_role")?.value ?? "";
  if (!adminRoles.has(adminRole)) {
    return jsonResponse({ error: "Only Super Admins and Estate Admins can manage access requests." }, 403);
  }

  return {
    adminRole,
    estateId: adminRole === "super_admin" ? null : "lbsview-estate",
    appwriteUserId: request.cookies.get("corso_appwrite_user")?.value ?? "corso-admin"
  };
}

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}
