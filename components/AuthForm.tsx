"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

type Mode = "login" | "register";

type Props = {
  mode: Mode;
};

const PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "apple", label: "Apple" },
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
] as const;

function providerError(code: string | null, provider: string | null): string | null {
  if (!code) return null;
  const name = provider
    ? provider.charAt(0).toUpperCase() + provider.slice(1)
    : "цей сервіс";
  if (code === "oauth_unconfigured") {
    return `Вхід через ${name} ще не підключений на сервері. Скористайтесь email або зверніться до адміністратора.`;
  }
  if (code === "oauth_state") {
    return "Сесія входу застаріла. Спробуйте ще раз.";
  }
  if (code === "oauth_failed") {
    return `Не вдалося увійти через ${name}.`;
  }
  return null;
}

export default function AuthForm({ mode }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") || "/cabinet";
  const booked = params.get("booked") === "1";
  const query = params.toString();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() =>
    providerError(params.get("error"), params.get("provider"))
  );
  const [submitting, setSubmitting] = useState(false);

  const oauthHrefs = useMemo(
    () =>
      PROVIDERS.map((provider) => ({
        ...provider,
        href: `/api/auth/oauth/${provider.id}?next=${encodeURIComponent(nextPath)}`,
      })),
    [nextPath]
  );

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Вкажіть коректний email.");
      return;
    }
    if (password.length < 8) {
      setError("Пароль має містити щонайменше 8 символів.");
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
      if (!res.ok) throw new Error(data?.error ?? "Не вдалося увійти");

      const claimed = Number(data?.claimed ?? 0);
      const target =
        claimed > 0 && !nextPath.startsWith("/pay")
          ? "/cabinet/tickets"
          : nextPath;
      router.push(target);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Щось пішло не так.");
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === "login" ? "Вхід" : "Реєстрація";
  const subtitle =
    mode === "login"
      ? "Увійдіть, щоб побачити свої квитки."
      : "Створіть акаунт — збережені квитки одразу з’являться в кабінеті.";
  const cta = mode === "login" ? "Увійти" : "Зареєструватися";
  const otherHref = `${mode === "login" ? "/register" : "/login"}${query ? `?${query}` : ""}`;
  const otherLabel =
    mode === "login" ? "Створити акаунт" : "У мене вже є акаунт";

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>

      {booked ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Квитки вже збережені. Після входу або реєстрації вони з’являться в
          цьому кабінеті.
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-2">
        {oauthHrefs.map((provider) => (
          <a
            key={provider.id}
            href={provider.href}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:text-brand-700"
          >
            {provider.label}
          </a>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-slate-400">або email і пароль</p>

      <form onSubmit={submit}>
        <div className="mt-3 space-y-4">
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
              Пароль
            </span>
            <input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
              placeholder="Щонайменше 8 символів"
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
          {submitting ? "Зачекайте…" : cta}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href={otherHref} className="font-medium text-brand-700 hover:underline">
          {otherLabel}
        </Link>
      </p>
    </div>
  );
}
