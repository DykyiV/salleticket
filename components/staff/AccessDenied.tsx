import Link from "next/link";
import Header from "@/components/Header";

export default function AccessDenied({ what }: { what: string }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-sm font-semibold text-amber-800">Доступ обмежено</p>
          <p className="mt-2 text-sm text-amber-700">
            У вас немає дозволу на {what}. Зверніться до адміністратора, щоб
            надати доступ на сторінці "Агенти" в адмінці.
          </p>
          <Link
            href="/agent"
            className="mt-4 inline-flex rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
          >
            Назад до кабінету
          </Link>
        </div>
      </main>
    </div>
  );
}
