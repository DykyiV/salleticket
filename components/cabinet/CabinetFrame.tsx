"use client";

import { useState } from "react";
import Sidebar, { type CabinetUser } from "@/components/cabinet/Sidebar";

export default function CabinetFrame({
  user,
  children,
}: {
  user: CabinetUser;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar user={user} mobileOpen={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700"
            onClick={() => setOpen(true)}
          >
            Меню
          </button>
          <span className="text-sm font-semibold text-slate-900">Asol BUS</span>
        </header>
        <main className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
