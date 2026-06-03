import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Resident, UserRole } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

type AdminProfile = {
  id: string;
  estate_id: string | null;
  role: UserRole;
  is_active: boolean;
};

type ResidentRow = {
  id: string;
  estate_id: string;
  profile_id: string | null;
  full_name: string;
  apartment_number: string;
  phone: string | null;
  email: string | null;
  resident_type: "owner" | "tenant" | "family_member";
  status: "active" | "inactive" | "moved_out";
};

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return errorResponse("Invalid resident update request.", 400);
  }

  const residentId = String(body.residentId ?? "").trim();
  const name = String(body.name ?? "").trim();
  const houseNumber = String(body.houseNumber ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const residentType = toSupabaseResidentType(String(body.type ?? ""));
  const status = toSupabaseResidentStatus(String(body.status ?? ""));

  if (!residentId) {
    return errorResponse("Resident id is required.", 400);
  }

  if (!name || !houseNumber) {
    return errorResponse("Resident name and apartment / house number are required.", 400);
  }

  if (email && !email.includes("@")) {
    return errorResponse("Enter a valid resident email address or leave it empty.", 400);
  }

  if (!residentType || !status) {
    return errorResponse("Choose a valid resident type and status.", 400);
  }

  const { data: target, error: targetError } = await auth.admin
    .from("residents")
    .select("id,estate_id,profile_id,full_name,apartment_number,phone,email,resident_type,status")
    .eq("id", residentId)
    .single();

  if (targetError || !target) {
    return errorResponse("Resident record was not found.", 404);
  }

  if (auth.profile.role === "estate_admin" && target.estate_id !== auth.profile.estate_id) {
    return errorResponse("Estate admins can only edit residents inside their assigned estate.", 403);
  }

  const { data: updated, error: updateError } = await auth.admin
    .from("residents")
    .update({
      full_name: name,
      apartment_number: houseNumber,
      phone: phone || null,
      email: email || null,
      resident_type: residentType,
      status
    })
    .eq("id", residentId)
    .select("id,estate_id,profile_id,full_name,apartment_number,phone,email,resident_type,status")
    .single();

  if (updateError || !updated) {
    return errorResponse(updateError?.message ?? "Resident record could not be updated.", 400);
  }

  if (updated.profile_id) {
    await auth.admin
      .from("profiles")
      .update({
        full_name: name,
        phone: phone || null,
        is_active: status === "active"
      })
      .eq("id", updated.profile_id);
  }

  return NextResponse.json({ resident: mapResident(updated as ResidentRow) });
}

async function requireAdmin(
  request: NextRequest
): Promise<{ admin: SupabaseClient; profile: AdminProfile } | NextResponse> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse("Supabase public environment variables are missing.", 500);
  }

  if (!supabaseSecretKey) {
    return errorResponse("SUPABASE_SECRET_KEY is missing in Vercel.", 500);
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return errorResponse("You must be logged in as an admin to edit residents.", 401);
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
    return errorResponse("Only Super Admins and Estate Admins can edit residents.", 403);
  }

  return { admin, profile: profile as AdminProfile };
}

function toSupabaseResidentType(value: string) {
  if (value === "family member" || value === "family_member") {
    return "family_member";
  }

  if (value === "owner" || value === "tenant") {
    return value;
  }

  return "";
}

function toSupabaseResidentStatus(value: string) {
  if (value === "moved out" || value === "moved_out") {
    return "moved_out";
  }

  if (value === "active" || value === "inactive") {
    return value;
  }

  return "";
}

function mapResident(row: ResidentRow): Resident {
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
