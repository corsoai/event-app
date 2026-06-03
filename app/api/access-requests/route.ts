import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/types";
import { normalizePhoneNumber, phoneAuthEmail } from "@/lib/utils";
import { getPasswordQualityError } from "@/lib/password-policy";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicRequestRoles: UserRole[] = ["resident"];

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseSecretKey) {
    return errorResponse("Online access requests are not configured yet.", 500);
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return errorResponse("Invalid request body.", 400);
  }

  const fullName = String(body.fullName ?? "").trim();
  const phone = normalizePhoneNumber(String(body.phone ?? ""));
  const optionalEmail = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "").trim();
  const role = String(body.role ?? "resident") as UserRole;
  const rawEstateId = String(body.estateId ?? "").trim() || null;
  const requestedEstateName = String(body.estate ?? "").trim();

  if (!fullName || !phone) {
    return errorResponse("Full name and phone number are required.", 400);
  }

  if (phone.length < 10) {
    return errorResponse("Enter a valid phone number.", 400);
  }

  if (optionalEmail && !optionalEmail.includes("@")) {
    return errorResponse("Enter a valid email address or leave email empty.", 400);
  }

  const passwordError = getPasswordQualityError(password);
  if (passwordError) {
    return errorResponse(passwordError, 400);
  }

  if (!publicRequestRoles.includes(role)) {
    return errorResponse("Residents should request access here. Admin can create other roles after login.", 403);
  }

  const authEmail = phoneAuthEmail(phone);
  const admin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const estate = await resolveRequestedEstate(admin, rawEstateId, requestedEstateName);
  if (estate instanceof NextResponse) {
    return estate;
  }

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id,is_active")
    .eq("email", authEmail)
    .maybeSingle();

  if (existingProfile?.is_active) {
    return NextResponse.json({
      status: "already-approved",
      message: "This phone number is already approved. Go back to login and sign in."
    });
  }

  const { data: previousRequest } = await admin
    .from("access_requests")
    .select("id,auth_user_id,status")
    .eq("phone", phone)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let authUserId = previousRequest?.auth_user_id ?? "";

  if (authUserId) {
    const { error: updateAuthError } = await admin.auth.admin.updateUserById(authUserId, {
      password,
      user_metadata: {
        full_name: fullName,
        phone,
        contact_email: optionalEmail || null,
        requested_role: role,
        estate_id: estate.id,
        estate_name: estate.name
      }
    });

    if (updateAuthError) {
      return errorResponse(updateAuthError.message, 400);
    }
  } else {
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone,
        contact_email: optionalEmail || null,
        requested_role: role,
        estate_id: estate.id,
        estate_name: estate.name
      }
    });

    if (authError || !authUser.user) {
      const message = authError?.message ?? "Unable to create access login.";
      return errorResponse(message.includes("already") ? "This phone number already has a login. Ask admin to approve or reset it." : message, 400);
    }

    authUserId = authUser.user.id;
  }

  const { data: pendingByPhone } = await admin
    .from("access_requests")
    .select("id,auth_user_id,estate_id,status")
    .eq("phone", phone)
    .eq("status", "pending")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingByPhone) {
    const { error: updateRequestError } = await admin
      .from("access_requests")
      .update({
        auth_user_id: authUserId || pendingByPhone.auth_user_id,
        estate_id: estate.id,
        full_name: fullName,
        email: authEmail,
        phone,
        requested_role: role,
        requested_at: new Date().toISOString()
      })
      .eq("id", pendingByPhone.id);

    if (updateRequestError) {
      return errorResponse(updateRequestError.message, 400);
    }

    return NextResponse.json({
      status: "already-pending",
      estateId: estate.id,
      estateName: estate.name,
      message: `This phone number already has a pending access request for ${estate.name}. Ask admin to approve it.`
    });
  }

  const { error: requestError } = await admin.from("access_requests").insert({
    auth_user_id: authUserId,
    estate_id: estate.id,
    full_name: fullName,
    email: authEmail,
    phone,
    requested_role: role,
    status: "pending"
  });

  if (requestError) {
    return errorResponse(requestError.message.includes("duplicate") ? "This phone number already has a pending access request." : requestError.message, 400);
  }

  return NextResponse.json({
    status: "created",
    estateId: estate.id,
    estateName: estate.name,
    message: `Access request submitted to ${estate.name}. An estate admin must approve this account before login.`
  });
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

type EstateSelection = {
  id: string;
  name: string;
};

async function resolveRequestedEstate(
  admin: SupabaseClient,
  estateId: string | null,
  estateName: string
): Promise<EstateSelection | NextResponse> {
  if (estateId && isUuid(estateId)) {
    const { data } = await admin
      .from("estates")
      .select("id,name")
      .eq("id", estateId)
      .maybeSingle();

    if (data) {
      return data as EstateSelection;
    }
  }

  const { data: estates, error } = await admin
    .from("estates")
    .select("id,name")
    .order("created_at", { ascending: true });

  if (error) {
    return errorResponse("The estate list could not be checked. Try again or contact admin.", 400);
  }

  const availableEstates = (estates ?? []) as EstateSelection[];
  if (!availableEstates.length) {
    return errorResponse("No estate has been created yet. Create an estate before residents request access.", 400);
  }

  const normalizedName = normalizeEstateName(estateName);
  if (normalizedName) {
    const exactMatch = availableEstates.find((estate) => normalizeEstateName(estate.name) === normalizedName);
    if (exactMatch) {
      return exactMatch;
    }

    const closeMatch = availableEstates.find((estate) => {
      const candidate = normalizeEstateName(estate.name);
      return candidate.includes(normalizedName) || normalizedName.includes(candidate);
    });
    if (closeMatch) {
      return closeMatch;
    }
  }

  if (availableEstates.length === 1) {
    return availableEstates[0];
  }

  return errorResponse("Selected estate could not be found. Refresh the signup page and choose the estate again.", 400);
}

function normalizeEstateName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
