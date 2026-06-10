import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/lib/types";
import { accessRequestErrorResponse, submitAppwriteAccessRequest } from "@/lib/appwrite/access-requests";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const result = await submitAppwriteAccessRequest({
      fullName: String(body.fullName ?? ""),
      phone: String(body.phone ?? ""),
      email: String(body.email ?? ""),
      password: String(body.password ?? ""),
      role: String(body.role ?? "resident") as UserRole,
      estate: String(body.estate ?? ""),
      estateId: body.estateId === undefined ? undefined : String(body.estateId)
    });

    return NextResponse.json(result);
  } catch (error) {
    const response = accessRequestErrorResponse(error, "Access request could not be submitted.");
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
