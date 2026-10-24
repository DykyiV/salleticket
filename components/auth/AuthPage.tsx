import Image from "next/image";
import Header from "@/components/Header";
import SiteFooter from "@/components/site/SiteFooter";
import Icon from "@/components/site/Icon";
import AuthForm from "@/components/AuthForm";
import { getDict } from "@/lib/i18n/server";
import { safeNextPath } from "@/lib/security/redirect";
import { getSiteContacts } from "@/lib/siteContacts";

/** Sign-in and registration: the form and, on wide screens, what the cabinet gives. */
export default async function AuthPage({ mode, next }: { mode: "login" | "register"; next?: string | string[] }) {
  const [{ t }, contacts] = await Promise.all([getDict(), getSiteContacts().catch(() => null)]);
  const a = t.auth;
  const safeNext = safeNextPath(Array.isArray(next) ? next[0] : next);
  const phone = contacts?.phoneUa || contacts?.phoneEs || contacts?.phoneDe || null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center bg-slate-50">
        <div className="container-site grid max-w-5xl items-stretch gap-6 py-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="mx-auto w-full max-w-md lg:max-w-none">
            <AuthForm mode={mode} next={safeNext} supportPhone={phone} />
          </div>
          <aside className="relative hidden overflow-hidden rounded-2xl bg-navy p-8 text-white lg:flex lg:flex-col">
            <h2 className="text-xl font-bold">{a.perksTitle}</h2>
            <ul className="mt-5 space-y-3">
              {a.perks.map((perk) => (
                <li key={perk} className="flex gap-3 text-blue-100">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ok text-white">
                    <Icon name="check" className="h-4 w-4" />
                  </span>
                  {perk}
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-8">
              <Image
                src="/grandes-tour-bus.webp"
                alt={t.hero.busAlt}
                width={1778}
                height={830}
                sizes="440px"
                className="h-auto w-full drop-shadow-[0_24px_30px_rgba(0,0,0,0.45)]"
              />
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
