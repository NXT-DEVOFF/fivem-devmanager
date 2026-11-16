import Link from "next/link";
import { Compass, LayoutDashboard } from "lucide-react";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
      <div className="pointer-events-none absolute inset-0 subtle-grid opacity-20" />
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card/80 p-8 text-center shadow-pop backdrop-blur-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-primary-500/25 bg-primary-500/10 text-primary-300">
          <Compass className="h-6 w-6" />
        </div>
        <p className="mono mt-5 text-[11px] uppercase tracking-[0.2em] text-primary-300">Erreur 404</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Cette page n&apos;existe pas</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          Le lien est peut-etre obsolete, ou la page a ete deplacee. Revenez au cockpit pour
          retrouver vos outils.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary-500 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-600"
          >
            <LayoutDashboard className="h-4 w-4" /> Retour au dashboard
          </Link>
          <Link
            href="/docs"
            className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm text-muted transition-colors hover:border-border-strong hover:text-fg"
          >
            Consulter la documentation
          </Link>
        </div>
      </div>
    </main>
  );
}
