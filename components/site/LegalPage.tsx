import Link from "next/link";
import type { ReactNode } from "react";
import Header from "@/components/Header";
import SiteFooter from "@/components/site/SiteFooter";
import type { Dict } from "@/lib/i18n/dict";
import type { LegalDoc } from "@/lib/legal/texts";
import { telHref } from "@/lib/siteContacts";

const TOKEN = /(https?:\/\/[^\s,;)]+[^\s,;).]|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\+\d[\d ]{6,}\d)/g;

/** Plain text with web addresses, e-mails and phone numbers made clickable. */
function linkify(text: string): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    if (i % 2 === 0) return part;
    const cls = "text-brand-700 underline underline-offset-2 hover:text-brand-800 break-words";
    if (part.startsWith("http")) {
      const own = part.startsWith("https://kaufmann-reisen.de/");
      return own ? (
        <Link key={i} href={part.slice("https://kaufmann-reisen.de".length)} className={cls}>
          {part}
        </Link>
      ) : (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={cls}>
          {part}
        </a>
      );
    }
    if (part.startsWith("+")) {
      return (
        <a key={i} href={telHref(part)} className={cls}>
          {part}
        </a>
      );
    }
    return (
      <a key={i} href={`mailto:${part}`} className={cls}>
        {part}
      </a>
    );
  });
}

/** Impressum and privacy policy: a plain document with the site chrome. */
export default function LegalPage({ t, doc }: { t: Dict; doc: LegalDoc }) {
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
              <span className="text-white">{doc.title}</span>
            </nav>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{doc.title}</h1>
            <p className="mt-2 max-w-3xl text-base text-blue-100/90">{doc.intro}</p>
          </div>
        </div>
        <article className="container-site max-w-4xl space-y-8 py-10">
          {doc.note ? <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-ink ring-1 ring-brand-100">{doc.note}</p> : null}
          {doc.sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`}>
              <h2 id={`${s.id}-title`} className="text-xl font-semibold text-navy">
                {s.title}
              </h2>
              <div className="mt-3 space-y-2 text-base leading-relaxed text-ink">
                {s.paragraphs.map((p, i) => (
                  <p key={i}>{linkify(p)}</p>
                ))}
              </div>
            </section>
          ))}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
