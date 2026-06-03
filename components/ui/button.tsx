import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const variants = {
  primary: "bg-smart text-ink shadow-[0_10px_24px_rgba(192,255,107,0.24)] hover:bg-smart/90",
  secondary: "border border-white/15 bg-white/10 text-white shadow-[0_1px_0_rgba(213,213,213,0.12)_inset] backdrop-blur-xl hover:bg-white/15",
  ghost: "text-slate-200 hover:bg-white/10 hover:text-white",
  danger: "bg-danger text-white shadow-[0_10px_24px_rgba(255,59,48,0.2)] hover:bg-danger/90"
};

export function Button({ className, variant = "primary", children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
