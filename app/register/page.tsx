import Header from "@/components/Header";
import AuthForm from "@/components/AuthForm";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-12">
        <AuthForm mode="register" />
      </main>
    </div>
  );
}
