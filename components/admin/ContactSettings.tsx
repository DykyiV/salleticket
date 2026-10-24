"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary, inputClass } from "@/components/admin/Field";
import type { SiteContacts } from "@/lib/siteContacts";

const FIELDS: { key: keyof SiteContacts; label: string; placeholder: string }[] = [
  { key: "phoneUa", label: "Телефон в Україні", placeholder: "+38 044 444 00 44" },
  { key: "phoneEs", label: "Телефон в Іспанії", placeholder: "+34 …" },
  { key: "phoneDe", label: "Телефон у Німеччині", placeholder: "+49 …" },
  { key: "email", label: "E-mail підтримки", placeholder: "support@…" },
  { key: "website", label: "Сайт", placeholder: "grandes-tour.com.ua" },
  { key: "address", label: "Адреса офісу", placeholder: "Місто, вулиця, будинок" },
  { key: "viber", label: "Viber (номер)", placeholder: "+380…" },
  { key: "whatsapp", label: "WhatsApp (номер)", placeholder: "+34…" },
  { key: "telegram", label: "Telegram", placeholder: "@назва або посилання" },
  { key: "facebook", label: "Facebook", placeholder: "facebook.com/…" },
  { key: "instagram", label: "Instagram", placeholder: "instagram.com/…" },
];

/** Settings → «Контакти на сайті»: footer and support details. */
export default function ContactSettings({ initial }: { initial: SiteContacts }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не вдалося зберегти");
      setValues(data.contacts);
      setMessage("Збережено — зміни вже на сайті");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <p className="mb-4 text-xs text-slate-500">
        Показуються внизу кожної сторінки сайту. Порожні поля не показуються.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="block text-xs">
            <span className="mb-1 block font-medium text-slate-600">{f.label}</span>
            <input
              className={inputClass}
              value={values[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" className={btnPrimary} onClick={save} disabled={busy}>
          {busy ? "Збереження…" : "Зберегти"}
        </button>
        {message ? <span className="text-sm text-emerald-700">{message}</span> : null}
        {error ? <span className="text-sm text-rose-700">{error}</span> : null}
      </div>
    </div>
  );
}
