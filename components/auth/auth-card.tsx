"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { demoUsers, roleHome, roleLabels } from "@/lib/auth";
import { estates as demoEstates } from "@/lib/demo-data";
import { DEMO_PASSWORD, getPasswordQualityError } from "@/lib/password-policy";
import {
  createLocalAccessRequest,
  findApprovedLocalUser,
  findLocalAccessRequest,
  isLegacyEstateValue,
  removeLegacyLekkiAccounts
} from "@/lib/local-store";
import {
  createAppwriteAccessRequest,
  readAppwriteAccessRequestForCurrentUser,
  readPublicAppwriteEstates
} from "@/lib/appwrite/browser-data";
import { isLocalDemoEnabled } from "@/lib/local-demo";
import type { UserRole } from "@/lib/types";
import { DEFAULT_ESTATE_NAME, normalizePhoneNumber, sortEstatesWithDefaultFirst } from "@/lib/utils";

type Mode = "login" | "signup" | "forgot";

// Public exhibition tour accounts for the Africa Secured Estate demo.
// These credentials are intentionally public (printed on banners/QR codes)
// and are scoped to the demo estate only.
const EXHIBITION_DEMO_LOGINS: Record<string, { identifier: string; password: string; label: string; blurb: string }> = {
  resident: { identifier: "demo.resident@corso.ng", password: "AfricaDemo@2026", label: "Resident", blurb: "Invite visitors, bills, SOS" },
  security: { identifier: "demo.guard@corso.ng", password: "AfricaDemo@2026", label: "Security", blurb: "Verify codes, scan plates" },
  manager: { identifier: "demo.manager@corso.ng", password: "AfricaDemo@2026", label: "Manager", blurb: "Residents, billing, reports" }
};

export function AuthCard({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const localDemoEnabled = isLocalDemoEnabled();
  const appwriteLoginPreferred = Boolean(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);
  const defaultLoginUser = demoUsers.find((user) => user.role === "estate_admin") ?? demoUsers[0];
  const [email, setEmail] = useState(mode === "login" && localDemoEnabled ? defaultLoginUser.email : "");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState(mode === "login" && localDemoEnabled ? DEMO_PASSWORD : "");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("resident");
  const [showPassword, setShowPassword] = useState(false);
  const [estateOptions, setEstateOptions] = useState(() =>
    sortEstatesWithDefaultFirst(demoEstates.map((item) => ({ id: item.id, name: item.name })))
  );
  const [estateId, setEstateId] = useState(() => sortEstatesWithDefaultFirst(demoEstates)[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">("info");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginProgress, setLoginProgress] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [demoAutoLoginDone, setDemoAutoLoginDone] = useState(false);
  const [demoLoginsEnabled, setDemoLoginsEnabled] = useState(false);

  // The demo experience follows the demo accounts' status: suspending all
  // demo users in Users & Roles hides these buttons; reactivating restores them.
  useEffect(() => {
    if (mode !== "login") {
      return;
    }
    let active = true;
    fetch("/api/public/demo-status", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { enabled?: boolean }) => {
        if (active) setDemoLoginsEnabled(Boolean(payload?.enabled));
      })
      .catch(() => {
        if (active) setDemoLoginsEnabled(false);
      });
    return () => {
      active = false;
    };
  }, [mode]);

  // One-tap demo entry: /login?demo=resident|security|manager pre-fills the
  // exhibition tour account and submits the existing login form untouched.
  const demoParam = mode === "login" ? params.get("demo") : null;
  useEffect(() => {
    if (!demoParam || demoAutoLoginDone || mode !== "login" || !demoLoginsEnabled) {
      return;
    }
    const account = EXHIBITION_DEMO_LOGINS[demoParam.toLowerCase()];
    if (!account) {
      return;
    }
    setEmail(account.identifier);
    setPassword(account.password);
    setDemoAutoLoginDone(true);
    const timer = setTimeout(() => formRef.current?.requestSubmit(), 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoParam, demoAutoLoginDone, mode, demoLoginsEnabled]);

  function startDemoLogin(key: string) {
    const account = EXHIBITION_DEMO_LOGINS[key];
    if (!account || loading || !demoLoginsEnabled) {
      return;
    }
    setEmail(account.identifier);
    setPassword(account.password);
    setTimeout(() => formRef.current?.requestSubmit(), 60);
  }
  const selectedEstate = estateOptions.find((item) => item.id === estateId) ?? estateOptions[0];
  const estateName = selectedEstate?.name ?? DEFAULT_ESTATE_NAME;

  useEffect(() => {
    removeLegacyLekkiAccounts();
  }, []);

  useEffect(() => {
    if (mode !== "login") {
      return;
    }

    Object.values(roleHome).forEach((href) => router.prefetch(href));
    const next = params.get("next");
    if (next) {
      router.prefetch(next);
    }
  }, [mode, params, router]);

  useEffect(() => {
    if (mode !== "signup") {
      return;
    }

    setEmail("");
    setPhone("");
    setPassword("");
    const clearLegacyAutofill = () => {
      const emailInput = document.querySelector<HTMLInputElement>("input[name='lbsview-access-email']");
      const passwordInput = document.querySelector<HTMLInputElement>("input[name='lbsview-access-password']");

      if (!emailInput || !isLegacyEstateValue(emailInput.value)) {
        return;
      }

      emailInput.value = "";
      setEmail("");

      if (passwordInput) {
        passwordInput.value = "";
        setPassword("");
      }
    };
    clearLegacyAutofill();

    const timers = [100, 500, 1200].map((delay) =>
      window.setTimeout(() => {
        setEmail((current) => (isLegacyEstateValue(current) ? "" : current));
        clearLegacyAutofill();
      }, delay)
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [mode]);

  useEffect(() => {
    if (mode !== "signup") {
      return;
    }

    let active = true;

    readPublicAppwriteEstates()
      .then((estates) => {
        if (!active || !estates.length) {
          return;
        }

        const sortedEstates = sortEstatesWithDefaultFirst(estates);
        setEstateOptions(sortedEstates);
        setEstateId((current) =>
          sortedEstates.some((estateOption) => estateOption.id === current) ? current : sortedEstates[0].id
        );
      })
      .catch(() => {
        // Keep bundled estate options when the online list is unavailable.
      });

    return () => {
      active = false;
    };
  }, [mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    let redirecting = false;
    setLoading(true);
    setLoginProgress(mode === "login" ? "Signing in..." : "");
    setMessage("");
    setSubmittedEmail("");
    setMessageTone("info");

    if (isLegacyEstateValue(email)) {
      setEmail("");
      setPassword("");
      setMessageTone("error");
      setMessage("Old estate demo emails are disabled. Use a phone number or an @corso.ng email instead.");
      setLoading(false);
      return;
    }

    try {
      if (mode === "forgot") {
        setMessageTone("success");
        setMessage("Ask an estate admin to reset your Corso password from Users & Roles.");
        return;
      }

      if (mode === "signup") {
        const normalizedPhone = normalizePhoneNumber(phone);
        const passwordError = getPasswordQualityError(password);
        if (passwordError) {
          setMessageTone("error");
          setMessage(passwordError);
          setLoading(false);
          return;
        }

        if (!localDemoEnabled) {
          const result = await createAppwriteAccessRequest({
            fullName: name,
            phone: normalizedPhone,
            email,
            password,
            role,
            estate: estateName,
            estateId
          });

          if (result.status === "already-approved") {
            setMessageTone("success");
            setMessage(result.message ?? "This account is already approved. Go back to login and sign in.");
            setLoading(false);
            return;
          }

          if (result.status === "already-pending") {
            setMessageTone("info");
            setMessage(result.message ?? "This phone number already has a pending access request.");
            setLoading(false);
            return;
          }

          setSubmittedEmail(normalizedPhone);
          setMessageTone("success");
          setMessage(result.message ?? "Access request submitted. An estate admin must approve this account before login.");
          setEmail("");
          setPhone("");
          setPassword("");
          setName("");
          return;
        }

        const result = createLocalAccessRequest({
          fullName: name,
          phone: normalizedPhone,
          email,
          password,
          role,
          estate: estateName
        });

        if (result.status === "already-approved") {
          setMessageTone("success");
          setMessage("This account is already approved. Go back to login and sign in.");
          return;
        }

        if (result.status === "already-pending") {
          setMessageTone("info");
          setMessage("This access request is already pending admin approval.");
          return;
        }

        setSubmittedEmail(result.request.phone || result.request.email);
        setMessageTone("success");
        setMessage("Access request submitted. An estate admin must approve this account before login.");
        setEmail("");
        setPhone("");
        setPassword("");
        setName("");
        return;
      }

      const demoUser = localDemoEnabled
        ? demoUsers.find((user) => user.email.toLowerCase() === email.toLowerCase())
        : undefined;
      if (appwriteLoginPreferred) {
        setLoginProgress("Signing in...");
        const appwriteResult = await signInWithAppwrite(email, password);
        if (appwriteResult.ok && appwriteResult.user) {
          setLoginProgress("Loading your profile...");
          persistSession(appwriteResult.user);
          const destination = params.get("next") ?? roleHome[appwriteResult.user.role];
          router.prefetch(destination);
          setLoginProgress("Almost ready...");
          redirecting = true;
          window.location.assign(destination);
          return;
        }

        if (!localDemoEnabled) {
          setMessageTone("error");
          setMessage(appwriteResult.error ?? "Invalid login details.");
          setLoading(false);
          return;
        }

        if (!appwriteResult.canFallback && !demoUser) {
          setMessageTone("error");
          setMessage(appwriteResult.error ?? "Invalid login details.");
          setLoading(false);
          return;
        }
      }

      if (!appwriteLoginPreferred) {
        setLoginProgress("Signing in...");
        const appwriteResult = await signInWithAppwrite(email, password);
        if (appwriteResult.ok && appwriteResult.user) {
          setLoginProgress("Loading your profile...");
          persistSession(appwriteResult.user);
          const destination = params.get("next") ?? roleHome[appwriteResult.user.role];
          router.prefetch(destination);
          setLoginProgress("Almost ready...");
          redirecting = true;
          window.location.assign(destination);
          return;
        }

        if (!localDemoEnabled) {
          setMessageTone("error");
          setMessage(appwriteResult.error ?? "Invalid login details.");
          setLoading(false);
          return;
        }

        if (!appwriteResult.canFallback && !demoUser) {
          setMessageTone("error");
          setMessage(appwriteResult.error ?? "Invalid login details.");
          setLoading(false);
          return;
        }
      }

      if (!demoUser) {
        const approvedUser = findApprovedLocalUser(email, password);
        if (approvedUser) {
          setLoginProgress("Loading your profile...");
          persistSession({
            email: approvedUser.email,
            phone: approvedUser.phone,
            name: approvedUser.fullName,
            role: approvedUser.role,
            estate: approvedUser.estate
          });
          const destination = params.get("next") ?? roleHome[approvedUser.role];
          router.prefetch(destination);
          setLoginProgress("Almost ready...");
          redirecting = true;
          window.location.assign(destination);
          return;
        }

        const accessRequest = localDemoEnabled
          ? findLocalAccessRequest(email)
          : await readAppwriteAccessRequestForCurrentUser(email);
        if (accessRequest?.status === "pending") {
          setMessageTone("info");
          setMessage("This account is waiting for estate admin approval.");
          setLoading(false);
          return;
        }

        if (accessRequest?.status === "rejected") {
          setMessageTone("error");
          setMessage("This access request was rejected. Contact the estate admin.");
          setLoading(false);
          return;
        }

        setMessageTone("error");
        setMessage("No approved account found for this phone or email. Request access first or ask admin to approve it.");
        setLoading(false);
        return;
      }

      if (demoUser.password !== password) {
        setMessageTone("error");
        setMessage("Incorrect password for this demo account.");
        setLoading(false);
        return;
      }

      setLoginProgress("Loading your profile...");
      persistSession({
        email,
        phone: "",
        name: demoUser.name,
        role: demoUser.role,
        estate: "LBS View Estate"
      });
      const destination = params.get("next") ?? roleHome[demoUser.role];
      router.prefetch(destination);
      setLoginProgress("Almost ready...");
      redirecting = true;
      window.location.assign(destination);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "The access request could not be submitted. Please try again.");
    } finally {
      if (!redirecting) {
        setLoading(false);
        setLoginProgress("");
      }
    }
  }

  return (
    <Card className="mx-auto w-full max-w-xl p-6">
      <div className="mb-7 flex items-center gap-3">
        <BrandMark className="h-12 w-12" />
        <div>
          <h1 className="text-xl font-semibold text-white">
            {mode === "login" ? "Sign in to Corso" : mode === "signup" ? "Request estate access" : "Reset password"}
          </h1>
          <p className="text-sm text-slate-400">Secure access for estate teams and residents.</p>
        </div>
      </div>

      {mode === "signup" && submittedEmail ? (
        <div className="mb-5 rounded-lg border border-smart/30 bg-smart/10 p-4 text-sm text-slate-100">
          <p className="font-semibold text-white">Request submitted for {submittedEmail}</p>
          <p className="mt-1 leading-6 text-slate-300">
            The account is now waiting for admin approval. Admin can approve it from Users and roles, under Access requests.
          </p>
        </div>
      ) : null}

      <form ref={formRef} className="grid gap-4" onSubmit={submit} autoComplete={mode === "signup" ? "off" : "on"}>
        {mode === "signup" ? (
          <Field label="Full name">
            <Input
              name="lbsview-request-full-name"
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </Field>
        ) : null}
        {mode === "signup" ? (
          <Field label="Phone number">
            <Input
              type="tel"
              name="lbsview-access-phone"
              autoComplete="tel"
              value={phone}
              placeholder="+234 800 000 0000"
              onChange={(event) => setPhone(event.target.value)}
              required
            />
          </Field>
        ) : null}
        {mode !== "signup" ? (
          <Field label="Phone number or email">
            <Input
              type="text"
              name="email"
              autoComplete="username"
              value={email}
              placeholder="+234 800 000 0000 or name@example.com"
              onChange={(event) => {
                const nextEmail = event.target.value;
                setEmail(isLegacyEstateValue(nextEmail) ? "" : nextEmail);
              }}
              required
            />
          </Field>
        ) : null}
        {mode !== "forgot" ? (
          <Field label="Password">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                name={mode === "signup" ? "lbsview-access-password" : "password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
                className="pr-12"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-smart/40"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
        ) : null}
        {mode === "signup" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Requested role">
              <Select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
                <option value="resident">{roleLabels.resident}</option>
              </Select>
            </Field>
            <Field label="Estate">
              <Select value={estateId} onChange={(event) => setEstateId(event.target.value)}>
                {estateOptions.map((estateOption) => (
                  <option key={estateOption.id} value={estateOption.id}>
                    {estateOption.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading && mode === "login" ? loginProgress || "Signing in..." : loading ? "Please wait" : mode === "login" ? "Sign in" : mode === "signup" ? "Submit access request" : "Send reset link"}
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        </Button>
        {loading && mode === "login" ? (
          <div className="rounded-lg border border-smart/25 bg-smart/10 px-3 py-2 text-sm font-medium text-smart">
            {loginProgress || "Signing in..."}
          </div>
        ) : null}
        {message ? (
          <div className={messageClassName(messageTone)}>{message}</div>
        ) : null}
      </form>

      {mode === "login" && demoLoginsEnabled ? (
        <div className="mt-6 rounded-lg border border-smart/25 bg-smart/10 p-4">
          <p className="text-sm font-semibold text-white">Explore the demo estate</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Take a one-tap tour of Africa Secured Estate. No signup needed.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {Object.entries(EXHIBITION_DEMO_LOGINS).map(([key, account]) => (
              <button
                key={key}
                type="button"
                disabled={loading}
                onClick={() => startDemoLogin(key)}
                className="rounded-lg border border-smart/30 bg-ink/40 px-3 py-2 text-left transition hover:border-smart hover:bg-smart/15 disabled:opacity-60"
              >
                <span className="block text-sm font-semibold text-smart">{account.label}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-slate-400">{account.blurb}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {mode === "login" && localDemoEnabled ? (
        <div className="mt-6 rounded-lg border border-line bg-ink/50 p-4 text-sm text-slate-400">
          <p className="font-medium text-slate-200">Demo accounts</p>
          <div className="mt-3 grid gap-2">
            {demoUsers.map((user) => (
              <button
                key={user.email}
                onClick={() => setEmail(user.email)}
                className="text-left text-xs text-slate-400 transition hover:text-smart"
                type="button"
              >
                {user.email} / {DEMO_PASSWORD}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-400">
        {mode === "login" ? <Link href="/" className="text-smart">Back to home</Link> : null}
        {mode !== "login" ? <Link href="/login" className="text-smart">Back to login</Link> : null}
        {mode === "login" ? <Link href="/signup" className="text-smart">Request access</Link> : null}
        {mode === "login" ? <Link href="/forgot-password" className="text-smart">Forgot password</Link> : null}
      </div>
    </Card>
  );
}

async function signInWithAppwrite(identifier: string, password: string): Promise<{
  ok: boolean;
  canFallback: boolean;
  error?: string;
  user?: {
    email: string;
    phone?: string;
    name: string;
    role: UserRole;
    estate: string;
  };
}> {
  try {
    const response = await fetch("/api/appwrite/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ identifier, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = String(data.error ?? "Invalid login details.");
      return {
        ok: false,
        canFallback: response.status !== 401,
        error
      };
    }

    return {
      ok: true,
      canFallback: false,
      user: data.user
    };
  } catch (error) {
    return {
      ok: false,
      canFallback: true,
      error: error instanceof Error ? error.message : "Corso login is unavailable."
    };
  }
}

function messageClassName(tone: "success" | "error" | "info") {
  if (tone === "error") {
    return "rounded-lg border border-red-400/40 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-100";
  }

  if (tone === "success") {
    return "rounded-lg border border-smart/40 bg-smart/10 px-3 py-2 text-sm font-semibold text-smart-dark dark:text-smart";
  }

  return "rounded-lg border border-sky/30 bg-sky/10 px-3 py-2 text-sm font-semibold text-sky-dark dark:text-sky";
}

function persistSession({
  email,
  phone,
  name,
  role,
  estate
}: {
  email: string;
  phone?: string;
  name: string;
  role: UserRole;
  estate: string;
}) {
  localStorage.setItem("corso_user", JSON.stringify({ email, phone, name, role, estate }));
  document.cookie = `corso_role=${role}; path=/; max-age=604800; SameSite=Lax${
    window.location.protocol === "https:" ? "; Secure" : ""
  }`;
}
