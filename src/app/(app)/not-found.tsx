import Link from "next/link";
import { Compass } from "lucide-react";

export default function AppNotFound() {
  return (
    <div className="flex min-h-[55vh] items-center justify-center py-10">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card/80 p-8 text-center shadow-panel">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-primary-500/25 bg-primary-500/10 text-primary-300">
          <Compass className="h-5 w-5" />
        </div>
        <p className="mono mt-4 text-[10px] uppercase tracking-[0.2em] text-primary-300">Erreur 404</p>
        <h1 className="mt-1.5 text-lg font-semibold tracking-tight">Page introuvable</h1>
        <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted">
          Cette section n&apos;existe pas ou n&apos;est plus disponible.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex h-9 items-center rounded-lg bg-primary-500 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-600"
        >
          Retour au dashboard
        </Link>
      </div>
    </div>
  );
}
