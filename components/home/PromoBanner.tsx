import type { Dict } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/i18n/config";
import { fmt, localeOf } from "@/lib/i18n/format";
import { activePromo } from "@/lib/site/promoBanner";

/** Black Friday strip above the search; renders nothing outside the promo days. */
export default function PromoBanner({ t, lang, today }: { t: Dict; lang: Lang; today: string }) {
  const promo = activePromo(today);
  if (!promo) return null;
  const until = new Intl.DateTimeFormat(localeOf(lang), { day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${promo.until}T00:00:00Z`),
  );
  return (
    <section aria-label={t.promoBanner.title} className="bg-black text-white">
      <div className="container-site flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-lg font-bold tracking-tight text-amber-300 sm:text-xl">{t.promoBanner.title}</p>
          <p className="mt-1 text-sm text-white/85">
            {fmt(t.promoBanner.text, { code: promo.code, date: until, field: t.checkout.promo })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="rounded-lg border-2 border-dashed border-amber-300 px-3 py-1.5 font-mono text-lg font-bold tracking-widest text-amber-300">
            {promo.code}
          </span>
          <a
            href="#search"
            className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            {t.promoBanner.cta}
          </a>
        </div>
      </div>
    </section>
  );
}
