import PageHeader from "@/components/cabinet/PageHeader";
import ProfileForm from "@/components/cabinet/ProfileForm";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function MyCabinetPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Мій кабінет"
        subtitle="Логін, пароль і аватар. Бонуси, дисконтна картка та акції зʼявляться тут пізніше."
      />

      <section className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="text-base font-semibold text-slate-900">Персональні налаштування</h2>
        <div className="mt-4">
          <ProfileForm
            email={user.email}
            displayName={user.displayName ?? ""}
            avatarUrl={user.avatarUrl}
          />
        </div>
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ComingSoon
          title="Бонуси"
          text="Баланс бонусів за поїздки зʼявиться в цьому блоці."
        />
        <ComingSoon
          title="Дисконтна картка"
          text="Номер картки та рівень знижки — у наступному етапі."
        />
        <ComingSoon
          title="Акції"
          text="Тут будуть акції, в яких ви берете участь."
        />
      </div>
    </div>
  );
}

function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{text}</p>
    </section>
  );
}
