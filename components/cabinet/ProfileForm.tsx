"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Field, { btnPrimary, inputClass } from "@/components/admin/Field";

type Props = {
  email: string;
  displayName: string;
  avatarUrl: string | null;
  notifyChannels?: string[];
};

const CHANNELS = [
  { id: "email", label: "Email", icon: "📧" },
  { id: "sms", label: "SMS", icon: "📱" },
  { id: "viber", label: "Viber", icon: "💬" },
  { id: "telegram", label: "Telegram", icon: "✈️" },
  { id: "push", label: "Push", icon: "🔔" },
] as const;

export default function ProfileForm({
  email,
  displayName,
  avatarUrl,
  notifyChannels = ["email", "push"],
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [login, setLogin] = useState(email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [preview, setPreview] = useState(avatarUrl);
  const [file, setFile] = useState<File | null>(null);
  const [channels, setChannels] = useState<string[]>(notifyChannels);
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
      body.set("notifyChannels", JSON.stringify(channels));
      if (currentPassword) body.set("currentPassword", currentPassword);
      if (newPassword) body.set("newPassword", newPassword);
      if (file) body.set("avatar", file);

      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        body,
      });
      const text = await res.text();
      let data: { error?: string; user?: { avatarUrl?: string | null } } = {};
      if (text) {
        try {
          data = JSON.parse(text) as typeof data;
        } catch {
          throw new Error("Не вдалося зберегти");
        }
      }
      if (!res.ok) throw new Error(data.error ?? "Не вдалося зберегти");
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

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Канали сповіщень
        </p>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((channel) => {
            const active = channels.includes(channel.id);
            return (
              <label
                key={channel.id}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "border-brand-300 bg-brand-50 text-brand-800"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={active}
                  onChange={() =>
                    setChannels((prev) =>
                      active
                        ? prev.filter((c) => c !== channel.id)
                        : [...prev, channel.id]
                    )
                  }
                />
                <span aria-hidden>{channel.icon}</span>
                {channel.label}
              </label>
            );
          })}
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          Куди надсилати підтвердження бронювань і статуси оплат.
        </p>
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <button type="submit" disabled={busy} className={btnPrimary}>
        {busy ? "Збереження…" : "Зберегти профіль"}
      </button>
    </form>
  );
}
