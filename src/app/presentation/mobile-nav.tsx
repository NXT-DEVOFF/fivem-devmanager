"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
};

export function MobileNav({
  items,
  salesHref,
}: {
  items: ReadonlyArray<NavItem>;
  salesHref: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const onDesktop = () => {
      if (desktopQuery.matches) setOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    desktopQuery.addEventListener("change", onDesktop);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      desktopQuery.removeEventListener("change", onDesktop);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={open}
        aria-controls="mobile-navigation"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-fg transition-colors hover:bg-white/5"
      >
        {open ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
            className="fixed inset-x-0 top-16 z-40 h-[calc(100dvh-4rem)] cursor-default bg-black/60 backdrop-blur-sm"
          />
          <div
            id="mobile-navigation"
            className="fixed inset-x-0 top-16 z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-white/10 bg-bg px-5 pb-6 pt-4 shadow-2xl sm:px-8"
          >
            <nav aria-label="Navigation mobile" className="flex flex-col">
              {items.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center justify-between border-b border-white/[0.06] py-3 text-sm text-muted transition-colors hover:text-fg"
                >
                  {item.label}
                  <ArrowRight className="h-3.5 w-3.5 text-white/25" aria-hidden />
                </a>
              ))}
            </nav>

            <div className="mt-5 grid gap-2">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border-strong bg-white/[0.03] px-4 text-sm font-medium text-fg transition-colors hover:bg-white/[0.06]"
              >
                Connexion
              </Link>
              <a
                href={salesHref}
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-primary-400 to-primary-600 px-4 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_10px_24px_-12px_rgba(88,101,242,0.9)] transition hover:from-primary-400 hover:to-primary-500"
              >
                Demander une démo
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
