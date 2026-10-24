import Link from "next/link";
import Icon, { type IconName } from "@/components/site/Icon";
import { getDict } from "@/lib/i18n/server";
import {
  getSiteContacts,
  telHref,
  telegramHref,
  viberHref,
  webHref,
  whatsappHref,
} from "@/lib/siteContacts";

/** Site footer: contacts (from Settings), messengers, documents. */
export default async function SiteFooter() {
  const [{ t }, c] = await Promise.all([getDict(), getSiteContacts()]);
  const phones = [
    { label: t.footer.phoneUa, value: c.phoneUa },
    { label: t.footer.phoneEs, value: c.phoneEs },
    { label: t.footer.phoneDe, value: c.phoneDe },
  ].filter((p) => p.value);
  const socials: { name: string; icon: IconName; href: string }[] = [
    c.facebook && { name: "Facebook", icon: "facebook" as const, href: webHref(c.facebook) },
    c.instagram && { name: "Instagram", icon: "instagram" as const, href: webHref(c.instagram) },
    c.telegram && { name: "Telegram", icon: "telegram" as const, href: telegramHref(c.telegram) },
    c.viber && { name: "Viber", icon: "chat" as const, href: viberHref(c.viber) },
    c.whatsapp && { name: "WhatsApp", icon: "phone" as const, href: whatsappHref(c.whatsapp) },
  ].filter(Boolean) as { name: string; icon: IconName; href: string }[];
  const docs = [
    { href: "/rules", label: t.footer.terms },
    { href: "/baggage", label: t.footer.baggage },
    { href: "/rules#rights", label: t.footer.rights },
    { href: "/rules#offer", label: t.footer.offer },
    { href: "/rules#privacy", label: t.footer.privacy },
  ];

  return (
    <footer id="support" className="bg-navy text-slate-300">
      <div className="container-site grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <p className="flex items-center gap-2 text-lg font-bold text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
              <Icon name="bus" className="h-5 w-5" />
            </span>
            Asol<span className="-ml-1 text-brand-400"> BUS</span>
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-400">{t.footer.about}</p>
          {socials.length ? (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t.footer.follow}</p>
              <ul className="mt-3 flex gap-2">
                {socials.map((s) => (
                  <li key={s.name}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.name}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-200 ring-1 ring-white/10 transition hover:bg-white/10"
                    >
                      <Icon name={s.icon} className="h-5 w-5" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t.footer.contacts}</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {phones.map((p) => (
              <li key={p.label}>
                <span className="block text-xs text-slate-500">{p.label}</span>
                <a href={telHref(p.value)} className="inline-flex items-center gap-2 font-semibold text-white hover:text-brand-300">
                  <Icon name="phone" className="h-4 w-4 text-slate-400" />
                  {p.value}
                </a>
              </li>
            ))}
            {c.email ? (
              <li>
                <a href={`mailto:${c.email}`} className="inline-flex items-center gap-2 hover:text-white">
                  <Icon name="mail" className="h-4 w-4 text-slate-400" />
                  {c.email}
                </a>
              </li>
            ) : null}
            {c.website ? (
              <li>
                <a href={webHref(c.website)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-white">
                  <Icon name="globe" className="h-4 w-4 text-slate-400" />
                  {c.website.replace(/^https?:\/\//, "")}
                </a>
              </li>
            ) : null}
            {c.address ? (
              <li className="flex gap-2">
                <Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span>{c.address}</span>
              </li>
            ) : null}
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t.footer.documents}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {docs.map((d) => (
              <li key={d.href}>
                <Link href={d.href} className="hover:text-white">
                  {d.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="container-site py-5 text-xs text-slate-500">
          © {new Date().getFullYear()} Asol BUS · ТзОВ «Грандес Тур». {t.footer.rightsReserved}
        </p>
      </div>
    </footer>
  );
}
