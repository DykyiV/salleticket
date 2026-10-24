"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Icon from "@/components/site/Icon";
import { fmt, useI18n } from "@/lib/i18n/client";
import { homeAfterSignIn, safeNextPath } from "@/lib/security/redirect";
import { telHref } from "@/lib/siteContacts";

type Mode = "login" | "register";

/**
 * Sign-in / registration form. `next` arrives already checked by the page
 * (only a path on this site) and is checked again here before navigating;
 * without it passengers go to «Мої квитки» and staff to the cabinet.
 */
export default function AuthForm({ mode, next, supportPhone }: { mode: Mode; next: string | null; supportPhone: string | null }) {
  const router = useRouter();
  const { t } = useI18n();
  const a = t.auth;
  const login = mode === "login";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const safeNext = safeNextPath(next);
  const switchHref = `${login ? "/register" : "/login"}${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const errs: typeof fieldErrors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = a.errorEmail;
    if (password.length < 8) errs.password = a.errorPassword;
    setFieldErrors(errs);
    if (errs.email || errs.password) return;

    setSubmitting(true);
    let leaving = false;
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; user?: { role?: string } };
      if (!res.ok) {
        if (res.status === 401) setError(a.errorInvalid);
        else if (res.status === 409) setError(a.errorExists);
        else if (res.status === 429) {
          const seconds = Number(res.headers.get("Retry-After")) || 60;
          setError(fmt(a.errorTooMany, { min: Math.max(1, Math.ceil(seconds / 60)) }));
        } else setError(data.error ?? a.errorGeneric);
        return;
      }
      leaving = true;
      router.push(safeNext ?? homeAfterSignIn(data.user?.role));
      router.refresh();
    } catch {
      setError(a.errorGeneric);
    } finally {
      if (!leaving) setSubmitting(false);
    }
  };

  const inputCls = (bad?: string) =>
    `h-12 w-full rounded-xl border bg-white px-3 text-base text-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
      bad ? "border-rose-400 focus:ring-rose-200" : "border-slate-200 focus:border-brand-500 focus:ring-brand-500/20"
    }`;

  return (
    <form onSubmit={submit} noValidate className="w-full rounded-2xl bg-white p-6 shadow-soft ring-1 ring-slate-200/70 sm:p-8">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        <Icon name={login ? "user" : "plus"} className="h-5 w-5" />
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-navy">{login ? a.loginTitle : a.registerTitle}</h1>
      <p className="mt-1 text-sm text-ink-muted">{login ? a.loginSubtitle : a.registerSubtitle}</p>

      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-navy">
            {a.email}
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
            }}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            className={inputCls(fieldErrors.email)}
            placeholder="you@example.com"
          />
          {fieldErrors.email ? (
            <p id="email-error" className="mt-1 text-sm text-rose-700">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-navy">
            {a.password}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={login ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
              }}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "password-error" : !login ? "password-hint" : undefined}
              className={`${inputCls(fieldErrors.password)} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? a.hide : a.show}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-500 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Icon name={showPassword ? "eyeOff" : "eye"} className="h-5 w-5" />
            </button>
          </div>
          {fieldErrors.password ? (
            <p id="password-error" className="mt-1 text-sm text-rose-700">
              {fieldErrors.password}
            </p>
          ) : !login ? (
            <p id="password-hint" className="mt-1 text-xs text-ink-soft">
              {a.passwordHint}
            </p>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={submitting} className="btn-primary mt-6 w-full">
        {submitting ? a.submitting : login ? a.submitLogin : a.submitRegister}
      </button>

      <p className="mt-5 text-center text-sm text-ink-muted">
        {login ? a.noAccount : a.haveAccount}{" "}
        <Link href={switchHref} className="font-semibold text-brand-700 hover:underline">
          {login ? a.toRegister : a.toLogin}
        </Link>
      </p>

      <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm text-ink-muted">
        {login && supportPhone ? (
          <p>
            {a.forgot}{" "}
            <a href={telHref(supportPhone)} className="whitespace-nowrap font-semibold text-navy hover:text-brand-700">
              {supportPhone}
            </a>
          </p>
        ) : null}
        <p>{a.guestNote}</p>
      </div>
    </form>
  );
}
