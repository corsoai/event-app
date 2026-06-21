import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 shadow-[0_1px_0_rgba(255,255,255,0.75)_inset] outline-none transition placeholder:text-slate-400 focus:border-smart/70 focus:ring-2 focus:ring-smart/25 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-400";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(base, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(base, "min-h-28 resize-y", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(base, props.className)} />;
}

export function Field({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="form-field-label grid gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
      {label}
      {children}
    </label>
  );
}
