import { NextResponse } from "next/server";
import { APPWRITE_LBSVIEW_ESTATE_ID, appwriteUpsertRow, ensureAppwriteSchemaReady } from "@/lib/appwrite/server";
import { listAppwriteTableRows } from "@/lib/appwrite/residents";
import { DEFAULT_ESTATE_NAME, sortEstatesWithDefaultFirst } from "@/lib/utils";

type AppwriteEstateRow = {
  $id?: string;
  name?: string;
};

export async function GET() {
  try {
    await ensureAppwriteSchemaReady();
    await appwriteUpsertRow("estates", APPWRITE_LBSVIEW_ESTATE_ID, {
      name: DEFAULT_ESTATE_NAME,
      address: "LBS View Estate, Lagos",
      contactEmail: "admin@lbsviewestate.example",
      contactPhone: "+2348011112040",
      gateName: "Main Gate",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    const estates = await listAppwriteTableRows<AppwriteEstateRow>("estates");

    return NextResponse.json({
      estates: sortEstatesWithDefaultFirst(
        estates.map((estate) => ({
          id: estate.$id ?? "",
          name: estate.name ?? DEFAULT_ESTATE_NAME
        }))
      )
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Estate list could not be loaded.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
