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
      <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-white/10 bg-black/10">
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
