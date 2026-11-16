"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";

/**
 * Ecran d'erreur commun aux pages protegees.
 * Le detail technique reste dans la console serveur/navigateur : l'utilisateur
 * recoit un message actionnable et un bouton de reprise.
 */
export function ErrorPanel({
  error,
  reset,
  title = "Cette page n'a pas pu etre chargee",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}) {
  React.useEffect(() => {
    console.error("[ui] erreur non geree", error);
  }, [error]);

  return (
    <div className="flex min-h-[55vh] items-center justify-center py-10">
      <Card className="w-full max-w-lg overflow-hidden">
        <div className="border-b border-border bg-danger/[0.06] px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-danger/25 bg-danger/10 text-danger">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-sm font-semibold text-fg">{title}</h1>
              <p className="mt-0.5 text-xs text-muted">
                Une erreur inattendue a interrompu le rendu. Vos donnees n&apos;ont pas ete modifiees.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-4 px-6 py-5">
          <p className="rounded-lg border border-border bg-surface px-3 py-2 text-[11px] leading-relaxed text-muted">
            Reessayez dans quelques secondes. Si le probleme persiste, consultez le diagnostic ou
            transmettez l&apos;identifiant ci-dessous a un administrateur.
          </p>
          {error.digest ? (
            <p className="mono text-[10px] text-muted/70">Reference : {error.digest}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={reset}>
              <RefreshCw className="h-3.5 w-3.5" /> Reessayer
            </Button>
            <a
              href="/diagnostics"
              className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm text-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              Ouvrir le diagnostic
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
