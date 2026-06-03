import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

type AdminProfile = {
  id: string;
  estate_id: string | null;
  role: UserRole;
  is_active: boolean;
};

type AccessRequestRow = {
  id: string;
  auth_user_id: string | null;
  estate_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  requested_role: UserRole;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  reviewed_at: string | null;
  estates?: { name?: string } | { name?: string }[] | null;
};

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { data, error } = await listAccessRequests(auth.admin, auth.profile);
  if (error) {
    return errorResponse(error.message, 400);
  }

  return jsonResponse({ requests: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return errorResponse("Invalid access request update.", 400);
  }

  const requestId = String(body.requestId ?? "").trim();
  const action = String(body.action ?? "").trim();
  if (!requestId || !["approve", "reject"].includes(action)) {
    return errorResponse("Choose a valid access request action.", 400);
  }

  const { data: accessRequest, error } = await auth.admin
    .from("access_requests")
    .select("id,auth_user_id,estate_id,full_name,email,phone,requested_role,status,requested_at,reviewed_at,estates(name)")
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    return errorResponse(error.message, 400);
  }

  if (!accessRequest) {
    return accessRequestResponse(auth.admin, auth.profile, "This access request is no longer pending.");
  }

  const target = accessRequest as AccessRequestRow;
  const permissionError = assertCanManageRequest(auth.profile, target);
  if (permissionError) {
    return permissionError;
  }

  if (target.status !== "pending") {
    return accessRequestResponse(
      auth.admin,
      auth.profile,
      "This access request has already been reviewed and removed from the approval queue."
    );
  }

  if (action === "reject") {
    const { error: duplicateRejectedError } = await auth.admin
      .from("access_requests")
      .delete()
      .eq("email", target.email)
      .eq("status", "rejected")
      .neq("id", target.id);

    if (duplicateRejectedError) {
      return errorResponse(duplicateRejectedError.message, 400);
    }

    const { error: rejectError } = await auth.admin
      .from("access_requests")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: auth.profile.id
      })
      .eq("id", target.id);

    if (rejectError) {
      return errorResponse(rejectError.message, 400);
    }

    return accessRequestResponse(auth.admin, auth.profile, `${target.full_name}'s access request has been rejected.`);
  }

  if (!target.estate_id) {
    return errorResponse("An estate is required before approving this request.", 400);
  }

  if (!target.auth_user_id) {
    return errorResponse("This request is missing its login account. Ask the resident to submit a fresh access request.", 400);
  }

  const { data: profile, error: profileError } = await auth.admin
    .from("profiles")
    .upsert(
      {
        auth_user_id: target.auth_user_id,
        estate_id: target.estate_id,
        full_name: target.full_name,
        email: target.email,
        phone: target.phone,
        role: target.requested_role,
        is_active: true
      },
      { onConflict: "email" }
    )
    .select("id")
    .single();

  if (profileError || !profile) {
    return errorResponse(profileError?.message ?? "User profile could not be approved.", 400);
  }

  if (target.requested_role === "resident") {
    await ensureResidentRecord(auth.admin, target, profile.id);
  }

  const approvalError = await markApprovedRequestReviewed(auth.admin, target, auth.profile.id);
  if (approvalError) {
    return errorResponse(approvalError, 400);
  }

  return accessRequestResponse(auth.admin, auth.profile, `${target.full_name}'s access request has been approved.`);
}

function listAccessRequests(admin: SupabaseClient, profile: AdminProfile) {
  const query = admin
    .from("access_requests")
    .select("id,auth_user_id,estate_id,full_name,email,phone,requested_role,status,requested_at,reviewed_at,estates(name)")
    .eq("status", "pending")
    .order("requested_at", { ascending: false });

  return profile.role === "super_admin" ? query : query.eq("estate_id", profile.estate_id);
}

async function accessRequestResponse(admin: SupabaseClient, profile: AdminProfile, message: string) {
  const { data, error } = await listAccessRequests(admin, profile);
  if (error) {
    return errorResponse(error.message, 400);
  }

  return jsonResponse({ message, requests: data ?? [] });
}

async function requireAdmin(request: NextRequest): Promise<{ admin: SupabaseClient; profile: AdminProfile } | NextResponse> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse("Supabase public environment variables are missing.", 500);
  }

  if (!supabaseSecretKey) {
    return errorResponse("SUPABASE_SECRET_KEY is missing in Vercel.", 500);
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return errorResponse("You must be logged in to manage access requests.", 401);
  }

  const verifier = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userResult, error: userError } = await verifier.auth.getUser(token);
  if (userError || !userResult.user) {
    return errorResponse("Your login session could not be verified. Sign in again.", 401);
  }

  const admin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,estate_id,role,is_active")
    .eq("auth_user_id", userResult.user.id)
    .single();

  if (profileError || !profile) {
    return errorResponse("No active admin profile was found for this account.", 403);
  }

  if (!profile.is_active) {
    return errorResponse("This admin account is suspended.", 403);
  }

  if (!["super_admin", "estate_admin"].includes(profile.role)) {
    return errorResponse("Only Super Admins and Estate Admins can manage access requests.", 403);
  }

  return { admin, profile: profile as AdminProfile };
}

function assertCanManageRequest(adminProfile: AdminProfile, target: AccessRequestRow) {
  if (adminProfile.role === "super_admin") {
    return null;
  }

  if (target.estate_id !== adminProfile.estate_id) {
    return errorResponse("Estate admins can only manage access requests for their assigned estate.", 403);
  }

  return null;
}

async function ensureResidentRecord(admin: SupabaseClient, request: AccessRequestRow, profileId: string) {
  const { data: existingByProfile } = await admin
    .from("residents")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (existingByProfile) {
    return;
  }

  const { data: existingByEmail } = await admin
    .from("residents")
    .select("id")
    .eq("email", request.email)
    .maybeSingle();

  if (existingByEmail) {
    await admin
      .from("residents")
      .update({
        estate_id: request.estate_id,
        profile_id: profileId,
        full_name: request.full_name,
        phone: request.phone,
        status: "active"
      })
      .eq("id", existingByEmail.id);
    return;
  }

  await admin.from("residents").insert({
    estate_id: request.estate_id,
    profile_id: profileId,
    full_name: request.full_name,
    apartment_number: "Pending assignment",
    phone: request.phone,
    email: request.email,
    resident_type: "tenant",
    status: "active"
  });
}

async function markApprovedRequestReviewed(admin: SupabaseClient, request: AccessRequestRow, reviewedBy: string) {
  const reviewedAt = new Date().toISOString();
  const { error: duplicateApprovedEmailError } = await admin
    .from("access_requests")
    .delete()
    .eq("email", request.email)
    .eq("status", "approved")
    .neq("id", request.id);

  if (duplicateApprovedEmailError) {
    return duplicateApprovedEmailError.message;
  }

  if (request.phone) {
    const { error: duplicateApprovedPhoneError } = await admin
      .from("access_requests")
      .delete()
      .eq("phone", request.phone)
      .eq("status", "approved")
      .neq("id", request.id);

    if (duplicateApprovedPhoneError) {
      return duplicateApprovedPhoneError.message;
    }
  }

  const { error: updateTargetError } = await admin
    .from("access_requests")
    .update({
      status: "approved",
      reviewed_at: reviewedAt,
      reviewed_by: reviewedBy
    })
    .eq("id", request.id);

  if (updateTargetError) {
    return updateTargetError.message;
  }

  if (request.phone) {
    const { error: updatePhoneDuplicatesError } = await admin
      .from("access_requests")
      .update({
        status: "approved",
        reviewed_at: reviewedAt,
        reviewed_by: reviewedBy
      })
      .eq("phone", request.phone)
      .eq("status", "pending");

    if (updatePhoneDuplicatesError) {
      return updatePhoneDuplicatesError.message;
    }
  }

  const pendingCount = await countPendingRequestMatches(admin, request);
  if (typeof pendingCount === "string") {
    return pendingCount;
  }

  if (pendingCount > 0) {
    return "The request was approved, but Supabase still reports it as pending. Refresh and try again.";
  }

  return "";
}

async function countPendingRequestMatches(admin: SupabaseClient, request: AccessRequestRow) {
  const filters = [
    { field: "id", value: request.id },
    { field: "email", value: request.email },
    request.phone ? { field: "phone", value: request.phone } : null
  ].filter(Boolean) as Array<{ field: string; value: string }>;

  let total = 0;
  for (const filter of filters) {
    const { count, error } = await admin
      .from("access_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq(filter.field, filter.value);

    if (error) {
      return error.message;
    }

    total += count ?? 0;
  }

  return total;
}

function errorResponse(message: string, status: number) {
  return jsonResponse({ error: message }, status);
}

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}
