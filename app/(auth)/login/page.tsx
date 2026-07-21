import { Suspense } from "react";
import type { ReactNode } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { ForceLightTheme } from "@/components/theme/force-light";

export default function LoginPage() {
  return (
    <AuthScreen>
      <Suspense>
        <AuthCard mode="login" />
      </Suspense>
    </AuthScreen>
  );
}

function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-x-hidden bg-[#f5f5f7] px-4 py-10">
      <ForceLightTheme />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(16,185,129,0.10),transparent_45%),radial-gradient(circle_at_90%_100%,rgba(251,191,36,0.07),transparent_45%)]" />
      <div className="relative z-10 w-full">{children}</div>
    </main>
  );
}
