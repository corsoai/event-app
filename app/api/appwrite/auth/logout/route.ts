import { NextResponse } from "next/server";

const authCookies = [
  { name: "corso_role", httpOnly: false },
  { name: "corso_appwrite_user", httpOnly: true },
  { name: "corso_appwrite_session", httpOnly: true }
] as const;

export async function POST() {
  const response = NextResponse.json({ ok: true });

  for (const cookie of authCookies) {
    response.cookies.set(cookie.name, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: cookie.httpOnly
    });
  }

  return response;
}
