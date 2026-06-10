"use client";

import { useMemo } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { money } from "@/lib/utils";
import { CollectionBar } from "@/components/admin/reports/PropertyGroupBreakdown";
import {
  buildRateBreakdown,
  type RateTierReport,
  type ResidentFinancialProfile
} from "@/components/admin/reports/report-data";

export function RateBreakdown({
  profiles,
  expectedRevenue,
  outstanding,
  loading = false
}: {
  profiles: ResidentFinancialProfile[];
  expectedRevenue: number;
  outstanding: number;
  loading?: boolean;
}) {
  const rows = useMemo(() => buildRateBreakdown(profiles), [profiles]);
  const total = useMemo<RateTierReport>(() => rows.reduce<RateTierReport>((sum, row) => ({
    rate: 0,
    label: "TOTAL",
    units: sum.units + row.units,
    monthlyPotential: sum.monthlyPotential + row.monthlyPotential,
    annualPotential: sum.annualPotential + row.annualPotential,
    expectedRevenue: sum.expectedRevenue + row.expectedRevenue,
    confirmedPaid: sum.confirmedPaid + row.confirmedPaid,
    collectionRate: 0
  }), {
    rate: 0,
    label: "TOTAL",
    units: 0,
    monthlyPotential: 0,
    annualPotential: 0,
    expectedRevenue: 0,
    confirmedPaid: 0,
    collectionRate: 0
  }), [rows]);
  const totalWithRate = {
    ...total,
    collectionRate: total.expectedRevenue > 0 ? (total.confirmedPaid / total.expectedRevenue) * 100 : 0
  };

  if (loading) {
    return (
      <section className="mt-6">
        <Card>
          <CardHeader title="Subscription rate breakdown" description="Loading rate tiers..." />
          <div className="space-y-3">
            {[0, 1, 2].map((item) => <div key={item} className="h-11 animate-pulse rounded-lg bg-white/10" />)}
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <Card>
        <CardHeader title="Subscription rate breakdown" description="Monthly and annual potential by subscription rate tier." />
        <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/10">
          <table className="w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                {["Rate Tier", "Units", "Monthly Potential", "Annual Potential", "Collection %"].map((header) => (
                  <th key={header} className="border-b border-white/10 bg-white/[0.04] px-3 py-3 font-semibold text-slate-300">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...rows, totalWithRate].map((row) => (
                <tr key={row.label} className={row.label === "TOTAL" ? "font-bold" : ""}>
                  <td className="border-b border-white/10 px-3 py-4 text-white">{row.label}</td>
                  <td className="border-b border-white/10 px-3 py-4 text-slate-100">{row.units} units</td>
                  <td className="border-b border-white/10 px-3 py-4 text-slate-100">{money(row.monthlyPotential)}</td>
                  <td className="border-b border-white/10 px-3 py-4 text-slate-100">{money(row.annualPotential)}</td>
                  <td className="min-w-56 border-b border-white/10 px-3 py-4">
                    <CollectionBar rate={row.collectionRate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">
          If all outstanding balances were collected today, total confirmed revenue would be: {money(expectedRevenue + outstanding)}
        </p>
      </Card>
    </section>
  );
}
