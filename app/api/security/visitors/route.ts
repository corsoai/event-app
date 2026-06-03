import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Resident, UserRole, Visitor } from "@/lib/types";
import { getVisitorWindowState, VISITOR_CODE_VALIDITY_HOURS } from "@/lib/visitor-window";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

type SecurityProfile = {
  id: string;
  estate_id: string | null;
  role: UserRole;
  is_active: boolean;
};

const verifierRoles: UserRole[] = ["security_guard", "estate_admin", "super_admin"];

export async function GET(request: NextRequest) {
  const auth = await requireVerifier(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const code = request.nextUrl.searchParams.get("code")?.replace(/\D/g, "").slice(0, 6) ?? "";
  if (code.length !== 6) {
    return errorResponse("Enter a valid 6-digit visitor code.", 400);
  }

  const query = auth.admin
    .from("visitors")
    .select("*, residents(id,estate_id,full_name,apartment_number,phone,email,resident_type,status)")
    .eq("access_code", code);

  if (auth.profile.role !== "super_admin") {
    query.eq("estate_id", auth.profile.estate_id);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    return errorResponse(error.message, 400);
  }

  if (!data) {
    return errorResponse("No valid visitor invitation found for this code.", 404);
  }

  let visitor = mapVisitor(data);
  const windowError = await assertVisitorLookupWindow(auth.admin, visitor);
  if (windowError) {
    return windowError;
  }

  if (visitor.status === "pending") {
    const { data: updated, error: updateError } = await auth.admin
      .from("visitors")
      .update({ status: "verified" })
      .eq("id", visitor.id)
      .select("*")
      .single();

    if (updateError || !updated) {
      return errorResponse(updateError?.message ?? "Visitor code could not be verified.", 400);
    }

    visitor = mapVisitor(updated);
    await writeVisitorLog(auth.admin, auth.profile, visitor, "verified");
  }

  return NextResponse.json({
    visitor,
    resident: data.residents ? mapResident(data.residents) : null
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireVerifier(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return errorResponse("Invalid visitor update request.", 400);
  }

  const visitorId = String(body.visitorId ?? "").trim();
  const status = String(body.status ?? "").trim() as Visitor["status"];
  const allowedStatuses: Visitor["status"][] = ["verified", "checked-in", "checked-out", "cancelled"];
  if (!visitorId || !allowedStatuses.includes(status)) {
    return errorResponse("Choose a valid visitor status.", 400);
  }

  const query = auth.admin
    .from("visitors")
    .select("*")
    .eq("id", visitorId);

  if (auth.profile.role !== "super_admin") {
    query.eq("estate_id", auth.profile.estate_id);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    return errorResponse(error.message, 400);
  }

  if (!data) {
    return errorResponse("Visitor invitation was not found.", 404);
  }

  const visitor = mapVisitor(data);
  const statusError = await assertVisitorStatusChange(auth.admin, visitor, status);
  if (statusError) {
    return statusError;
  }

  const { data: updated, error: updateError } = await auth.admin
    .from("visitors")
    .update({ status: toSupabaseVisitorStatus(status) })
    .eq("id", visitor.id)
    .select("*")
    .single();

  if (updateError || !updated) {
    return errorResponse(updateError?.message ?? "Visitor status could not be updated.", 400);
  }

  await writeVisitorLog(auth.admin, auth.profile, mapVisitor(updated), status);

  return NextResponse.json({ visitor: mapVisitor(updated) });
}

async function requireVerifier(
  request: NextRequest
): Promise<{ admin: SupabaseClient; profile: SecurityProfile } | NextResponse> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse("Supabase public environment variables are missing.", 500);
  }

  if (!supabaseSecretKey) {
    return errorResponse("SUPABASE_SECRET_KEY is missing in Vercel.", 500);
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return errorResponse("You must be logged in to verify visitor codes.", 401);
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
    return errorResponse("No active security profile was found for this account.", 403);
  }

  if (!profile.is_active) {
    return errorResponse("This account is suspended.", 403);
  }

  if (!verifierRoles.includes(profile.role)) {
    return errorResponse("This account cannot verify visitor codes.", 403);
  }

  return { admin, profile: profile as SecurityProfile };
}

function mapVisitor(row: Record<string, any>): Visitor {
  return {
    id: row.id,
    residentId: row.resident_id,
    estateId: row.estate_id,
    visitorName: row.visitor_name,
    phone: row.phone ?? "",
    visitDate: row.visit_date,
    arrivalTime: String(row.expected_arrival_time).slice(0, 5),
    purpose: row.purpose,
    count: row.visitor_count,
    code: row.access_code,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    status: String(row.status).replaceAll("_", "-") as Visitor["status"]
  };
}

async function assertVisitorLookupWindow(admin: SupabaseClient, visitor: Visitor) {
  if (visitor.status === "cancelled") {
    return errorResponse("This visitor code has been cancelled.", 410);
  }

  if (visitor.status === "expired") {
    return errorResponse("This visitor code has expired.", 410);
  }

  if (visitor.status === "checked-in" || visitor.status === "checked-out") {
    return null;
  }

  const windowState = getVisitorWindowState(visitor);
  if (windowState.canVerifyOrCheckIn) {
    return null;
  }

  if (windowState.status === "expired") {
    await admin.from("visitors").update({ status: "expired" }).eq("id", visitor.id);
    return errorResponse(`${windowState.message} Visitor codes are valid for ${VISITOR_CODE_VALIDITY_HOURS} hours after generation.`, 410);
  }

  return errorResponse(`${windowState.message} Visitor codes are valid for ${VISITOR_CODE_VALIDITY_HOURS} hours after generation.`, 403);
}

async function assertVisitorStatusChange(admin: SupabaseClient, visitor: Visitor, nextStatus: Visitor["status"]) {
  if (nextStatus === "verified" || nextStatus === "checked-in") {
    if (visitor.status === "cancelled" || visitor.status === "expired" || visitor.status === "checked-out") {
      return errorResponse("This visitor code cannot be verified or checked in again.", 400);
    }

    const windowState = getVisitorWindowState(visitor);
    if (!windowState.canVerifyOrCheckIn) {
      if (windowState.status === "expired") {
        await admin.from("visitors").update({ status: "expired" }).eq("id", visitor.id);
      }

      return errorResponse(`${windowState.message} Visitor codes are valid for ${VISITOR_CODE_VALIDITY_HOURS} hours after generation.`, windowState.status === "expired" ? 410 : 403);
    }
  }

  if (nextStatus === "checked-out" && visitor.status !== "checked-in") {
    return errorResponse("Only checked-in visitors can be checked out.", 400);
  }

  if (nextStatus === "cancelled" && visitor.status === "checked-out") {
    return errorResponse("Checked-out visitors cannot be rejected.", 400);
  }

  return null;
}

async function writeVisitorLog(
  admin: SupabaseClient,
  profile: SecurityProfile,
  visitor: Visitor,
  status: Visitor["status"]
) {
  const now = new Date().toISOString();
  const decision = status === "cancelled" ? "rejected" : toSupabaseVisitorStatus(status);

  if (status === "checked-out") {
    const { data: latestLog } = await admin
      .from("visitor_logs")
      .select("id")
      .eq("visitor_id", visitor.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestLog?.id) {
      await admin
        .from("visitor_logs")
        .update({ exit_time: now, decision })
        .eq("id", latestLog.id);
      return;
    }
  }

  await admin.from("visitor_logs").insert({
    estate_id: visitor.estateId,
    visitor_id: visitor.id,
    security_guard_id: profile.id,
    gate_name: "Main Gate A",
    entry_time: status === "checked-in" ? now : null,
    exit_time: status === "checked-out" ? now : null,
    decision
  });
}

function toSupabaseVisitorStatus(status: Visitor["status"]) {
  return status.replaceAll("-", "_");
}

function mapResident(row: Record<string, any>): Resident {
  return {
    id: row.id,
    estateId: row.estate_id,
    name: row.full_name,
    houseNumber: row.apartment_number,
    phone: row.phone ?? "Not provided",
    email: row.email ?? "",
    type: row.resident_type === "family_member" ? "family member" : row.resident_type,
    status: row.status === "moved_out" ? "moved out" : row.status
  };
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
