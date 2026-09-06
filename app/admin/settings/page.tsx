import Link from "next/link";
import Header from "@/components/Header";
import RefundPolicyForm from "@/components/admin/RefundPolicyForm";
import { prisma } from "@/lib/db";
import { getRefundPolicy } from "@/lib/refundPolicy";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const policy = await getRefundPolicy(prisma);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
                ADMIN
              </span>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                Налаштування
              </h1>
            </div>
            <Link
              href="/admin"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              Назад в адмінку
            </Link>
          </div>

          <div className="mt-6">
            <RefundPolicyForm
              initialCashPercent={policy.cashRefundPercent}
              initialOnlinePercent={policy.onlineRefundPercent}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
