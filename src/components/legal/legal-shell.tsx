import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Mail, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { LEGAL_INFO } from "@/lib/legal";

type LegalShellProps = {
  title: string;
  subtitle: string;
  current: "mentions" | "confidentialite";
  children: ReactNode;
};

export function LegalShell({ title, subtitle, current, children }: LegalShellProps) {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-border/70 bg-surface/40">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-5 sm:px-8 md:flex-row md:items-center md:justify-between">
          <Link href="/presentation" className="flex items-center gap-3">
            <Image
              src="/brand/fivem-devmgr-logo-3d.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-lg object-contain"
            />
            <span>
              <span className="block text-sm font-semibold">FiveM DevManager</span>
              <span className="block text-[10px] text-muted">BL-Host · informations légales</span>
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <Link
              href="/mentions-legales"
              className={current === "mentions" ? "font-medium text-fg" : "text-muted transition hover:text-fg"}
            >
              Mentions légales
            </Link>
            <Link
              href="/confidentialite"
              className={current === "confidentialite" ? "font-medium text-fg" : "text-muted transition hover:text-fg"}
            >
              Confidentialité
            </Link>
            <Link href="/presentation" className="inline-flex items-center gap-1.5 text-primary-300 transition hover:text-primary-200">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Retour à la présentation
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-300">
            {LEGAL_INFO.brand} · {LEGAL_INFO.version}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-4 text-sm leading-7 text-muted">{subtitle}</p>
          <p className="mt-3 text-[11px] text-muted">Dernière mise à jour : {LEGAL_INFO.updatedAt}</p>
        </div>

        {LEGAL_INFO.draft ? (
          <div
            role="note"
            className="mt-8 flex gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4 text-xs leading-6 text-amber-100/90"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
            <p>
              <strong className="font-semibold text-amber-200">Version préparatoire, non publiable en l’état.</strong>{" "}
              BL-Host est un nom commercial sans entité juridique. L’identité de l’éditeur, son adresse de
              publication et son téléphone doivent être ajoutés avant toute mise en ligne. Les pages sont
              volontairement en <code className="rounded bg-black/20 px-1">noindex</code> et ne sont pas
              référencées dans le sitemap.
            </p>
          </div>
        ) : null}

        <div className="mt-10 space-y-6">{children}</div>

        <div className="mt-10 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/60 p-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>Une question sur ces informations ?</span>
          <a
            href={`mailto:${LEGAL_INFO.contactEmail}?subject=${encodeURIComponent("Informations légales FiveM DevManager")}`}
            className="inline-flex items-center gap-2 font-medium text-primary-300 transition hover:text-primary-200"
          >
            <Mail className="h-3.5 w-3.5" aria-hidden />
            {LEGAL_INFO.contactEmail}
          </a>
        </div>
      </main>

      <footer className="border-t border-border/70 py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 text-[11px] text-muted sm:px-8 md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} BL-Host · FiveM DevManager</span>
          <span>
            Projet indépendant, non affilié à Cfx.re, Rockstar Games ou Take-Two Interactive.
          </span>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card/60 p-6 sm:p-8">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-muted">{children}</div>
    </section>
  );
}

export function LegalField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border/50 py-2.5 last:border-0 sm:grid-cols-[220px_1fr] sm:gap-4">
      <dt className="text-xs font-medium text-fg/80">{label}</dt>
      <dd className="text-sm text-muted">{children}</dd>
    </div>
  );
}

export function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-medium text-primary-300 underline-offset-4 transition hover:text-primary-200 hover:underline"
    >
      {children}
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}
