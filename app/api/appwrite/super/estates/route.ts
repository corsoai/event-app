import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/lib/types";
import {
  AppwriteRestError,
  appwriteUpsertRow,
  ensureAppwriteSchemaReady
} from "@/lib/appwrite/server";
import { listAppwriteTableRows } from "@/lib/appwrite/residents";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";
import { sortEstatesWithDefaultFirst } from "@/lib/utils";

const allowedRoles: UserRole[] = ["super_admin"];

type AppwriteEstateRow = {
  $id?: string;
  name?: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  gateName?: string;
  createdAt?: string;
};

export async function GET(request: NextRequest) {
  try {
    await resolveSessionContext(request, { allowedRoles });
    await ensureAppwriteSchemaReady();
    const rows = await listAppwriteTableRows<AppwriteEstateRow>("estates");

    return NextResponse.json({
      estates: sortEstatesWithDefaultFirst(rows.map(estateRowToView))
    });
  } catch (error) {
    return errorResponse(error, "Unable to load estates.");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid estate request." }, { status: 400 });
  }

  try {
    await resolveSessionContext(request, { allowedRoles });
    await ensureAppwriteSchemaReady();

    const name = String(body.name ?? "").trim();
    const address = String(body.address ?? "").trim();
    const contactEmail = String(body.contactEmail ?? "").trim().toLowerCase();
    const contactPhone = String(body.contactPhone ?? "").trim();
    const gateName = String(body.gateName ?? "Main Gate").trim() || "Main Gate";

    if (!name || !address) {
      return NextResponse.json({ error: "Estate name and address are required." }, { status: 400 });
    }

    const estateId = estateSlug(name);
    if (!estateId) {
      return NextResponse.json({ error: "Estate name must contain letters or numbers." }, { status: 400 });
    }

    const existing = await listAppwriteTableRows<AppwriteEstateRow>("estates");
    if (existing.some((row) => row.$id === estateId)) {
      return NextResponse.json({ error: `An estate with the ID "${estateId}" already exists.` }, { status: 409 });
    }
    if (existing.some((row) => (row.name ?? "").trim().toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: `An estate named "${name}" already exists.` }, { status: 409 });
    }

    const now = new Date().toISOString();
    await appwriteUpsertRow("estates", estateId, {
      name,
      address,
      contactEmail,
      contactPhone,
      gateName,
      createdAt: now,
      updatedAt: now
    });

    return NextResponse.json({
      estate: {
        id: estateId,
        name,
        address,
        contactEmail,
        contactPhone,
        gateName,
        createdAt: now
      }
    });
  } catch (error) {
    return errorResponse(error, "Unable to create estate.");
  }
}

function estateRowToView(row: AppwriteEstateRow) {
  return {
    id: row.$id ?? "",
    name: row.name ?? "Unnamed estate",
    address: row.address ?? "",
    contactEmail: row.contactEmail ?? "",
    contactPhone: row.contactPhone ?? "",
    gateName: row.gateName ?? "Main Gate",
    createdAt: row.createdAt ?? ""
  };
}

function estateSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof SessionContextError
    ? error.status
    : error instanceof AppwriteRestError
      ? error.status
      : 400;
  return NextResponse.json({ error: message }, { status });
}
