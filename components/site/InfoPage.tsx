import Link from "next/link";
import Header from "@/components/Header";
import SiteFooter from "@/components/site/SiteFooter";
import Icon from "@/components/site/Icon";
import type { Dict } from "@/lib/i18n/dict";
import { getSiteContacts, telHref } from "@/lib/siteContacts";

export type InfoSection = { id: string; title: string; body: readonly string[] };

/** Text page (baggage, conditions of carriage) with the site chrome. */
export default async function InfoPage({
  t,
  title,
  intro,
  sections,
}: {
  t: Dict;
  title: string;
  intro: string;
  sections: InfoSection[];
}) {
  const contacts = await getSiteContacts();
  const phone = contacts.phoneUa || contacts.phoneEs || contacts.phoneDe;
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="bg-navy">
          <div className="container-site py-10 sm:py-14">
            <nav aria-label="breadcrumb" className="text-sm text-blue-200">
              <Link href="/" className="hover:text-white">
                {t.common.home}
              </Link>
              <span aria-hidden="true"> / </span>
              <span className="text-white">{title}</span>
            </nav>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-base text-blue-100/90">{intro}</p>
          </div>
        </div>
        <div className="container-site grid gap-6 py-10 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            {sections.map((section) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-200/70 sm:p-6">
                <h2 id={`${section.id}-title`} className="text-xl font-semibold text-navy">
                  {section.title}
                </h2>
                <ul className="mt-4 space-y-3">
                  {section.body.map((line) => (
                    <li key={line} className="flex gap-3 text-base leading-relaxed text-ink">
                      <Icon name="check" className="mt-1 h-4 w-4 shrink-0 text-ok" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {phone ? (
            <aside className="h-fit rounded-2xl bg-brand-50 p-5 ring-1 ring-brand-100 lg:sticky lg:top-24">
              <h2 className="text-lg font-semibold text-navy">{t.pages.questions}</h2>
              <p className="mt-1 text-sm text-ink-muted">{t.pages.callUs}</p>
              <a href={telHref(phone)} className="btn-primary mt-4 w-full">
                <Icon name="phone" className="h-4 w-4" />
                {phone}
              </a>
            </aside>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
