import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/lib/types";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";

const allowedRoles: UserRole[] = ["security_guard", "cso", "estate_admin", "super_admin"];

type PlateRecognizerResult = {
  plate?: string;
  score?: number;
  region?: { code?: string };
  vehicle?: { type?: string };
};

export async function POST(request: NextRequest) {
  try {
    await resolveSessionContext(request, { allowedRoles });

    const token = process.env.PLATE_RECOGNIZER_TOKEN;
    if (!token) {
      // Not configured yet — client will fall back to on-device OCR.
      return NextResponse.json({ error: "Cloud plate recognition is not configured.", configured: false }, { status: 503 });
    }

    const incoming = await request.formData();
    const file = incoming.get("upload");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "No image was provided." }, { status: 400 });
    }

    const forward = new FormData();
    forward.append("upload", file, "plate.jpg");
    forward.append("regions", "ng");

    const prResponse = await fetch("https://api.platerecognizer.com/v1/plate-reader/", {
      method: "POST",
      headers: { Authorization: `Token ${token}` },
      body: forward
    });

    const data = await prResponse.json().catch(() => null) as { results?: PlateRecognizerResult[]; detail?: string; error?: string } | null;

    if (!prResponse.ok) {
      const message = data?.detail || data?.error || "Plate recognition service error.";
      return NextResponse.json({ error: String(message) }, { status: prResponse.status });
    }

    const best = Array.isArray(data?.results) && data.results.length ? data.results[0] : null;
    if (!best || !best.plate) {
      return NextResponse.json({ plate: "", score: 0, region: "", vehicleType: "" });
    }

    return NextResponse.json({
      plate: String(best.plate).toUpperCase(),
      score: Number(best.score ?? 0),
      region: String(best.region?.code ?? ""),
      vehicleType: String(best.vehicle?.type ?? "")
    });
  } catch (error) {
    const status = error instanceof SessionContextError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Plate recognition failed.";
    return NextResponse.json({ error: message }, { status });
  }
}
