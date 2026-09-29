"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type AutoReportRowView = {
  kind: "CARRIER" | "AGENT";
  id: string;
  name: string;
  enabled: boolean;
  sendDay: number;
  email: string | null;
  fallbackEmail: string | null;
  rewardPercent?: number | null;
  lastSentPeriod: string | null;
  lastSentAt: string | null;
};

type Draft = AutoReportRowView & { emailText: string; rewardText: string };

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toDraft = (r: AutoReportRowView): Draft => ({
  ...r,
  emailText: r.email ?? "",
  rewardText: r.rewardPercent == null ? "" : String(r.rewardPercent),
});

export default function AutoReportsForm({
  canEdit,
  initialEnabled,
  carriers,
  agents,
}: {
  canEdit: boolean;
  initialEnabled: boolean;
  carriers: AutoReportRowView[];
  agents: AutoReportRowView[];
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [rows, setRows] = useState<Draft[]>(() => [...carriers, ...agents].map(toDraft));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const patch = (id: string, change: Partial<Draft>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...change } : r)));
    setMessage(null);
  };
  const setAll = (kind: Draft["kind"], on: boolean) => {
    setRows((prev) => prev.map((r) => (r.kind === kind ? { ...r, enabled: on } : r)));
    setMessage(null);
  };

  const save = async () => {
    // Name the counterparty in the message instead of a row number.
    const badEmail = rows.find((r) => r.emailText.trim() && !EMAIL_RE.test(r.emailText.trim()));
    if (badEmail) {
      setMessage({ ok: false, text: `${badEmail.name}: некоректний e-mail` });
      return;
    }
    const badReward = rows.find((r) => {
      if (r.kind !== "AGENT" || r.rewardText.trim() === "") return false;
      const n = Number(r.rewardText.replace(",", "."));
      return !Number.isFinite(n) || n < 0 || n > 100;
    });
    if (badReward) {
      setMessage({ ok: false, text: `${badReward.name}: винагорода — від 0 до 100%` });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/finance/auto-reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          rows: rows.map((r) => ({
            kind: r.kind,
            id: r.id,
            enabled: r.enabled,
            sendDay: r.sendDay,
            email: r.emailText.trim() || null,
            ...(r.kind === "AGENT"
              ? { rewardPercent: r.rewardText.trim() === "" ? null : Number(r.rewardText.replace(",", ".")) }
              : {}),
          })),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? `Помилка (${res.status})` });
        return;
      }
      setMessage({ ok: true, text: "Збережено." });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Помилка мережі" });
    } finally {
      setSaving(false);
    }
  };

  const carrierRows = rows.filter((r) => r.kind === "CARRIER");
  const agentRows = rows.filter((r) => r.kind === "AGENT");
  const selected = rows.filter((r) => r.enabled).length;

  return (
    <div className="space-y-8">
      <div
        className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 ring-1 ${
          enabled ? "bg-emerald-50 ring-emerald-200" : "bg-slate-50 ring-slate-200"
        }`}
      >
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5"
            checked={enabled}
            disabled={!canEdit}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setMessage(null);
            }}
            aria-label="Автовідправка увімкнена"
          />
          <span>
            <span className="block font-semibold text-slate-900">
              Автовідправка {enabled ? "увімкнена" : "вимкнена"}
            </span>
            <span className="block text-sm text-slate-600">
              {enabled
                ? "Щодня звіти за попередній місяць формуються для позначених контрагентів, коли настає їхній день."
                : "Нічого не надсилається, навіть позначеним нижче. Налаштуйте список зараз і увімкніть пізніше."}
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              Поштовий сервіс ще не підключено: звіти формуються, але листи не відправляються. Розклад: GitHub
              Actions → <code>/api/cron/auto-reports</code>.
            </span>
          </span>
        </label>
        <span className="text-sm text-slate-600">Позначено: {selected}</span>
      </div>

      <RowsTable
        title="Перевізники"
        hint="Розрахунок за попередній місяць: сальдо, рахунок і акт. Якщо розрахунок ще не сформовано — сформується автоматично."
        rows={carrierRows}
        canEdit={canEdit}
        onPatch={patch}
        onAll={(on) => setAll("CARRIER", on)}
      />
      <RowsTable
        title="Агенти"
        hint="Продажі за попередній місяць, нарахована винагорода і загальне сальдо. E-mail порожній — надішлемо на e-mail акаунта."
        rows={agentRows}
        canEdit={canEdit}
        onPatch={patch}
        onAll={(on) => setAll("AGENT", on)}
        withReward
      />

      {canEdit ? (
        <div className="sticky bottom-4 flex items-center justify-end gap-3">
          {message ? (
            <p className={`text-sm ${message.ok ? "text-emerald-700" : "text-rose-600"}`}>{message.text}</p>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="h-11 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Зберігаю…" : "Зберегти налаштування"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Лише перегляд — змінювати може користувач з дозволом «Фінанси — дії».</p>
      )}
    </div>
  );
}

function RowsTable({
  title,
  hint,
  rows,
  canEdit,
  onPatch,
  onAll,
  withReward = false,
}: {
  title: string;
  hint: string;
  rows: Draft[];
  canEdit: boolean;
  onPatch: (id: string, change: Partial<Draft>) => void;
  onAll: (on: boolean) => void;
  withReward?: boolean;
}) {
  const allOn = rows.length > 0 && rows.every((r) => r.enabled);
  const input =
    "h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-slate-50";
  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
      <div className="mt-3 overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-24 px-4 py-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allOn}
                    disabled={!canEdit || rows.length === 0}
                    onChange={(e) => onAll(e.target.checked)}
                    aria-label={`${title}: надсилати всім`}
                  />
                  Надсилати
                </label>
              </th>
              <th className="px-4 py-3">{title === "Агенти" ? "Агент" : "Перевізник"}</th>
              <th className="px-4 py-3">Число місяця</th>
              <th className="px-4 py-3">E-mail</th>
              {withReward ? <th className="px-4 py-3">Винагорода, %</th> : null}
              <th className="px-4 py-3">Останній звіт</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={withReward ? 6 : 5} className="px-4 py-8 text-center text-slate-500">
                  {title === "Агенти"
                    ? "Агентів немає — призначте користувачу роль «Агент» або «Партнер»."
                    : "Сторонніх перевізників немає."}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className={r.enabled ? "" : "text-slate-500"}>
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      disabled={!canEdit}
                      onChange={(e) => onPatch(r.id, { enabled: e.target.checked })}
                      aria-label={`Надсилати: ${r.name}`}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{r.name}</td>
                  <td className="px-4 py-2.5">
                    <select
                      className={input}
                      value={r.sendDay}
                      disabled={!canEdit}
                      onChange={(e) => onPatch(r.id, { sendDay: Number(e.target.value) })}
                      aria-label={`Число місяця: ${r.name}`}
                    >
                      {DAYS.map((d) => (
                        <option key={d} value={d}>
                          {d}-го
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      className={`${input} w-64`}
                      type="email"
                      value={r.emailText}
                      disabled={!canEdit}
                      placeholder={r.fallbackEmail ?? "buh@pereviznyk.ua"}
                      onChange={(e) => onPatch(r.id, { emailText: e.target.value })}
                      aria-label={`E-mail: ${r.name}`}
                    />
                    {r.enabled && !r.emailText.trim() && !r.fallbackEmail ? (
                      <div className="mt-1 text-[11px] text-amber-700">Без e-mail звіт не піде</div>
                    ) : null}
                  </td>
                  {withReward ? (
                    <td className="px-4 py-2.5">
                      <input
                        className={`${input} w-20`}
                        inputMode="decimal"
                        value={r.rewardText}
                        disabled={!canEdit}
                        placeholder="—"
                        onChange={(e) => onPatch(r.id, { rewardText: e.target.value })}
                        aria-label={`Винагорода, %: ${r.name}`}
                      />
                    </td>
                  ) : null}
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">
                    {r.lastSentPeriod
                      ? `за ${r.lastSentPeriod}${r.lastSentAt ? ` · ${r.lastSentAt.slice(0, 10)}` : ""}`
                      : "ще не було"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
