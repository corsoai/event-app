import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/types";
import { getPasswordQualityError } from "@/lib/password-policy";
import { isPhoneAuthEmail, normalizePhoneNumber, phoneAuthEmail } from "@/lib/utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

type AdminProfile = {
  id: string;
  estate_id: string | null;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
};

type TargetProfile = AdminProfile & {
  auth_user_id: string | null;
  phone: string | null;
};

const superAdminRoles: UserRole[] = ["super_admin", "estate_admin", "cso", "security_guard", "resident", "vendor"];
const estateAdminRoles: UserRole[] = ["cso", "security_guard", "resident", "vendor"];

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const query = auth.profile.role === "super_admin"
    ? auth.admin
        .from("profiles")
        .select("id,auth_user_id,estate_id,full_name,email,phone,role,is_active,created_at,estates(name)")
        .order("created_at", { ascending: false })
    : auth.admin
        .from("profiles")
        .select("id,auth_user_id,estate_id,full_name,email,phone,role,is_active,created_at,estates(name)")
        .eq("estate_id", auth.profile.estate_id)
        .in("role", estateAdminRoles)
        .order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) {
    return errorResponse(error.message, 400);
  }

  const profileIds = (data ?? []).map((user) => user.id);
  const { data: residents } = profileIds.length
    ? await auth.admin
        .from("residents")
        .select("profile_id,apartment_number,status")
        .in("profile_id", profileIds)
    : { data: [] };
  const residentByProfileId = new Map((residents ?? []).map((resident) => [resident.profile_id, resident]));

  return NextResponse.json({
    users: (data ?? []).map((user) => {
      const resident = residentByProfileId.get(user.id);

      return {
        id: user.id,
        authUserId: user.auth_user_id,
        estateId: user.estate_id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone ?? "",
        role: user.role,
        active: user.is_active,
        estate: relationName(user.estates) ?? (user.role === "super_admin" ? "All estates" : "Unassigned"),
        houseNumber: resident?.apartment_number ?? "",
        createdAt: String(user.created_at).slice(0, 10)
      };
    })
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return errorResponse("Invalid request body.", 400);
  }

  const fullName = String(body.fullName ?? "").trim();
  const rawEmail = String(body.email ?? "").trim().toLowerCase();
  const phone = normalizePhoneNumber(String(body.phone ?? ""));
  const role = String(body.role ?? "resident") as UserRole;
  const estateId = String(body.estateId ?? auth.profile.estate_id ?? "").trim();
  const houseNumber = String(body.houseNumber ?? "Pending assignment").trim() || "Pending assignment";
  const providedPassword = String(body.password ?? "").trim();
  const shouldEmailInvite = Boolean(body.emailInvite);
  const email = rawEmail || phoneAuthEmail(phone);
  const providedPasswordError = providedPassword ? getPasswordQualityError(providedPassword) : "";
  if (providedPasswordError) {
    return errorResponse(providedPasswordError, 400);
  }

  const password = providedPassword.length >= 8 ? providedPassword : makeTemporaryPassword();

  if (!fullName || !phone) {
    return errorResponse("Full name and phone number are required.", 400);
  }

  if (rawEmail && !rawEmail.includes("@")) {
    return errorResponse("Enter a valid email address or leave email empty.", 400);
  }

  const allowedRoles = auth.profile.role === "super_admin" ? superAdminRoles : estateAdminRoles;
  if (!allowedRoles.includes(role)) {
    return errorResponse("You are not allowed to create this role.", 403);
  }

  if (auth.profile.role === "estate_admin" && estateId !== auth.profile.estate_id) {
    return errorResponse("Estate admins can only create users for their assigned estate.", 403);
  }

  if (role !== "super_admin" && !estateId) {
    return errorResponse("An estate is required for this user role.", 400);
  }

  const userMetadata = {
      full_name: fullName,
      role,
      estate_id: role === "super_admin" ? null : estateId
  };
  const canEmailInvite = shouldEmailInvite && rawEmail && !isPhoneAuthEmail(email);
  const authResult = canEmailInvite
    ? await auth.admin.auth.admin.inviteUserByEmail(email, {
        data: userMetadata,
        redirectTo: authRedirectUrl(request)
      })
    : await auth.admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: userMetadata
      });
  const { data: authUser, error: authError } = authResult;

  if (authError || !authUser.user) {
    const message = authError?.message ?? "Unable to create the Supabase Auth user.";
    return errorResponse(message.includes("already") ? "This email already exists. Use the Email setup button to send that user a setup link." : message, 400);
  }

  const { data: profile, error: profileError } = await auth.admin
    .from("profiles")
    .upsert(
      {
        auth_user_id: authUser.user.id,
        estate_id: role === "super_admin" ? null : estateId,
        full_name: fullName,
        email,
        phone: phone || null,
        role,
        is_active: true
      },
      { onConflict: "email" }
    )
    .select("id")
    .single();

  if (profileError || !profile) {
    return errorResponse(profileError?.message ?? "User profile could not be created.", 400);
  }

  await syncResident(auth.admin, {
    profileId: profile.id,
    estateId,
    fullName,
    email,
    phone,
    role,
    houseNumber,
    active: true
  });

  const setupLink = await generateSetupLink(auth.admin, email, request);

  return NextResponse.json({
    message: canEmailInvite
      ? `${fullName} has been created as ${roleLabel(role)} and an invite email has been sent.`
      : `${fullName} has been created as ${roleLabel(role)}.`,
    temporaryPassword: canEmailInvite ? "" : password,
    loginIdentifier: rawEmail || phone,
    setupLink: canEmailInvite ? setupLink : "",
    user: {
      email,
      phone,
      fullName,
      role
    }
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return errorResponse("Invalid request body.", 400);
  }

  const profileId = String(body.profileId ?? "").trim();
  const action = String(body.action ?? "update");
  const target = await getTargetProfile(auth.admin, profileId);
  if (!target) {
    return errorResponse("User profile was not found.", 404);
  }

  const permissionError = assertCanManage(auth.profile, target);
  if (permissionError) {
    return permissionError;
  }

  if (target.id === auth.profile.id && action !== "update") {
    return errorResponse("You cannot suspend, reactivate, or delete your own account.", 400);
  }

  if (action === "send_setup_email") {
    if (isPhoneAuthEmail(target.email)) {
      return NextResponse.json({
        message: "This is a phone-only account. Give the resident a temporary password instead of sending email.",
        setupLink: ""
      });
    }

    const mailer = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { error: emailError } = await mailer.auth.resetPasswordForEmail(target.email, {
      redirectTo: authRedirectUrl(request)
    });
    const setupLink = await generateSetupLink(auth.admin, target.email, request);

    if (emailError) {
      return NextResponse.json({
        message: `Email could not be sent: ${emailError.message}. Use the manual setup link below.`,
        setupLink
      });
    }

    return NextResponse.json({
      message: `A password setup email has been sent to ${target.email}. If it does not arrive, use the manual setup link below.`,
      setupLink
    });
  }

  if (action === "reset_password") {
    if (!target.auth_user_id) {
      return errorResponse("This user does not have a linked login account.", 400);
    }

    const password = makeTemporaryPassword();
    const { error: authError } = await auth.admin.auth.admin.updateUserById(target.auth_user_id, {
      password
    });

    if (authError) {
      return errorResponse(authError.message, 400);
    }

    return NextResponse.json({
      message: `${target.full_name}'s password has been reset. Give the temporary password privately.`,
      temporaryPassword: password,
      loginIdentifier: target.phone || target.email,
      user: {
        email: target.email,
        phone: target.phone ?? "",
        fullName: target.full_name,
        role: target.role
      }
    });
  }

  const fullName = String(body.fullName ?? target.full_name).trim();
  const phone = String(body.phone ?? target.phone ?? "").trim();
  const role = String(body.role ?? target.role) as UserRole;
  const active = action === "suspend" ? false : action === "reactivate" ? true : Boolean(body.active ?? target.is_active);
  const estateId = role === "super_admin" ? null : String(body.estateId ?? target.estate_id ?? "").trim();
  const houseNumber = String(body.houseNumber ?? "Pending assignment").trim() || "Pending assignment";

  const allowedRoles = auth.profile.role === "super_admin" ? superAdminRoles : estateAdminRoles;
  if (!allowedRoles.includes(role)) {
    return errorResponse("You are not allowed to assign this role.", 403);
  }

  if (auth.profile.role === "estate_admin" && estateId !== auth.profile.estate_id) {
    return errorResponse("Estate admins can only manage users in their assigned estate.", 403);
  }

  if (role !== "super_admin" && !estateId) {
    return errorResponse("An estate is required for this user role.", 400);
  }

  const { error: profileError } = await auth.admin
    .from("profiles")
    .update({
      estate_id: estateId,
      full_name: fullName,
      phone: phone || null,
      role,
      is_active: active
    })
    .eq("id", target.id);

  if (profileError) {
    return errorResponse(profileError.message, 400);
  }

  if (target.auth_user_id) {
    const { error: authError } = await auth.admin.auth.admin.updateUserById(target.auth_user_id, {
      user_metadata: {
        full_name: fullName,
        role,
        estate_id: estateId
      }
    });

    if (authError) {
      return errorResponse(authError.message, 400);
    }
  }

  await syncResident(auth.admin, {
    profileId: target.id,
    estateId: estateId ?? "",
    fullName,
    email: target.email,
    phone,
    role,
    houseNumber,
    active
  });

  const verb = action === "suspend" ? "suspended" : action === "reactivate" ? "reactivated" : "updated";
  return NextResponse.json({ message: `${fullName} has been ${verb}.` });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId") ?? "";
  const target = await getTargetProfile(auth.admin, profileId);
  if (!target) {
    return errorResponse("User profile was not found.", 404);
  }

  const permissionError = assertCanManage(auth.profile, target);
  if (permissionError) {
    return permissionError;
  }

  if (target.id === auth.profile.id) {
    return errorResponse("You cannot delete your own account.", 400);
  }

  await auth.admin
    .from("residents")
    .delete()
    .eq("profile_id", target.id);

  if (target.auth_user_id) {
    const { error: authError } = await auth.admin.auth.admin.deleteUser(target.auth_user_id);
    if (authError) {
      return errorResponse(authError.message, 400);
    }
  } else {
    const { error: profileError } = await auth.admin
      .from("profiles")
      .delete()
      .eq("id", target.id);

    if (profileError) {
      return errorResponse(profileError.message, 400);
    }
  }

  return NextResponse.json({ message: `${target.full_name} has been deleted.` });
}

async function requireAdmin(request: NextRequest): Promise<{ admin: SupabaseClient; profile: AdminProfile } | NextResponse> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse("Supabase public environment variables are missing.", 500);
  }

  if (!supabaseSecretKey) {
    return errorResponse("SUPABASE_SECRET_KEY is missing in Vercel. Add it before creating users in-app.", 500);
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return errorResponse("You must be logged in to manage users.", 401);
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
    return errorResponse("No active admin profile was found for this account.", 403);
  }

  if (!profile.is_active) {
    return errorResponse("This admin account is suspended.", 403);
  }

  if (!["super_admin", "estate_admin"].includes(profile.role)) {
    return errorResponse("Only Super Admins and Estate Admins can manage users.", 403);
  }

  return { admin, profile: profile as AdminProfile };
}

async function getTargetProfile(admin: SupabaseClient, profileId: string) {
  if (!profileId) {
    return null;
  }

  const { data, error } = await admin
    .from("profiles")
    .select("id,auth_user_id,estate_id,email,full_name,phone,role,is_active")
    .eq("id", profileId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as TargetProfile;
}

function assertCanManage(adminProfile: AdminProfile, target: TargetProfile) {
  if (adminProfile.role === "super_admin") {
    return null;
  }

  if (target.estate_id !== adminProfile.estate_id) {
    return errorResponse("Estate admins can only manage users in their assigned estate.", 403);
  }

  if (!estateAdminRoles.includes(target.role)) {
    return errorResponse("Estate admins cannot manage Super Admin or Estate Admin accounts.", 403);
  }

  return null;
}

async function syncResident(
  admin: SupabaseClient,
  input: {
    profileId: string;
    estateId: string;
    fullName: string;
    email: string;
    phone: string;
    role: UserRole;
    houseNumber: string;
    active: boolean;
  }
) {
  const { data: existingResident } = await admin
    .from("residents")
    .select("id")
    .eq("email", input.email)
    .maybeSingle();

  if (input.role !== "resident") {
    if (existingResident) {
      await admin
        .from("residents")
        .update({ profile_id: null, status: "inactive" })
        .eq("id", existingResident.id);
    }

    return;
  }

  if (existingResident) {
    await admin
      .from("residents")
      .update({
        estate_id: input.estateId,
        profile_id: input.profileId,
        full_name: input.fullName,
        apartment_number: input.houseNumber,
        phone: input.phone || null,
        status: input.active ? "active" : "inactive"
      })
      .eq("id", existingResident.id);
  } else {
    await admin.from("residents").insert({
      estate_id: input.estateId,
      profile_id: input.profileId,
      full_name: input.fullName,
      apartment_number: input.houseNumber,
      phone: input.phone || null,
      email: input.email,
      resident_type: "tenant",
      status: input.active ? "active" : "inactive"
    });
  }
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function makeTemporaryPassword() {
  return `Corso-${randomBytes(5).toString("hex")}-247`;
}

function roleLabel(role: UserRole) {
  return role.replaceAll("_", " ");
}

async function generateSetupLink(admin: SupabaseClient, email: string, request: NextRequest) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: authRedirectUrl(request)
    }
  });

  if (error) {
    return "";
  }

  return data.properties?.action_link ?? "";
}

function authRedirectUrl(request: NextRequest) {
  return `${request.nextUrl.origin}/login`;
}

function relationName(value: unknown) {
  if (Array.isArray(value)) {
    return value[0]?.name;
  }

  if (value && typeof value === "object" && "name" in value) {
    return String((value as { name?: string }).name ?? "");
  }

  return null;
}
