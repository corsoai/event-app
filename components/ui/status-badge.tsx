import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/types";

const tones: Record<StatusTone, string> = {
  green: "border-smart/30 bg-smart/10 text-smart",
  blue: "border-sky/30 bg-sky/10 text-sky",
  yellow: "border-warn/30 bg-warn/10 text-warn",
  red: "border-danger/30 bg-danger/10 text-danger",
  slate: "border-slate-500/30 bg-slate-500/10 text-slate-300"
};

export function statusTone(status: string): StatusTone {
  const normalized = status.toLowerCase();
  if (["active", "occupied", "paid", "confirmed", "resolved", "checked-in", "checked-out"].includes(normalized)) {
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
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize",
        tones[tone ?? statusTone(status)]
      )}
    >
      {status}
    </span>
  );
}
