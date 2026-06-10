"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageCircle, ReceiptText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { money } from "@/lib/utils";
import {
  AGING_BUCKETS,
  buildAgingSummaries,
  buildDebtorAccounts,
  formatDateLabel,
  formatMonthsOverdue,
  normalizePhoneForWhatsApp,
  propertyGroupName,
  type AgingBucket,
  type DebtorAccount,
  type ResidentFinancialProfile
} from "@/components/admin/reports/report-data";

type SortOption = "highest" | "months" | "oldest" | "property" | "rate";

export function DebtorsAging({
  profiles,
  forcedBucket,
  onClearForcedBucket,
  loading = false
}: {
  profiles: ResidentFinancialProfile[];
  forcedBucket: AgingBucket | null;
  onClearForcedBucket: () => void;
  loading?: boolean;
}) {
  const [selectedBucket, setSelectedBucket] = useState<AgingBucket | "all">("all");
  const [sort, setSort] = useState<SortOption>("highest");
  const [property, setProperty] = useState("all");
  const [rate, setRate] = useState("all");
  const [search, setSearch] = useState("");
  const debtors = useMemo(() => buildDebtorAccounts(profiles), [profiles]);
  const summaries = useMemo(() => buildAgingSummaries(debtors), [debtors]);
  const activeBucket = forcedBucket ?? (selectedBucket === "all" ? null : selectedBucket);
  const properties = useMemo(() => [...new Set(debtors.map((debtor) => debtor.propertyCode))].sort(), [debtors]);
  const rates = useMemo(() => [...new Set(debtors.map((debtor) => debtor.monthlyRate).filter((item) => item > 0))].sort((left, right) => left - right), [debtors]);
  const filteredDebtors = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return debtors
      .filter((debtor) => !activeBucket || debtor.agingBucket === activeBucket)
      .filter((debtor) => property === "all" || debtor.propertyCode === property)
      .filter((debtor) => rate === "all" || debtor.monthlyRate === Number(rate))
      .filter((debtor) => {
        if (!normalizedSearch) return true;
        return debtor.resident.name.toLowerCase().includes(normalizedSearch) || debtor.unitCode.toLowerCase().includes(normalizedSearch);
      })
      .sort((left, right) => sortDebtors(left, right, sort));
  }, [activeBucket, debtors, property, rate, search, sort]);
  const totals = useMemo(() => buildTotals(filteredDebtors), [filteredDebtors]);

  if (loading) {
    return (
      <section id="debtors-aging" className="mt-6 scroll-mt-24">
        <Card>
          <CardHeader title="Debtors aging analysis" description="Loading debtor aging..." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-24 animate-pulse rounded-lg bg-white/10" />)}
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section id="debtors-aging" className="mt-6 scroll-mt-24">
      <Card>
        <CardHeader
          title="Debtors aging analysis"
          description="Outstanding balances grouped by equivalent subscription months overdue."
          action={forcedBucket ? (
            <Button type="button" variant="secondary" onClick={onClearForcedBucket}>Clear critical filter</Button>
          ) : null}
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {summaries.map((summary) => (
            <button
              key={summary.bucket}
              type="button"
              className={`rounded-lg border p-3 text-left transition ${bucketSummaryClass(summary.bucket, activeBucket === summary.bucket)}`}
              onClick={() => {
                onClearForcedBucket();
                setSelectedBucket((current) => current === summary.bucket ? "all" : summary.bucket);
              }}
            >
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">{summary.label}</span>
              <span className="mt-2 block text-2xl font-semibold">{summary.count}</span>
              <span className="mt-1 block text-xs">{money(summary.totalOutstanding)}</span>
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_13rem_13rem_13rem]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or unit" className="pl-9" />
          </label>
          <Select value={property} onChange={(event) => setProperty(event.target.value)}>
            <option value="all">All property groups</option>
            {properties.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          <Select value={rate} onChange={(event) => setRate(event.target.value)}>
            <option value="all">All rate tiers</option>
            {rates.map((item) => <option key={item} value={item}>{money(item)}/month</option>)}
          </Select>
          <Select value={sort} onChange={(event) => setSort(event.target.value as SortOption)}>
            <option value="highest">Highest outstanding first</option>
            <option value="months">Most months overdue first</option>
            <option value="oldest">Last payment oldest first</option>
            <option value="property">Property group A to Z</option>
            <option value="rate">Monthly rate highest first</option>
          </Select>
        </div>
        <div className="mt-5 hidden overflow-x-auto rounded-lg border border-white/10 bg-black/10 md:block">
          <table className="w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                {["Resident", "Unit", "Property", "Monthly Rate", "Total Owed", "Months Overdue", "Last Payment", "Aging Bucket", "Actions"].map((header) => (
                  <th key={header} className="border-b border-white/10 bg-white/[0.04] px-3 py-3 font-semibold text-slate-300">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDebtors.map((debtor) => (
                <tr key={debtor.resident.id} className={bucketRowClass(debtor.agingBucket)}>
                  <td className="border-b border-white/10 px-3 py-4 font-semibold">{debtor.resident.name}</td>
                  <td className="border-b border-white/10 px-3 py-4">{debtor.unitCode}</td>
                  <td className="border-b border-white/10 px-3 py-4">{debtor.propertyCode}</td>
                  <td className="border-b border-white/10 px-3 py-4">{money(debtor.monthlyRate)}</td>
                  <td className="border-b border-white/10 px-3 py-4">{money(debtor.outstandingBalance)}</td>
                  <td className="border-b border-white/10 px-3 py-4">{formatMonthsOverdue(debtor.monthsOverdue)}</td>
                  <td className="border-b border-white/10 px-3 py-4">{formatDateLabel(debtor.lastPaymentDate)}</td>
                  <td className="border-b border-white/10 px-3 py-4"><StatusBadge status={bucketLabel(debtor.agingBucket)} tone={bucketTone(debtor.agingBucket)} /></td>
                  <td className="border-b border-white/10 px-3 py-4"><Actions debtor={debtor} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-5 grid gap-3 md:hidden">
          {filteredDebtors.map((debtor) => (
            <div key={debtor.resident.id} className={`rounded-lg border border-white/10 p-4 ${bucketCardClass(debtor.agingBucket)}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{debtor.resident.name}</p>
                  <p className="mt-1 text-xs opacity-80">{debtor.unitCode}</p>
                </div>
                <StatusBadge status={bucketLabel(debtor.agingBucket)} tone={bucketTone(debtor.agingBucket)} />
              </div>
              <div className="mt-3 grid gap-2 text-sm">
                <p>{debtor.propertyCode} - {propertyGroupName(debtor.propertyCode)}</p>
                <p>Monthly rate: {money(debtor.monthlyRate)}</p>
                <p>Outstanding: {money(debtor.outstandingBalance)}</p>
                <p>Months overdue: {formatMonthsOverdue(debtor.monthsOverdue)}</p>
                <p>Last payment: {formatDateLabel(debtor.lastPaymentDate)}</p>
              </div>
              <div className="mt-4">
                <Actions debtor={debtor} />
              </div>
            </div>
          ))}
        </div>
        {!filteredDebtors.length ? (
          <div className="mt-5 rounded-lg border border-white/10 bg-black/20 px-3 py-4 text-sm text-slate-400">
            No debtor records match the current filters.
          </div>
        ) : null}
        <div className="mt-5 grid gap-3 rounded-lg border border-white/10 bg-black/15 p-4 text-sm text-slate-200 md:grid-cols-4">
          <p>Total debtors: <span className="font-semibold text-white">{totals.count} residents</span></p>
          <p>Total outstanding: <span className="font-semibold text-white">{money(totals.outstanding)}</span></p>
          <p>Average months overdue: <span className="font-semibold text-white">{totals.averageMonths.toFixed(1)} months</span></p>
          <p>Most overdue: <span className="font-semibold text-white">{totals.mostOverdue}</span></p>
        </div>
      </Card>
    </section>
  );
}

function Actions({ debtor }: { debtor: DebtorAccount }) {
  const phone = normalizePhoneForWhatsApp(debtor.resident.phone);
  const message = `Dear ${debtor.resident.name}, this is a reminder from LBS View Estate management. Your subscription account for unit ${debtor.unitCode} has an outstanding balance of ${money(debtor.outstandingBalance)} (${formatMonthsOverdue(debtor.monthsOverdue)}). Kindly make payment at your earliest convenience. Thank you.`;
  return (
    <div className="flex flex-wrap gap-2">
      {phone ? (
        <a href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
          <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs">
            <MessageCircle className="h-3.5 w-3.5" />
            Send reminder
          </Button>
        </a>
      ) : (
        <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs" disabled title="No phone number on record">
          <MessageCircle className="h-3.5 w-3.5" />
          Send reminder
        </Button>
      )}
      <Link href={`/admin/payments?residentId=${encodeURIComponent(debtor.resident.id)}`}>
        <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs">
          <ReceiptText className="h-3.5 w-3.5" />
          Record payment
        </Button>
      </Link>
      <Link href={`/admin/residents?residentId=${encodeURIComponent(debtor.resident.id)}`}>
        <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs">View ledger</Button>
      </Link>
    </div>
  );
}

function sortDebtors(left: DebtorAccount, right: DebtorAccount, sort: SortOption) {
  if (sort === "months") return right.monthsOverdue - left.monthsOverdue;
  if (sort === "oldest") return dateValue(left.lastPaymentDate) - dateValue(right.lastPaymentDate);
  if (sort === "property") return left.propertyCode.localeCompare(right.propertyCode);
  if (sort === "rate") return right.monthlyRate - left.monthlyRate;
  return right.outstandingBalance - left.outstandingBalance;
}

function buildTotals(debtors: DebtorAccount[]) {
  const outstanding = debtors.reduce((sum, debtor) => sum + debtor.outstandingBalance, 0);
  const averageMonths = debtors.length ? debtors.reduce((sum, debtor) => sum + debtor.monthsOverdue, 0) / debtors.length : 0;
  const most = [...debtors].sort((left, right) => right.monthsOverdue - left.monthsOverdue)[0];
  return {
    count: debtors.length,
    outstanding,
    averageMonths,
    mostOverdue: most ? `${most.resident.name} - ${formatMonthsOverdue(most.monthsOverdue)}` : "None"
  };
}

function dateValue(value: string | null) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function bucketLabel(bucket: AgingBucket) {
  return AGING_BUCKETS.find((item) => item.bucket === bucket)?.label ?? bucket;
}

function bucketTone(bucket: AgingBucket) {
  if (bucket === "current") return "blue";
  if (bucket === "early" || bucket === "moderate") return "yellow";
  if (bucket === "severe" || bucket === "critical" || bucket === "serious") return "red";
  return "slate";
}

function bucketSummaryClass(bucket: AgingBucket, active: boolean) {
  const classes: Record<AgingBucket, string> = {
    current: "border-sky-400/40 bg-sky-500/12 text-sky-100",
    early: "border-yellow-300/40 bg-yellow-300/14 text-yellow-100",
    moderate: "border-orange-400/40 bg-orange-500/14 text-orange-100",
    serious: "border-red-400/40 bg-red-500/14 text-red-100",
    critical: "border-red-700/60 bg-red-900/45 text-red-100",
    severe: "border-black bg-black text-red-300"
  };
  return `${classes[bucket]} ${active ? "ring-2 ring-smart" : ""}`;
}

function bucketRowClass(bucket: AgingBucket) {
  const classes: Record<AgingBucket, string> = {
    current: "text-slate-100",
    early: "bg-yellow-300/10 text-yellow-50",
    moderate: "bg-orange-500/12 text-orange-50",
    serious: "bg-red-500/12 text-red-50",
    critical: "bg-red-700/30 text-red-50",
    severe: "bg-red-950 text-white"
  };
  return classes[bucket];
}

function bucketCardClass(bucket: AgingBucket) {
  const classes: Record<AgingBucket, string> = {
    current: "bg-black/15 text-slate-100",
    early: "bg-yellow-300/10 text-yellow-50",
    moderate: "bg-orange-500/12 text-orange-50",
    serious: "bg-red-500/12 text-red-50",
    critical: "bg-red-700/30 text-red-50",
    severe: "bg-red-950 text-white"
  };
  return classes[bucket];
}
