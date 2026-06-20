import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { ensureDefaultAppwriteLoginUser, loginWithAppwrite } from "@/lib/appwrite/users";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid login request." }, { status: 400 });
  }

  const identifier = String(body.identifier ?? "");
  const password = String(body.password ?? "");
  if (!identifier.trim() || !password) {
    return NextResponse.json({ error: "Phone/email and password are required." }, { status: 400 });
  }

  try {
    const user = await loginWithAppwrite(identifier, password);
    return loginResponse(user);
  } catch (error) {
    const ensured = await ensureDefaultAppwriteLoginUser(identifier, password).catch(() => null);
    if (ensured) {
      try {
        const user = await loginWithAppwrite(identifier, password);
        return loginResponse(user);
      } catch {
        // Fall through to the original error so the caller gets the true login failure.
      }
    }

    const status = error instanceof AppwriteRestError && error.status === 401 ? 401 : 400;
    const message = error instanceof Error ? error.message : "Unable to sign in with Appwrite.";
    return NextResponse.json({ error: status === 401 ? "Invalid login details." : message }, { status });
  }
}

function loginResponse(user: Awaited<ReturnType<typeof loginWithAppwrite>>) {
  const { appwriteSessionSecret, appwriteUserId, ...publicUser } = user;
  const response = NextResponse.json({ user: publicUser });
  response.cookies.set("corso_role", user.role, {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  response.cookies.set("corso_appwrite_user", appwriteUserId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true
  });
  response.cookies.set("corso_appwrite_session", appwriteSessionSecret, {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true
  });

  return response;
}
