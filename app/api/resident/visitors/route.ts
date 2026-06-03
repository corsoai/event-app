import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { UserRole, Visitor } from "@/lib/types";
import { getVisitorExpiresAtIso } from "@/lib/visitor-window";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

type ResidentProfile = {
  id: string;
  estate_id: string;
  email: string;
  full_name: string;
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
  resident_type: string;
  status: string;
};

export async function POST(request: NextRequest) {
  const auth = await requireResident(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return errorResponse("Invalid visitor request.", 400);
  }

  const visitorName = String(body.visitorName ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const visitDate = String(body.visitDate ?? "").trim();
  const arrivalTime = String(body.arrivalTime ?? "").trim();
  const purpose = String(body.purpose ?? "").trim();
  const count = Number(body.count ?? 1);

  if (!visitorName || !visitDate || !arrivalTime || !purpose) {
    return errorResponse("Visitor name, visit date, arrival time, and purpose are required.", 400);
  }

  if (!Number.isFinite(count) || count < 1 || count > 20) {
    return errorResponse("Number of visitors must be between 1 and 20.", 400);
  }

  const accessCode = await makeUniqueAccessCode(auth.admin, auth.profile.estate_id);
  const createdAt = new Date().toISOString();
  const { data, error } = await auth.admin
    .from("visitors")
    .insert({
      estate_id: auth.profile.estate_id,
      resident_id: auth.resident.id,
      visitor_name: visitorName,
      phone: phone || null,
      visit_date: visitDate,
      expected_arrival_time: arrivalTime,
      purpose,
      visitor_count: count,
      access_code: accessCode,
      qr_payload: accessCode,
      expires_at: getVisitorExpiresAtIso({ visitDate, arrivalTime, createdAt }),
      status: "pending",
      created_by: auth.profile.id,
      created_at: createdAt
    })
    .select("*")
    .single();

  if (error || !data) {
    return errorResponse(error?.message ?? "Visitor invitation could not be saved.", 400);
  }

  return NextResponse.json({ visitor: mapVisitor(data) });
}

async function requireResident(
  request: NextRequest
): Promise<{ admin: SupabaseClient; profile: ResidentProfile; resident: ResidentRow } | NextResponse> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse("Supabase public environment variables are missing.", 500);
  }

  if (!supabaseSecretKey) {
    return errorResponse("SUPABASE_SECRET_KEY is missing in Vercel.", 500);
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return errorResponse("You must be logged in as a resident to invite visitors.", 401);
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
    .select("id,estate_id,email,full_name,role,is_active")
    .eq("auth_user_id", userResult.user.id)
    .single();

  if (profileError || !profile) {
    return errorResponse("No active resident profile was found for this account.", 403);
  }

  if (!profile.is_active) {
    return errorResponse("This resident account is suspended.", 403);
  }

  if (profile.role !== "resident" || !profile.estate_id) {
    return errorResponse("Only resident accounts can create visitor invitations.", 403);
  }

  const resident = await findOrCreateResident(admin, profile as ResidentProfile);
  if (resident instanceof NextResponse) {
    return resident;
  }

  return { admin, profile: profile as ResidentProfile, resident };
}

async function findOrCreateResident(admin: SupabaseClient, profile: ResidentProfile) {
  const { data: existingByProfile } = await admin
    .from("residents")
    .select("*")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (existingByProfile) {
    return existingByProfile as ResidentRow;
  }

  const { data: existingByEmail } = await admin
    .from("residents")
    .select("*")
    .eq("email", profile.email)
    .maybeSingle();

  if (existingByEmail) {
    const { data: updated, error: updateError } = await admin
      .from("residents")
      .update({ profile_id: profile.id, estate_id: profile.estate_id, status: "active" })
      .eq("id", existingByEmail.id)
      .select("*")
      .single();

    if (updateError || !updated) {
      return errorResponse(updateError?.message ?? "Resident profile could not be linked.", 400);
    }

    return updated as ResidentRow;
  }

  const { data: created, error: createError } = await admin
    .from("residents")
    .insert({
      estate_id: profile.estate_id,
      profile_id: profile.id,
      full_name: profile.full_name,
      apartment_number: "Pending assignment",
      email: profile.email,
      resident_type: "tenant",
      status: "active"
    })
    .select("*")
    .single();

  if (createError || !created) {
    return errorResponse(createError?.message ?? "Resident profile could not be created.", 400);
  }

  return created as ResidentRow;
}

async function makeUniqueAccessCode(admin: SupabaseClient, estateId: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = String(randomInt(100000, 1000000));
    const { data } = await admin
      .from("visitors")
      .select("id")
      .eq("estate_id", estateId)
      .eq("access_code", code)
      .maybeSingle();

    if (!data) {
      return code;
    }
  }

  throw new Error("Could not generate a unique visitor code.");
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

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
