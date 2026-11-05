import type { Metadata } from "next";
import Header from "@/components/Header";
import SiteFooter from "@/components/site/SiteFooter";
import { ForgotPasswordForm } from "@/components/auth/PasswordResetForms";
import { getDict } from "@/lib/i18n/server";
import { getSiteContacts } from "@/lib/siteContacts";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: `${t.auth.forgotTitle} — Kaufmann Reisen`, robots: { index: false } };
}

export default async function ForgotPasswordPage() {
  const contacts = await getSiteContacts().catch(() => null);
  const phone = contacts?.phoneUa || contacts?.phoneEs || contacts?.phoneDe || null;
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center bg-slate-50">
        <div className="container-site max-w-md py-8 sm:py-12">
          <ForgotPasswordForm supportPhone={phone} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
