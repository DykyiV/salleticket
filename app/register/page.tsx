import type { Metadata } from "next";
import AuthPage from "@/components/auth/AuthPage";
import { getDict } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: `${t.auth.metaRegister} — Asol BUS`, robots: { index: false } };
}

export default async function RegisterPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await props.searchParams;
  return <AuthPage mode="register" next={sp.next} />;
}
