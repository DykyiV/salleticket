"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TemplateDTO } from "@/lib/routes/serialize";
import { weekdayName } from "@/lib/routes/weekdays";
import Field, { btnGhost, btnPrimary, inputClass } from "@/components/admin/Field";

export type CountryOption = {
  id: string;
  name: string;
  code: string | null;
  templateCount: number;
};

type Props = {
  initialTemplates: TemplateDTO[];
  initialCountries: CountryOption[];
};

export default function RouteTemplatesList({
  initialTemplates,
  initialCountries,
}: Props) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [countries, setCountries] = useState(initialCountries);
  const [countryName, setCountryName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, { country: string; items: TemplateDTO[] }>();
    for (const country of countries) {
      map.set(country.id, { country: country.name, items: [] });
    }
    for (const template of templates) {
      const bucket = map.get(template.countryId) ?? {
        country: template.countryName,
        items: [],
      };
      bucket.items.push(template);
      map.set(template.countryId, bucket);
    }
    return [...map.values()].filter(
      (g) => g.items.length > 0 || countries.some((c) => c.name === g.country)
    );
  }, [templates, countries]);

  const addCountry = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/countries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: countryName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Не вдалося додати країну");
      setCountries((list) => [
        ...list,
        {
          id: data.country.id,
          name: data.country.name,
          code: data.country.code,
          templateCount: 0,
        },
      ]);
      setCountryName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  const removeTemplate = async (row: TemplateDTO) => {
    if (!window.confirm(`Видалити шаблон «${row.name}»?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/route-templates/${row.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Не вдалося видалити");
      setTemplates((list) => list.filter((t) => t.id !== row.id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form onSubmit={addCountry} className="flex flex-wrap items-end gap-2">
          <Field label="Нова країна">
            <input
              value={countryName}
              onChange={(e) => setCountryName(e.target.value)}
              className={inputClass}
              placeholder="Іспанія"
              required
            />
          </Field>
          <button type="submit" disabled={busy} className={btnGhost}>
            Додати країну
          </button>
        </form>
        <Link href="/cabinet/routes/new" className={btnPrimary}>
          Новий шаблон маршруту
        </Link>
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      {grouped.length === 0 ? (
        <p className="rounded border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Ще немає країн і шаблонів. Додайте країну, потім створіть маршрут.
        </p>
      ) : (
        grouped.map((group) => (
          <section
            key={group.country}
            className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200"
          >
            <header className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {group.country}
              </h2>
            </header>
            {group.items.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-500">
                У цій країні ще немає маршрутів.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-white text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Маршрут</th>
                      <th className="px-4 py-2">Дні виїзду</th>
                      <th className="px-4 py-2">З України / повернення</th>
                      <th className="px-4 py-2">Автобус</th>
                      <th className="px-4 py-2">Виїздів</th>
                      <th className="px-4 py-2 text-right">Дії</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{row.name}</p>
                          <p className="text-xs text-slate-500">
                            {row.originCity} → {row.destinationCity}
                            {row.comment ? ` · ${row.comment}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3">{row.departureWeekdaysLabel}</td>
                        <td className="px-4 py-3 text-xs">
                          {weekdayName(row.ukraineDepartureWeekday)} /{" "}
                          {weekdayName(row.ukraineReturnWeekday)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {row.defaultBus ?? "—"}
                          <div className="text-slate-400">
                            {row.busPhone ?? ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {row.departureCount}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/cabinet/routes/${row.id}`}
                            className="mr-2 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                          >
                            Редагувати
                          </Link>
                          <Link
                            href={`/cabinet/departures?templateId=${row.id}`}
                            className="mr-2 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                          >
                            Виїзди
                          </Link>
                          <button
                            type="button"
                            onClick={() => removeTemplate(row)}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-rose-700"
                          >
                            Видалити
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}
