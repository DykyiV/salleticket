"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/site/Icon";
import LangSwitcher from "@/components/site/LangSwitcher";
import LogoutButton from "@/components/LogoutButton";
import { useI18n } from "@/lib/i18n/client";
import type { SiteNavItem } from "@/components/site/nav";

/** Burger + slide-over panel for phones and tablets. */
export default function MobileMenu({ nav, signedIn }: { nav: SiteNavItem[]; signedIn: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        aria-label={t.common.menu}
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-navy transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 lg:hidden"
      >
        <Icon name="menu" className="h-6 w-6" />
      </button>

      {/* Portal: the sticky header uses backdrop-filter, which would trap a
          fixed-position panel inside the header box. */}
      {open ? createPortal(
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t.common.menu}>
          <button
            type="button"
            aria-label={t.common.close}
            tabIndex={-1}
            className="absolute inset-0 bg-navy/50 backdrop-blur-sm"
            onClick={close}
          />
          <div
            id="site-menu"
            className="absolute inset-y-0 right-0 flex w-[min(22rem,88vw)] flex-col bg-white shadow-lift"
          >
            <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
              <LangSwitcher />
              <button
                ref={closeRef}
                type="button"
                aria-label={t.common.close}
                onClick={close}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-navy hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <Icon name="close" className="h-6 w-6" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-3">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  className="flex items-center justify-between rounded-xl px-3 py-3.5 text-base font-medium text-navy hover:bg-slate-50"
                >
                  {item.label}
                  <Icon name="chevronRight" className="h-5 w-5 text-slate-400" />
                </Link>
              ))}
            </nav>
            <div className="space-y-2 border-t border-slate-100 p-4">
              <Link href="/#search" onClick={close} className="btn-primary w-full">
                <Icon name="ticket" />
                {t.common.buyTicket}
              </Link>
              <Link href="/tickets" onClick={close} className="btn-secondary w-full">
                {t.common.myTickets}
              </Link>
              {signedIn ? (
                <div className="flex gap-2">
                  <Link href="/cabinet" onClick={close} className="btn-secondary flex-1 py-2.5 text-sm">
                    {t.common.cabinet}
                  </Link>
                  <LogoutButton label={t.common.signOut} className="btn-secondary flex-1 py-2.5 text-sm" />
                </div>
              ) : (
                <Link href="/login" onClick={close} className="block py-2 text-center text-sm font-semibold text-brand-700">
                  {t.common.signIn}
                </Link>
              )}
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}
