"use client";

import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Payment } from "@/lib/types";
import { money } from "@/lib/utils";
import {
  buildDebtorAccounts,
  buildEstateTotal,
  buildPropertyGroupReports,
  buildRateBreakdown,
  downloadTextFile,
  encodeCsv,
  formatDateLabel,
  formatMonthsOverdue,
  type ResidentFinancialProfile
} from "@/components/admin/reports/report-data";

export function ReportsExportToolbar({
  profiles,
  payments,
  expectedRevenue,
  paidAmount,
  outstandingBalance,
  creditBalance
}: {
  profiles: ResidentFinancialProfile[];
  payments: Payment[];
  expectedRevenue: number;
  paidAmount: number;
  outstandingBalance: number;
  creditBalance: number;
}) {
  const debtors = buildDebtorAccounts(profiles);
  const profileByResident = new Map(profiles.map((profile) => [profile.resident.id, profile]));
  const groups = buildPropertyGroupReports(profiles);
  const rates = buildRateBreakdown(profiles);
  const estateTotal = buildEstateTotal(groups);
  const creditProfiles = profiles.filter((profile) => profile.advanceCredit > 0);

  function exportDebtorsCsv() {
    const rows = [
      ["Name", "Unit", "Property Group", "Monthly Rate", "Total Owed", "Months Overdue", "Last Payment Date", "Phone", "Email", "Aging Bucket"],
      ...debtors.map((debtor) => [
        debtor.resident.name,
        debtor.unitCode,
        debtor.propertyCode,
        String(debtor.monthlyRate),
        String(debtor.outstandingBalance),
        debtor.monthsOverdue.toFixed(1),
        formatDateLabel(debtor.lastPaymentDate),
        debtor.resident.phone,
        debtor.resident.email,
        debtor.agingBucket
      ])
    ];
    downloadTextFile(`lbsview-debtors-${dateSlug()}.csv`, encodeCsv(rows), "text/csv;charset=utf-8");
  }

  function exportPaymentsCsv() {
    const rows = [
      ["Payment Date", "Resident Name", "Unit", "Property Group", "Amount", "Channel", "Reference", "Status", "Recorded By"],
      ...payments.map((payment) => {
        const profile = profileByResident.get(payment.residentId);
        return [
          payment.confirmedAt || payment.date,
          profile?.resident.name ?? "Unknown resident",
          profile?.unitCode ?? "Unit pending",
          profile?.propertyCode ?? "LDI-REVIEW",
          String(payment.amount),
          payment.channel ?? payment.processor ?? "manual",
          payment.reference,
          payment.status,
          payment.confirmedBy || payment.source || "Not recorded"
        ];
      })
    ];
    downloadTextFile(`lbsview-payments-${dateSlug()}.csv`, encodeCsv(rows), "text/csv;charset=utf-8");
  }

  function exportPdf() {
    const pages = [
      [
        "Estate summary",
        `Expected revenue: ${money(expectedRevenue)}`,
        `Confirmed paid: ${money(paidAmount)}`,
        `Outstanding: ${money(outstandingBalance)}`,
        `Credit balance: ${money(creditBalance)}`,
        `Collection rate: ${expectedRevenue > 0 ? ((paidAmount / expectedRevenue) * 100).toFixed(1) : "0.0"}%`,
        `Debtors: ${debtors.length}`,
        `Residents in credit: ${creditProfiles.length}`
      ],
      [
        "Property group breakdown",
        "Group | Units | Expected | Collected | Outstanding | Rate",
        ...groups.map((group) => `${group.propertyCode} | ${group.totalUnits} | ${money(group.expectedRevenue)} | ${money(group.confirmedPaid)} | ${money(group.outstanding)} | ${group.collectionRate.toFixed(1)}%`),
        `${estateTotal.propertyCode} | ${estateTotal.totalUnits} | ${money(estateTotal.expectedRevenue)} | ${money(estateTotal.confirmedPaid)} | ${money(estateTotal.outstanding)} | ${estateTotal.collectionRate.toFixed(1)}%`
      ],
      [
        "Debtors aging analysis",
        "Resident | Unit | Property | Owed | Months",
        ...debtors.slice(0, 34).map((debtor) => `${debtor.resident.name} | ${debtor.unitCode} | ${debtor.propertyCode} | ${money(debtor.outstandingBalance)} | ${formatMonthsOverdue(debtor.monthsOverdue)}`)
      ],
      [
        "Residents in credit",
        "Resident | Unit | Property | Credit",
        ...creditProfiles.slice(0, 36).map((profile) => `${profile.resident.name} | ${profile.unitCode} | ${profile.propertyCode} | ${money(profile.advanceCredit)}`)
      ],
      [
        "Rate breakdown",
        "Rate | Units | Monthly Potential | Annual Potential | Collection Rate",
        ...rates.map((rate) => `${rate.label} | ${rate.units} | ${money(rate.monthlyPotential)} | ${money(rate.annualPotential)} | ${rate.collectionRate.toFixed(1)}%`)
      ]
    ];
    const pdf = createSimplePdf(pages, "LBS View Estate - Financial Report");
    downloadTextFile(`lbsview-financial-report-${dateSlug()}.pdf`, pdf, "application/pdf");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" onClick={exportDebtorsCsv}>
        <Download className="h-4 w-4" />
        Export debtors CSV
      </Button>
      <Button type="button" variant="secondary" onClick={exportPaymentsCsv}>
        <Download className="h-4 w-4" />
        Export payments CSV
      </Button>
      <Button type="button" variant="secondary" onClick={exportPdf}>
        <FileText className="h-4 w-4" />
        Export full report PDF
      </Button>
    </div>
  );
}

function createSimplePdf(pages: string[][], title: string) {
  const pageObjects: string[] = [];
  const contentObjects: string[] = [];
  const generatedAt = new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date());

  pages.forEach((lines, index) => {
    const pageNumber = index + 1;
    const content = [
      pdfTextLine("LBS View Estate - Financial Report", 46, 806, 13),
      pdfTextLine(`Generated: ${generatedAt} by current admin`, 46, 788, 9),
      ...lines.flatMap((line, lineIndex) => wrapLine(line, lineIndex === 0 ? 58 : 46).map((wrapped, wrappedIndex) => (
        pdfTextLine(wrapped, 46, 752 - (lineIndex * 18) - (wrappedIndex * 10), lineIndex === 0 ? 14 : 9)
      ))),
      pdfTextLine("Confidential - Estate Management Use Only", 46, 34, 9),
      pdfTextLine(`Page ${pageNumber}`, 520, 34, 9)
    ].join("\n");
    const contentObjectNumber = 4 + index * 2;
    const pageObjectNumber = 3 + index * 2;
    contentObjects.push(`${contentObjectNumber} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
    pageObjects.push(`${pageObjectNumber} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 1 0 R >> >> /Contents ${contentObjectNumber} 0 R >>\nendobj\n`);
  });

  const kids = pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ");
  const objectsBeforeCatalog = [
    "1 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`,
    ...pageObjects.flatMap((page, index) => [page, contentObjects[index]])
  ];
  const catalogNumber = objectsBeforeCatalog.length + 1;
  const objects = [
    ...objectsBeforeCatalog,
    `${catalogNumber} 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`
  ];
  const header = "%PDF-1.4\n";
  const offsets: number[] = [];
  let body = "";
  for (const object of objects) {
    offsets.push(header.length + body.length);
    body += object;
  }
  const xrefStart = header.length + body.length;
  const xref = [
    `xref\n0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `)
  ].join("\n");
  const trailer = `\ntrailer\n<< /Size ${objects.length + 1} /Root ${catalogNumber} 0 R /Info << /Title (${escapePdf(title)}) >> >>\nstartxref\n${xrefStart}\n%%EOF`;
  return `${header}${body}${xref}${trailer}`;
}

function pdfTextLine(text: string, x: number, y: number, size: number) {
  return `BT /F1 ${size} Tf ${x} ${y} Td (${escapePdf(text)}) Tj ET`;
}

function wrapLine(text: string, limit: number) {
  if (text.length <= limit) return [text];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > limit) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

function escapePdf(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function dateSlug() {
  return new Date().toISOString().slice(0, 10);
}
