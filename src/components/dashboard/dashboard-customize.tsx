"use client";

import * as React from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/primitives";

const STORAGE_KEY = "fdm.dashboard.hidden.v1";
const EVENT_NAME = "fdm:dashboard-changed";

const WIDGETS = [
  { id: "stats", label: "Indicateurs cles" },
  { id: "pulse", label: "Pouls de l'equipe" },
  { id: "server", label: "Etat du serveur" },
  { id: "priorities", label: "Priorites" },
  { id: "sprint", label: "Sprint actif" },
  { id: "ops", label: "Sante et alertes" },
  { id: "incidents", label: "Incidents" },
  { id: "team", label: "Equipe" },
  { id: "activity", label: "Activite en direct" },
] as const;

function readHidden(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

/** Applique la visibilite aux sections marquees data-dashboard-widget. */
function applyHidden(ids: string[]): void {
  if (typeof document === "undefined") return;
  document.querySelectorAll<HTMLElement>("[data-dashboard-widget]").forEach((node) => {
    node.style.display = ids.includes(node.dataset.dashboardWidget ?? "") ? "none" : "";
  });
}

function persist(ids: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Stockage indisponible (navigation privee) : la personnalisation reste en memoire.
  }
  applyHidden(ids);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: ids }));
}

/**
 * Personnalisation du dashboard : masque/affiche les widgets.
 * Preferences locales a l'appareil, appliquees sans rechargement.
 */
export function DashboardCustomizeMenu() {
  const [open, setOpen] = React.useState(false);
  const [hidden, setHidden] = React.useState<string[]>([]);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const sync = () => {
      const ids = readHidden();
      setHidden(ids);
      applyHidden(ids);
    };
    sync();
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle(id: string) {
    const next = hidden.includes(id) ? hidden.filter((value) => value !== id) : [...hidden, id];
    setHidden(next);
    persist(next);
  }

  function reset() {
    setHidden([]);
    persist([]);
  }

  return (
    <div className="relative" ref={containerRef}>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" /> Personnaliser
      </Button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-card p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-medium">Widgets du dashboard</p>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 text-[10px] text-primary-300 hover:underline"
            >
              <RotateCcw className="h-3 w-3" /> Tout afficher
            </button>
          </div>
          <ul className="max-h-72 space-y-0.5 overflow-y-auto">
            {WIDGETS.map((widget) => {
              const visible = !hidden.includes(widget.id);
              return (
                <li key={widget.id}>
                  <button
                    type="button"
                    onClick={() => toggle(widget.id)}
                    aria-pressed={visible}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[11px] transition-colors hover:bg-white/5"
                  >
                    <span className={visible ? "text-fg" : "text-muted line-through"}>{widget.label}</span>
                    <span className={visible ? "text-[10px] text-success" : "text-[10px] text-muted"}>
                      {visible ? "Visible" : "Masque"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 border-t border-border pt-2 text-[10px] text-muted">
            Preferences enregistrees sur cet appareil.
          </p>
        </div>
      ) : null}
    </div>
  );
}
