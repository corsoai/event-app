import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-lg border border-white/15 bg-black shadow-glow",
        className
      )}
    >
      <img src="/brand/corso-icon.png" alt="Corsvent" className="h-full w-full object-cover" loading="lazy" decoding="async" />
    </span>
  );
}
