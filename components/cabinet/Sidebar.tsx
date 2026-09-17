"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import LogoutButton from "@/components/LogoutButton";
import NavIcon from "@/components/cabinet/NavIcon";
import { isNavActive, navForRole } from "@/lib/nav";

export type CabinetUser = {
  id: string;
  email: string;
  role: Role;
  displayName?: string | null;
  avatarUrl?: string | null;
};

type Props = {
  user: CabinetUser;
  mobileOpen: boolean;
  onClose: () => void;
};

export default function Sidebar({ user, mobileOpen, onClose }: Props) {
  const pathname = usePathname() ?? "/cabinet";
  const items = navForRole(user.role);
  const name = user.displayName?.trim() || user.email.split("@")[0];
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Закрити меню"
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <Link
          href="/"
          className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"
          onClick={onClose}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">
            A
          </span>
          <span className="text-lg font-semibold tracking-tight text-slate-900">
            Asol<span className="text-brand-600"> BUS</span>
          </span>
        </Link>

        <div className="flex items-center gap-3 px-5 py-4">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="h-11 w-11 rounded-full object-cover ring-1 ring-slate-200"
            />
          ) : (
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700 ring-1 ring-brand-100">
              {initial}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {items.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <LogoutButton className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700" />
        </div>
      </aside>
    </>
  );
}
