import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  helper,
  icon,
  href
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
  href?: string;
}) {
  const card = (
    <Card className={`p-3 sm:p-4 ${href ? "transition hover:border-smart/40 hover:bg-white/[0.06] active:scale-[0.99]" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-lg border border-smart/20 bg-smart/15 p-2.5 text-smart shadow-[0_1px_0_rgba(255,255,255,0.08)_inset] sm:p-3">{icon}</div>
        <ArrowUpRight className={`h-4 w-4 ${href ? "text-smart" : "text-slate-400"}`} aria-hidden="true" />
      </div>
      <p className="mt-4 text-xs text-slate-300 sm:mt-5 sm:text-sm">{label}</p>
      <p className="mt-1 text-lg font-semibold leading-tight text-white sm:text-2xl">{value}</p>
      <p className="mt-2 text-[11px] leading-4 text-slate-400 sm:text-xs">{helper}</p>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block min-w-0" aria-label={`${label}: open details`}>
        {card}
      </Link>
    );
  }

  return card;
}
