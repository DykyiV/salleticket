"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState, type FormEvent } from "react";

type Mode = "login" | "register";

type Props = {
  mode: Mode;
};

export default function AuthForm({ mode }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `${mode} failed`);

      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === "login" ? "Sign in" : "Create your account";
  const subtitle =
    mode === "login"
      ? "Welcome back! Enter your details."
      : "Register in seconds to book tickets.";
  const cta = mode === "login" ? "Sign in" : "Create account";
  const otherHref = mode === "login" ? "/register" : "/login";
  const otherLabel =
    mode === "login" ? "Create an account" : "I already have an account";

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8"
    >
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        {title}
      </h1>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>

      <div className="mt-6 space-y-4">
        <label htmlFor="email" className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Email
          </span>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
            placeholder="you@example.com"
          />
        </label>

        <label htmlFor="password" className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Password
          </span>
          <input
            id="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
            placeholder="At least 8 characters"
          />
        </label>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? "Please wait…" : cta}
      </button>

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link
          href={otherHref}
          className="font-medium text-brand-700 hover:underline"
        >
          {otherLabel}
        </Link>
      </p>
    </form>
  );
}
