import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  helper,
  icon
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-lg border border-smart/20 bg-smart/15 p-3 text-smart shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]">{icon}</div>
        <ArrowUpRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
      </div>
      <p className="mt-5 text-sm text-slate-300">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{helper}</p>
    </Card>
  );
}
