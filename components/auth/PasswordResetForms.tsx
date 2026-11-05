"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Icon from "@/components/site/Icon";
import { useI18n } from "@/lib/i18n/client";
import { homeAfterSignIn } from "@/lib/security/redirect";
import { telHref } from "@/lib/siteContacts";

const inputCls = (bad?: boolean) =>
  `h-12 w-full rounded-xl border bg-white px-3 text-base text-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
    bad ? "border-rose-400 focus:ring-rose-200" : "border-slate-200 focus:border-brand-500 focus:ring-brand-500/20"
  }`;

const card = "w-full rounded-2xl bg-white p-6 shadow-soft ring-1 ring-slate-200/70 sm:p-8";

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700 ring-1 ring-rose-100">
      {children}
    </p>
  );
}

/** «Забули пароль?»: asks for the e-mail and sends the link. */
export function ForgotPasswordForm({ supportPhone }: { supportPhone: string | null }) {
  const { t } = useI18n();
  const a = t.auth;
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "noMail">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(a.errorEmail);
      return;
    }
    setError(null);
    setState("sending");
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) setState("sent");
      else if (res.status === 503) setState("noMail");
      else {
        setState("idle");
        setError(res.status === 429 ? a.errorTooMany.replace("{min}", "60") : a.errorGeneric);
      }
    } catch {
      setState("idle");
      setError(a.errorGeneric);
    }
  };

  return (
    <form onSubmit={submit} noValidate className={card}>
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        <Icon name="user" className="h-5 w-5" />
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-navy">{a.forgotTitle}</h1>
      {state === "sent" ? (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-100">{a.forgotSent}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-muted">{a.forgotSubtitle}</p>
          <div className="mt-6">
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
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls(Boolean(error))}
              placeholder="you@example.com"
            />
          </div>
          {error ? <Alert>{error}</Alert> : null}
          {state === "noMail" ? (
            <Alert>
              {a.forgotNoMail}
              {supportPhone ? (
                <>
                  {" "}
                  <a href={telHref(supportPhone)} className="whitespace-nowrap font-semibold">
                    {supportPhone}
                  </a>
                </>
              ) : null}
            </Alert>
          ) : null}
          <button type="submit" disabled={state === "sending"} className="btn-primary mt-6 w-full">
            {state === "sending" ? a.submitting : a.forgotSubmit}
          </button>
        </>
      )}
      <p className="mt-5 text-center text-sm">
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          {a.backToLogin}
        </Link>
      </p>
    </form>
  );
}

/** The page from the e-mail link: a new password, then straight into the cabinet. */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const a = t.auth;
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : a.resetInvalid);
  const [invalid, setInvalid] = useState(!token);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password.length < 8) {
      setError(a.errorPassword);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; user?: { role?: string } };
      if (res.ok) {
        router.push(homeAfterSignIn(data.user?.role));
        router.refresh();
        return;
      }
      if (data.error === "invalid_link") {
        setInvalid(true);
        setError(a.resetInvalid);
      } else setError(a.errorGeneric);
    } catch {
      setError(a.errorGeneric);
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={submit} noValidate className={card}>
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        <Icon name="user" className="h-5 w-5" />
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-navy">{a.resetTitle}</h1>
      <p className="mt-1 text-sm text-ink-muted">{a.resetSubtitle}</p>
      {!invalid ? (
        <div className="mt-6">
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-navy">
            {a.password}
          </label>
          <div className="relative">
            <input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputCls(Boolean(error))} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? a.hide : a.show}
              aria-pressed={show}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-500 hover:text-navy"
            >
              <Icon name={show ? "eyeOff" : "eye"} className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-1 text-xs text-ink-soft">{a.passwordHint}</p>
        </div>
      ) : null}
      {error ? <Alert>{error}</Alert> : null}
      {invalid ? (
        <Link href="/forgot-password" className="btn-primary mt-6 flex w-full justify-center">
          {a.resetAgain}
        </Link>
      ) : (
        <button type="submit" disabled={submitting} className="btn-primary mt-6 w-full">
          {submitting ? a.submitting : a.resetSubmit}
        </button>
      )}
    </form>
  );
}
