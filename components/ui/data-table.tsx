import type { ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/card";

export type DataTableGroupRow = { groupLabel: string };
export type DataTableRow = ReactNode[] | DataTableGroupRow;

function isGroupRow(row: DataTableRow): row is DataTableGroupRow {
  return !Array.isArray(row);
}

export function DataTable({
  title,
  description,
  headers,
  rows,
  action
}: {
  title: string;
  description?: string;
  headers: string[];
  rows: DataTableRow[];
  action?: ReactNode;
}) {
  const statusIndex = headers.findIndex((header) => /status|state|decision/i.test(header));
  const secondaryIndex = headers.length > 1 ? 1 : -1;

  return (
    <Card>
      <CardHeader title={title} description={description} action={action} />
      <div className="grid gap-3 md:hidden">
        {rows.length ? rows.map((row, index) => {
          if (isGroupRow(row)) {
            return (
              <p key={`group-${row.groupLabel}-${index}`} className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 first:mt-0">
                {row.groupLabel}
              </p>
            );
          }

          return (
          <details key={index} className="group rounded-lg border border-white/10 bg-black/20 p-3">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">{row[0]}</div>
                {secondaryIndex > 0 && row[secondaryIndex] ? (
                  <div className="mt-2 text-xs text-slate-300">{row[secondaryIndex]}</div>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {statusIndex > -1 && row[statusIndex] ? row[statusIndex] : null}
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-400 group-open:bg-smart/10 group-open:text-smart">
                  More
                </span>
              </div>
            </summary>
            <div className="mt-3 grid gap-2">
              {row.map((cell, cellIndex) => {
                if (cellIndex === 0 || cellIndex === secondaryIndex || cellIndex === statusIndex) {
                  return null;
                }

                return (
                  <div key={headers[cellIndex] ?? cellIndex} className="grid grid-cols-[6.5rem_1fr] gap-3 border-t border-white/10 pt-2 text-xs">
                    <span className="text-slate-500">{headers[cellIndex] ?? ""}</span>
                    <span className="min-w-0 text-slate-100">{cell}</span>
                  </div>
                );
              })}
            </div>
          </details>
          );
        }) : (
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-4 text-sm text-slate-400">
            No records to show.
          </div>
        )}
      </div>
      <div className="hidden max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-white/10 bg-black/10 md:block">
        <table className="w-full table-auto border-separate border-spacing-0 text-left text-xs sm:text-sm">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header} className="max-w-56 border-b border-white/10 bg-white/[0.04] px-3 py-3 align-top font-semibold text-slate-300 first:rounded-tl-lg last:rounded-tr-lg">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              if (isGroupRow(row)) {
                return (
                  <tr key={`group-${row.groupLabel}-${index}`}>
                    <td colSpan={headers.length} className="border-b border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {row.groupLabel}
                    </td>
                  </tr>
                );
              }

              return (
              <tr key={index} className="group transition hover:bg-white/[0.04]">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="max-w-64 border-b border-white/10 px-3 py-4 align-top text-slate-100">
                    {cell}
                  </td>
                ))}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
