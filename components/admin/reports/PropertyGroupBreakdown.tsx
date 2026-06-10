"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, LayoutGrid, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { money } from "@/lib/utils";
import {
  buildEstateTotal,
  buildPropertyGroupReports,
  cappedPercent,
  type PropertyGroupReport,
  type ResidentFinancialProfile
} from "@/components/admin/reports/report-data";

type ViewMode = "table" | "cards";

export function PropertyGroupBreakdown({
  profiles,
  loading = false
}: {
  profiles: ResidentFinancialProfile[];
  loading?: boolean;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const groups = useMemo(() => buildPropertyGroupReports(profiles), [profiles]);
  const estateTotal = useMemo(() => buildEstateTotal(groups), [groups]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    if (media.matches) {
      setViewMode("cards");
    }
  }, []);

  if (loading) {
    return <ReportSkeleton title="Property group breakdown" />;
  }

  return (
    <section id="property-group-breakdown" className="mt-6 scroll-mt-24">
      <Card>
        <CardHeader
          title="Property group breakdown"
          description="Expected revenue, confirmed collections, outstanding balances, and credit positions by property group."
          action={(
            <div className="flex rounded-lg border border-white/10 bg-black/10 p-1">
              <button
                type="button"
                className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold ${viewMode === "table" ? "bg-smart text-ink" : "text-slate-300 hover:bg-white/10"}`}
                onClick={() => setViewMode("table")}
              >
                <Table2 className="h-3.5 w-3.5" />
                Table view
              </button>
              <button
                type="button"
                className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold ${viewMode === "cards" ? "bg-smart text-ink" : "text-slate-300 hover:bg-white/10"}`}
                onClick={() => setViewMode("cards")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Cards view
              </button>
            </div>
          )}
        />
        <div className={viewMode === "table" ? "block" : "hidden"}>
          <PropertyGroupTable groups={groups} total={estateTotal} />
        </div>
        <div className={viewMode === "cards" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "hidden"}>
          {groups.map((group) => <PropertyGroupCard key={group.propertyCode} group={group} />)}
        </div>
      </Card>
    </section>
  );
}

function PropertyGroupTable({ groups, total }: { groups: PropertyGroupReport[]; total: PropertyGroupReport }) {
  const rows = [...groups, total];

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/10">
      <table className="w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            {["Property Group", "Units", "Expected", "Collected", "Outstanding", "Rate %", "Debtors", "Action"].map((header) => (
              <th key={header} className="border-b border-white/10 bg-white/[0.04] px-3 py-3 font-semibold text-slate-300">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((group) => {
            const totalRow = group.propertyCode === "ESTATE TOTAL";
            return (
              <tr key={group.propertyCode} className={`border-l-4 ${borderClass(group.collectionRate)} ${totalRow ? "font-bold" : ""}`}>
                <td className="border-b border-white/10 px-3 py-4 text-white">
                  <span className="block">{group.propertyCode}</span>
                  <span className="text-xs font-normal text-slate-400">{group.propertyName}</span>
                </td>
                <td className="border-b border-white/10 px-3 py-4 text-slate-100">{group.totalUnits}</td>
                <td className="border-b border-white/10 px-3 py-4 text-slate-100">{money(group.expectedRevenue)}</td>
                <td className="border-b border-white/10 px-3 py-4 text-slate-100">{money(group.confirmedPaid)}</td>
                <td className="border-b border-white/10 px-3 py-4 text-slate-100">{money(group.outstanding)}</td>
                <td className="min-w-56 border-b border-white/10 px-3 py-4">
                  <CollectionBar rate={group.collectionRate} />
                </td>
                <td className="border-b border-white/10 px-3 py-4 text-slate-100">{group.debtorCount}</td>
                <td className="border-b border-white/10 px-3 py-4">
                  {totalRow ? (
                    <span className="text-xs text-slate-500">All groups</span>
                  ) : (
                    <Link href={`/admin/residents?propertyCode=${encodeURIComponent(group.propertyCode)}`}>
                      <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs">View residents -&gt;</Button>
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PropertyGroupCard({ group }: { group: PropertyGroupReport }) {
  return (
    <div className={`rounded-lg border border-white/10 bg-black/15 p-4 ${borderClass(group.collectionRate)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-white">{group.propertyCode}</p>
          <p className="mt-1 text-xs text-slate-400">{group.propertyName}</p>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200">{group.totalUnits} units</span>
      </div>
      <div className="mt-4">
        <CollectionBar rate={group.collectionRate} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Metric label="Collected" value={money(group.confirmedPaid)} />
        <Metric label="Outstanding" value={money(group.outstanding)} />
        <Metric label="Debtors" value={String(group.debtorCount)} />
        <Metric label="In credit" value={String(group.creditCount)} />
      </div>
      <Link href={`/admin/residents?propertyCode=${encodeURIComponent(group.propertyCode)}`}>
        <Button type="button" variant="secondary" className="mt-4 w-full">
          <BarChart3 className="h-4 w-4" />
          View -&gt;
        </Button>
      </Link>
    </div>
  );
}

export function CollectionBar({ rate }: { rate: number }) {
  const collected = cappedPercent(rate);
  const outstanding = 100 - collected;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-400">Collected</span>
        <span className="font-semibold text-white">{rate.toFixed(1)}%</span>
      </div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-danger/30">
        <div className="bg-smart" style={{ width: `${collected}%` }} />
        <div className="bg-danger/70" style={{ width: `${outstanding}%` }} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}

function borderClass(rate: number) {
  if (rate >= 90) return "border-l-4 border-l-smart";
  if (rate >= 60) return "border-l-4 border-l-warn";
  return "border-l-4 border-l-danger";
}

function ReportSkeleton({ title }: { title: string }) {
  return (
    <section className="mt-6">
      <Card>
        <CardHeader title={title} description="Loading report section..." />
        <div className="grid gap-3">
          {[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-white/10" />)}
        </div>
      </Card>
    </section>
  );
}
