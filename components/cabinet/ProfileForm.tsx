"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Field, { btnPrimary, inputClass } from "@/components/admin/Field";

type Props = {
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

export default function ProfileForm({ email, displayName, avatarUrl }: Props) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [login, setLogin] = useState(email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [preview, setPreview] = useState(avatarUrl);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = (picked: File | null) => {
    setFile(picked);
    if (!picked) return;
    const url = URL.createObjectURL(picked);
    setPreview(url);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const body = new FormData();
      body.set("displayName", name);
      body.set("email", login);
      if (currentPassword) body.set("currentPassword", currentPassword);
      if (newPassword) body.set("newPassword", newPassword);
      if (file) body.set("avatar", file);

      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Не вдалося зберегти");
      setCurrentPassword("");
      setNewPassword("");
      setFile(null);
      if (data.user?.avatarUrl) setPreview(data.user.avatarUrl);
      setMessage("Збережено.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="h-20 w-20 rounded-full object-cover ring-1 ring-slate-200"
          />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-xl font-semibold text-brand-700">
            {(name || login).slice(0, 1).toUpperCase()}
          </span>
        )}
        <label className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand-300">
          Змінити аватар
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Імʼя в кабінеті">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Як до вас звертатись"
          />
        </Field>
        <Field label="Логін (email)">
          <input
            type="email"
            required
            className={inputClass}
            value={login}
            onChange={(e) => setLogin(e.target.value)}
          />
        </Field>
        <Field label="Поточний пароль" hint="Потрібен, щоб змінити логін або пароль">
          <input
            type="password"
            className={inputClass}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <Field label="Новий пароль" hint="Мінімум 8 символів, порожнє — без змін">
          <input
            type="password"
            className={inputClass}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <button type="submit" disabled={busy} className={btnPrimary}>
        {busy ? "Збереження…" : "Зберегти профіль"}
      </button>
    </form>
  );
}
