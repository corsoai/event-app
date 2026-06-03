import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";

export default function ForgotPasswordPage() {
  return (
    <main className="estate-auth-bg relative grid min-h-dvh place-items-center overflow-x-hidden bg-ink px-4 py-10 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(192,255,107,0.22),transparent_30%),linear-gradient(180deg,rgba(213,213,213,0.05),transparent_28%)]" />
      <div className="relative z-10 w-full">
        <Suspense>
          <AuthCard mode="forgot" />
        </Suspense>
      </div>
    </main>
  );
}
