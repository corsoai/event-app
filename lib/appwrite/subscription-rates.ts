import type { SubscriptionRate } from "@/lib/types";
import { APPWRITE_TABLE_SUBSCRIPTION_RATES } from "@/lib/appwrite/schema";
import { APPWRITE_LBSVIEW_ESTATE_ID, appwriteUpsertRow, safeAppwriteId } from "@/lib/appwrite/server";

type SubscriptionRateSeed = Pick<
  SubscriptionRate,
  "apartmentType" | "monthlyRate"
>;

type AppwriteSubscriptionRateRow = {
  $id?: string;
  estateId?: string;
  apartmentType?: SubscriptionRate["apartmentType"];
  monthlyRate?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  createdBy?: string;
  reason?: string;
  createdAt?: string;
  updatedAt?: string;
};

export const LBSVIEW_INITIAL_SUBSCRIPTION_RATE_SEEDS: SubscriptionRateSeed[] = [
  { apartmentType: "SELF_CONTAINED", monthlyRate: 2000 },
  { apartmentType: "ONE_BEDROOM", monthlyRate: 3000 },
  { apartmentType: "TWO_BEDROOM", monthlyRate: 4000 },
  { apartmentType: "THREE_BEDROOM", monthlyRate: 5000 },
  { apartmentType: "DUPLEX", monthlyRate: 7000 },
  { apartmentType: "LANDLORD_OCCUPIER", monthlyRate: 10000 },
  { apartmentType: "CUSTOM", monthlyRate: 0 }
];

export async function seedLbsviewSubscriptionRates() {
  const now = new Date().toISOString();
  const effectiveFrom = "2024-01-01T00:00:00.000Z";

  const rows = await Promise.all(
    LBSVIEW_INITIAL_SUBSCRIPTION_RATE_SEEDS.map((seed) =>
      appwriteUpsertRow<AppwriteSubscriptionRateRow>(
        APPWRITE_TABLE_SUBSCRIPTION_RATES,
        safeAppwriteId("rate", `${APPWRITE_LBSVIEW_ESTATE_ID}:${seed.apartmentType}:${effectiveFrom}`),
        {
          estateId: APPWRITE_LBSVIEW_ESTATE_ID,
          apartmentType: seed.apartmentType,
          monthlyRate: seed.monthlyRate,
          effectiveFrom,
          createdBy: "corso-system",
          reason: "Initial rate configuration",
          createdAt: now,
          updatedAt: now
        }
      )
    )
  );

  return rows.map(mapSubscriptionRateRow);
}

function mapSubscriptionRateRow(row: AppwriteSubscriptionRateRow): SubscriptionRate {
  return {
    id: row.$id ?? "",
    estateId: row.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    apartmentType: row.apartmentType ?? "CUSTOM",
    monthlyRate: Number(row.monthlyRate ?? 0),
    effectiveFrom: row.effectiveFrom ?? "",
    effectiveTo: row.effectiveTo || undefined,
    createdBy: row.createdBy ?? "corso-system",
    reason: row.reason ?? "Initial rate configuration",
    createdAt: row.createdAt ?? "",
    updatedAt: row.updatedAt ?? ""
  };
}
