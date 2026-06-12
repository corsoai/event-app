import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/types";

const tones: Record<StatusTone, string> = {
  green: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/15 dark:text-emerald-200",
  blue: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-400/40 dark:bg-sky-400/15 dark:text-sky-200",
  yellow: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-300/50 dark:bg-amber-300/15 dark:text-amber-100",
  red: "border-red-300 bg-red-50 text-red-700 dark:border-red-400/50 dark:bg-red-400/15 dark:text-red-100",
  slate: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-200"
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
        "status-badge inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize",
        `status-badge--${resolvedTone}`,
        tones[resolvedTone]
      )}
    >
      {status}
    </span>
  );
}
