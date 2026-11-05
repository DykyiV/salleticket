import type { Metadata } from "next";
import Header from "@/components/Header";
import SiteFooter from "@/components/site/SiteFooter";
import { ResetPasswordForm } from "@/components/auth/PasswordResetForms";
import { getDict } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: `${t.auth.resetTitle} — Kaufmann Reisen`, robots: { index: false } };
}

export default async function ResetPasswordPage(props: { searchParams: Promise<{ token?: string | string[] }> }) {
  const sp = await props.searchParams;
  const token = (Array.isArray(sp.token) ? sp.token[0] : sp.token) ?? "";
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center bg-slate-50">
        <div className="container-site max-w-md py-8 sm:py-12">
          <ResetPasswordForm token={token} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
