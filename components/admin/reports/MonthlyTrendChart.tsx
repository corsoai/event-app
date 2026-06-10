"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { money } from "@/lib/utils";
import {
  buildMonthlyTrend,
  buildPropertyGroupReports,
  cappedPercent,
  propertyGroupName,
  type ReportDataset,
  type ResidentFinancialProfile,
  type TrendPoint
} from "@/components/admin/reports/report-data";

type RangeOption = "3" | "6" | "12" | "all";

export function MonthlyTrendChart({
  dataset,
  profiles,
  loading = false
}: {
  dataset: ReportDataset;
  profiles: ResidentFinancialProfile[];
  loading?: boolean;
}) {
  const [range, setRange] = useState<RangeOption>("12");
  const [propertyGroup, setPropertyGroup] = useState("all");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    if (media.matches) {
      setRange("6");
    }
  }, []);

  const propertyGroups = useMemo(() => buildPropertyGroupReports(profiles), [profiles]);
  const allTrend = useMemo(() => buildMonthlyTrend(dataset, propertyGroup), [dataset, propertyGroup]);
  const trend = useMemo(() => {
    if (range === "all") return allTrend;
    return allTrend.slice(-Number(range));
  }, [allTrend, range]);
  const insights = useMemo(() => buildInsights(trend), [trend]);

  if (loading) {
    return (
      <section className="mt-6">
        <Card>
          <CardHeader title="Monthly collection trend" description="Loading chart data..." />
          <div className="h-[220px] animate-pulse rounded-lg bg-white/10 md:h-[300px] lg:h-[380px]" />
        </Card>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <Card>
        <CardHeader title="Monthly collection trend" description="Confirmed collections, expected revenue, and collection rate over time." />
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["3", "6", "12", "all"] as RangeOption[]).map((option) => (
              <button
                key={option}
                type="button"
                className={`min-h-9 rounded-lg px-3 text-xs font-semibold ${range === option ? "bg-smart text-ink" : "border border-white/10 bg-white/10 text-slate-200 hover:bg-white/15"}`}
                onClick={() => setRange(option)}
              >
                {option === "all" ? "All time" : `${option} months`}
              </button>
            ))}
          </div>
          <div className="w-full lg:w-72">
            <Select value={propertyGroup} onChange={(event) => setPropertyGroup(event.target.value)}>
              <option value="all">All groups</option>
              {propertyGroups.map((group) => (
                <option key={group.propertyCode} value={group.propertyCode}>
                  {group.propertyCode} - {group.propertyName}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <TrendSvg data={trend} />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {insights.map((insight) => (
            <div key={insight} className="rounded-lg border border-white/10 bg-black/15 p-3 text-sm text-slate-200">
              {insight}
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

function TrendSvg({ data }: { data: TrendPoint[] }) {
  if (!data.length) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-lg border border-white/10 bg-black/10 text-sm text-slate-400 md:h-[300px] lg:h-[380px]">
        No trend data available yet.
      </div>
    );
  }

  const width = 960;
  const height = 360;
  const padding = { top: 28, right: 56, bottom: 58, left: 72 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxAmount = Math.max(...data.map((item) => Math.max(item.expectedForMonth, item.totalCollected)), 1);
  const slotWidth = chartWidth / data.length;
  const barWidth = Math.min(42, slotWidth * 0.42);
  const expectedPoints = data.map((item, index) => pointFor(index, item.expectedForMonth, maxAmount, slotWidth, chartHeight, padding));
  const ratePoints = data.map((item, index) => {
    const x = padding.left + slotWidth * index + slotWidth / 2;
    const y = padding.top + chartHeight - (cappedPercent(item.collectionRate) / 100) * chartHeight;
    return `${x},${y}`;
  });

  return (
    <div className="h-[220px] overflow-hidden rounded-lg border border-white/10 bg-black/10 p-2 md:h-[300px] lg:h-[380px]">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monthly collection trend chart" className="h-full w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padding.top + chartHeight - tick * chartHeight;
          return (
            <g key={tick}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="rgba(255,255,255,0.1)" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" className="fill-slate-400 text-[11px]">{formatCompactMoney(maxAmount * tick)}</text>
              <text x={width - padding.right + 8} y={y + 4} className="hidden fill-slate-400 text-[11px] sm:block">{Math.round(tick * 100)}%</text>
            </g>
          );
        })}
        {data.map((item, index) => {
          const x = padding.left + slotWidth * index + slotWidth / 2 - barWidth / 2;
          const manualHeight = (item.manualPayments / maxAmount) * chartHeight;
          const onlineHeight = (item.onlinePayments / maxAmount) * chartHeight;
          const baseY = padding.top + chartHeight;
          return (
            <g key={item.monthKey}>
              <rect x={x} y={baseY - manualHeight} width={barWidth} height={manualHeight} fill="#166534">
                <title>{tooltipText(item)}</title>
              </rect>
              <rect x={x} y={baseY - manualHeight - onlineHeight} width={barWidth} height={onlineHeight} fill="#84cc16">
                <title>{tooltipText(item)}</title>
              </rect>
              <text x={x + barWidth / 2} y={height - 24} textAnchor="middle" className="fill-slate-400 text-[11px]">{item.monthLabel}</text>
            </g>
          );
        })}
        <polyline points={expectedPoints.join(" ")} fill="none" stroke="#f59e0b" strokeWidth="3" strokeDasharray="8 8" />
        <polyline points={ratePoints.join(" ")} fill="none" stroke="#38bdf8" strokeWidth="3" />
        <g transform={`translate(${padding.left}, 12)`}>
          <LegendSwatch color="#166534" label="Manual payments" />
          <LegendSwatch color="#84cc16" label="Online payments" x={150} />
          <LegendSwatch color="#f59e0b" label="Expected" x={310} />
          <LegendSwatch color="#38bdf8" label="Collection rate %" x={415} />
        </g>
      </svg>
    </div>
  );
}

function LegendSwatch({ color, label, x = 0 }: { color: string; label: string; x?: number }) {
  return (
    <g transform={`translate(${x}, 0)`}>
      <rect width="12" height="12" rx="3" fill={color} />
      <text x="18" y="10" className="fill-slate-300 text-[12px]">{label}</text>
    </g>
  );
}

function pointFor(index: number, value: number, maxAmount: number, slotWidth: number, chartHeight: number, padding: { top: number; left: number }) {
  const x = padding.left + slotWidth * index + slotWidth / 2;
  const y = padding.top + chartHeight - (value / maxAmount) * chartHeight;
  return `${x},${y}`;
}

function buildInsights(data: TrendPoint[]) {
  if (!data.length) {
    return [
      "Best collection month is not available yet.",
      "Collection movement needs at least two months of data.",
      "Online payments account for 0% of total collections."
    ];
  }

  const best = [...data].sort((left, right) => right.totalCollected - left.totalCollected)[0];
  const lastThree = data.slice(-3);
  const previousThree = data.slice(-6, -3);
  const lastAverage = average(lastThree.map((item) => item.totalCollected));
  const previousAverage = average(previousThree.map((item) => item.totalCollected));
  const movement = previousAverage > 0 ? ((lastAverage - previousAverage) / previousAverage) * 100 : 0;
  const onlineTotal = data.reduce((sum, item) => sum + item.onlinePayments, 0);
  const total = data.reduce((sum, item) => sum + item.totalCollected, 0);
  const onlineShare = total > 0 ? (onlineTotal / total) * 100 : 0;

  return [
    `Best collection month was ${best.monthLongLabel} at ${money(best.totalCollected)} (${best.collectionRate.toFixed(1)}% of expected)`,
    `Collections are ${movement >= 0 ? "up" : "down"} ${Math.abs(movement).toFixed(1)}% compared to the previous 3-month average`,
    `Online payments account for ${onlineShare.toFixed(1)}% of total collections`
  ];
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatCompactMoney(value: number) {
  if (value >= 1_000_000) return `N${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `N${Math.round(value / 1_000)}k`;
  return `N${Math.round(value)}`;
}

function tooltipText(item: TrendPoint) {
  return [
    `Month: ${item.monthLongLabel}`,
    `Manual: ${money(item.manualPayments)}`,
    `Online: ${money(item.onlinePayments)}`,
    `Total collected: ${money(item.totalCollected)}`,
    `Expected: ${money(item.expectedForMonth)}`,
    `Collection rate: ${item.collectionRate.toFixed(1)}%`
  ].join("\n");
}
