"use client";

/** Couche flottante : chaque fenetre charge un module de l'application. */
import * as React from "react";
import { AppWindow, Maximize2, Minimize2, Minus, X } from "lucide-react";
import { cn } from "@/components/ui/primitives";
import {
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  useWorkspace,
  type WorkspaceWindowState,
} from "@/components/windows/workspace";
import { WindowTaskbar } from "@/components/windows/window-taskbar";

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export function WindowLayer() {
  const { windows } = useWorkspace();
  if (windows.length === 0) return null;

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[60]">
        {windows.map((window) => (
          <WindowFrame key={window.id} win={window} />
        ))}
      </div>
      <WindowTaskbar />
    </>
  );
}

function WindowFrame({ win }: { win: WorkspaceWindowState }) {
  const { focusWindow, closeWindow, minimizeWindow, toggleMaximize, updateWindow } = useWorkspace();
  const [interacting, setInteracting] = React.useState(false);

  const src = React.useMemo(
    () => `${win.href}${win.href.includes("?") ? "&" : "?"}embed=1`,
    [win.href],
  );

  function beginDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (win.maximized) return;
    if ((event.target as HTMLElement).closest("[data-window-control]")) return;
    event.preventDefault();
    focusWindow(win.id);

    const element = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    const baseX = win.x;
    const baseY = win.y;
    element.setPointerCapture(event.pointerId);
    setInteracting(true);

    const move = (moveEvent: PointerEvent) => {
      const vp = { width: window.innerWidth, height: window.innerHeight };
      updateWindow(win.id, {
        x: Math.min(Math.max(0, baseX + moveEvent.clientX - startX), Math.max(0, vp.width - 160)),
        y: Math.min(Math.max(0, baseY + moveEvent.clientY - startY), Math.max(0, vp.height - 48)),
      });
    };
    const stop = () => {
      setInteracting(false);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", stop);
      element.removeEventListener("pointercancel", stop);
    };
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", stop);
    element.addEventListener("pointercancel", stop);
  }

  function beginResize(event: React.PointerEvent<HTMLDivElement>, direction: ResizeDirection) {
    event.preventDefault();
    event.stopPropagation();
    focusWindow(win.id);

    const element = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    const base = { x: win.x, y: win.y, width: win.width, height: win.height };
    element.setPointerCapture(event.pointerId);
    setInteracting(true);

    const move = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const vp = { width: window.innerWidth, height: window.innerHeight };
      const patch: Partial<WorkspaceWindowState> = {};

      // Bord droit : la largeur ne depasse jamais le bord de l'ecran.
      if (direction.includes("e")) {
        patch.width = Math.min(
          Math.max(MIN_WINDOW_WIDTH, base.width + dx),
          Math.max(MIN_WINDOW_WIDTH, vp.width - base.x),
        );
      }
      // Bord bas : la hauteur ne depasse jamais le bas de l'ecran.
      if (direction.includes("s")) {
        patch.height = Math.min(
          Math.max(MIN_WINDOW_HEIGHT, base.height + dy),
          Math.max(MIN_WINDOW_HEIGHT, vp.height - base.y),
        );
      }
      // Bord gauche : on deplace x en meme temps que la largeur.
      if (direction.includes("w")) {
        const width = Math.min(
          Math.max(MIN_WINDOW_WIDTH, base.width - dx),
          Math.max(MIN_WINDOW_WIDTH, base.x + base.width),
        );
        patch.width = width;
        patch.x = Math.max(0, base.x + base.width - width);
      }
      // Bord haut : on deplace y en meme temps que la hauteur.
      if (direction.includes("n")) {
        const height = Math.min(
          Math.max(MIN_WINDOW_HEIGHT, base.height - dy),
          Math.max(MIN_WINDOW_HEIGHT, base.y + base.height),
        );
        patch.height = height;
        patch.y = Math.max(0, base.y + base.height - height);
      }
      updateWindow(win.id, patch);
    };
    const stop = () => {
      setInteracting(false);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", stop);
      element.removeEventListener("pointercancel", stop);
    };
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", stop);
    element.addEventListener("pointercancel", stop);
  }

  return (
    <div
      className={cn(
        "pointer-events-auto absolute flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl",
        win.minimized && "hidden",
      )}
      style={
        win.maximized
          ? { inset: 0, zIndex: win.z }
          : {
              left: win.x,
              top: win.y,
              width: win.width,
              height: win.height,
              zIndex: win.z,
            }
      }
      onPointerDown={() => focusWindow(win.id)}
    >
      <div
        onPointerDown={beginDrag}
        onDoubleClick={() => toggleMaximize(win.id)}
        className="flex h-10 shrink-0 cursor-move select-none items-center gap-2 border-b border-border bg-surface/90 px-3"
      >
        <AppWindow className="h-3.5 w-3.5 shrink-0 text-primary-300" />
        <span className="truncate text-xs font-medium text-fg">{win.label}</span>
        <div className="ml-auto flex items-center gap-0.5" data-window-control>
          <button
            onClick={() => minimizeWindow(win.id)}
            className="rounded p-1 text-muted transition-colors hover:bg-white/10 hover:text-fg"
            aria-label="Reduire la fenetre"
            title="Reduire"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => toggleMaximize(win.id)}
            className="rounded p-1 text-muted transition-colors hover:bg-white/10 hover:text-fg"
            aria-label={win.maximized ? "Restaurer la fenetre" : "Agrandir la fenetre"}
            title={win.maximized ? "Restaurer" : "Agrandir"}
          >
            {win.maximized ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => closeWindow(win.id)}
            className="rounded p-1 text-muted transition-colors hover:bg-danger/20 hover:text-danger"
            aria-label="Fermer la fenetre"
            title="Fermer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-bg">
        <iframe
          title={win.label}
          src={src}
          className={cn("h-full w-full border-0", interacting && "pointer-events-none")}
        />
      </div>

      {!win.maximized ? (
        <>
          <div
            onPointerDown={(event) => beginResize(event, "n")}
            className="absolute left-3 right-3 top-0 h-1.5 cursor-ns-resize"
          />
          <div
            onPointerDown={(event) => beginResize(event, "s")}
            className="absolute bottom-0 left-3 right-3 h-1.5 cursor-ns-resize"
          />
          <div
            onPointerDown={(event) => beginResize(event, "w")}
            className="absolute bottom-3 left-0 top-3 w-1.5 cursor-ew-resize"
          />
          <div
            onPointerDown={(event) => beginResize(event, "e")}
            className="absolute bottom-3 right-0 top-3 w-1.5 cursor-ew-resize"
          />
          <div
            onPointerDown={(event) => beginResize(event, "nw")}
            className="absolute left-0 top-0 h-4 w-4 cursor-nwse-resize"
          />
          <div
            onPointerDown={(event) => beginResize(event, "ne")}
            className="absolute right-0 top-0 h-4 w-4 cursor-nesw-resize"
          />
          <div
            onPointerDown={(event) => beginResize(event, "se")}
            className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
          />
          <div
            onPointerDown={(event) => beginResize(event, "sw")}
            className="absolute bottom-0 left-0 h-4 w-4 cursor-nesw-resize"
          />
        </>
      ) : null}
    </div>
  );
}
