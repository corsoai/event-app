import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/types";

const tones: Record<StatusTone, string> = {
  green: "border-emerald-400 bg-emerald-100 text-emerald-900 shadow-sm dark:border-emerald-300/55 dark:bg-emerald-400/18 dark:text-emerald-50",
  blue: "border-sky-400 bg-sky-100 text-sky-900 shadow-sm dark:border-sky-300/55 dark:bg-sky-400/18 dark:text-sky-50",
  yellow: "border-amber-400 bg-amber-100 text-amber-950 shadow-sm dark:border-amber-300/60 dark:bg-amber-300/18 dark:text-amber-50",
  red: "border-red-400 bg-red-100 text-red-900 shadow-sm dark:border-red-300/60 dark:bg-red-400/18 dark:text-red-50",
  slate: "border-slate-400 bg-slate-200 text-slate-900 shadow-sm dark:border-slate-400/55 dark:bg-slate-500/18 dark:text-slate-50"
};

export function statusTone(status: string): StatusTone {
  const normalized = status.toLowerCase();
  if (["active", "occupied", "paid", "confirmed", "resolved", "checked-in", "checked-out", "credit", "advance payment"].includes(normalized)) {
    return "green";
  }
  if (["verified", "in progress", "partially paid"].includes(normalized)) {
    return "blue";
  }
  if (["pending", "open", "unpaid", "normal", "vacant"].includes(normalized)) {
    return "yellow";
  }
  if (["inactive", "moved out", "expired", "cancelled", "overdue", "rejected", "urgent"].includes(normalized)) {
    return "red";
  }
  return "slate";
}

export function StatusBadge({ status, tone }: { status: string; tone?: StatusTone }) {
  const resolvedTone = tone ?? statusTone(status);

  return (
    <span
      className={cn(
        "status-badge inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold capitalize",
        `status-badge--${resolvedTone}`,
        tones[resolvedTone]
      )}
    >
      {status}
    </span>
  );
}
