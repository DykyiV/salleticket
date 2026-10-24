import Icon from "@/components/site/Icon";
import type { Dict } from "@/lib/i18n/dict";
import { fmt } from "@/lib/i18n/format";

const STEPS = ["trip", "seats", "passengers", "payment", "ticket"] as const;
export type StepId = (typeof STEPS)[number];

/** Рейс → Місця → Пасажири → Оплата → Квиток. `current` is 1-based. */
export default function StepIndicator({ t, current, tone = "dark" }: { t: Dict; current: number; tone?: "dark" | "light" }) {
  const dark = tone === "dark";
  return (
    <nav aria-label={fmt(t.steps.label, { n: current })}>
      <p className={`mb-2 text-xs font-medium sm:hidden ${dark ? "text-blue-200" : "text-ink-soft"}`}>
        {fmt(t.steps.label, { n: current })} · {t.steps[STEPS[current - 1]]}
      </p>
      <ol className="flex items-center gap-1.5 sm:gap-2">
        {STEPS.map((id, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          return (
            <li key={id} className="flex flex-1 items-center gap-1.5 sm:gap-2" aria-current={active ? "step" : undefined}>
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  done
                    ? "bg-ok text-white"
                    : active
                      ? "bg-brand-600 text-white ring-4 ring-brand-600/25"
                      : dark
                        ? "bg-white/10 text-blue-200 ring-1 ring-white/15"
                        : "bg-slate-100 text-slate-500"
                }`}
              >
                {done ? <Icon name="check" className="h-4 w-4" /> : n}
              </span>
              <span
                className={`hidden truncate text-sm sm:inline ${
                  active ? (dark ? "font-semibold text-white" : "font-semibold text-navy") : dark ? "text-blue-200" : "text-ink-soft"
                }`}
              >
                {t.steps[id]}
              </span>
              {n < STEPS.length ? (
                <span aria-hidden="true" className={`h-0.5 flex-1 rounded ${done ? "bg-ok" : dark ? "bg-white/15" : "bg-slate-200"}`} />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
