import type { ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/card";

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
  rows: ReactNode[][];
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} action={action} />
      <div className="grid gap-3 md:hidden">
        {rows.length ? rows.map((row, index) => (
          <div key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="text-sm font-semibold text-white">{row[0]}</div>
            <div className="mt-3 grid gap-2">
              {row.slice(1).map((cell, cellIndex) => (
                <div key={headers[cellIndex + 1] ?? cellIndex} className="grid grid-cols-[6.5rem_1fr] gap-3 border-t border-white/10 pt-2 text-xs">
                  <span className="text-slate-500">{headers[cellIndex + 1] ?? ""}</span>
                  <span className="min-w-0 text-slate-100">{cell}</span>
                </div>
              ))}
            </div>
          </div>
        )) : (
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
            {rows.map((row, index) => (
              <tr key={index} className="group transition hover:bg-white/[0.04]">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="max-w-64 border-b border-white/10 px-3 py-4 align-top text-slate-100">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
