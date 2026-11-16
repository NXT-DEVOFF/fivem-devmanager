"use client";

/**
 * Barre des taches : rend les fenetres reduites retrouvables et permet de
 * passer d'un module a l'autre sans rouvrir une fenetre.
 */
import * as React from "react";
import { AppWindow, X } from "lucide-react";
import { cn } from "@/components/ui/primitives";
import { useWorkspace } from "@/components/windows/workspace";

export function WindowTaskbar() {
  const { windows, focusWindow, closeWindow } = useWorkspace();
  if (windows.length === 0) return null;

  const topZ = Math.max(...windows.map((win) => (win.minimized ? 0 : win.z)), 0);

  return (
    <div className="pointer-events-auto fixed bottom-3 left-1/2 z-[65] flex max-w-[calc(100vw-16px)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-xl border border-border bg-card/95 px-2 py-1.5 shadow-2xl backdrop-blur scrollbar-thin">
      <span className="hidden shrink-0 items-center gap-1 px-1 text-[10px] uppercase tracking-wide text-muted sm:flex">
        <AppWindow className="h-3 w-3" /> {windows.length}
      </span>
      {windows.map((win) => {
        const active = !win.minimized && win.z === topZ;
        return (
          <div
            key={win.id}
            className={cn(
              "flex shrink-0 items-center rounded-md border transition-colors",
              active
                ? "border-primary-500/40 bg-primary-500/15"
                : win.minimized
                  ? "border-border bg-surface/40"
                  : "border-border bg-surface/70",
            )}
          >
            <button
              onClick={() => focusWindow(win.id)}
              className={cn(
                "max-w-[160px] truncate px-2 py-1 text-[11px] transition-colors hover:text-fg",
                active ? "text-fg" : "text-muted",
              )}
              title={win.minimized ? `Restaurer ${win.label}` : `Afficher ${win.label}`}
            >
              {win.label}
            </button>
            <button
              onClick={() => closeWindow(win.id)}
              className="rounded-r-md px-1 py-1 text-muted transition-colors hover:bg-danger/20 hover:text-danger"
              aria-label={`Fermer ${win.label}`}
              title="Fermer"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
