"use client";

/** Bouton d'en-tete : ouvre n'importe quel module dans une fenetre flottante. */
import * as React from "react";
import { AppWindow, ChevronDown } from "lucide-react";
import { NAV_SECTIONS } from "@/lib/nav";
import { cn } from "@/components/ui/primitives";
import { useWorkspace } from "@/components/windows/workspace";
import type { Permission } from "@/server/permissions";

export function WindowLauncher({ permissions }: { permissions: Permission[] }) {
  const { openWindow, windows, minimizeAll, closeAll } = useWorkspace();
  const [open, setOpen] = React.useState(false);
  const container = React.useRef<HTMLDivElement>(null);

  const sections = React.useMemo(() => {
    const allowed = new Set(permissions);
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.permission || allowed.has(item.permission)),
    })).filter((section) => section.items.length > 0);
  }, [permissions]);

  React.useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="relative hidden sm:block" ref={container}>
      <button
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs text-muted transition-colors hover:border-border-strong hover:text-fg",
          open && "border-border-strong text-fg",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <AppWindow className="h-3.5 w-3.5" />
        Fenetres
        {windows.length > 0 ? (
          <span className="rounded bg-primary-500/20 px-1.5 py-0.5 text-[10px] font-medium text-primary-200">
            {windows.length}
          </span>
        ) : null}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-[70] mt-2 max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-2xl scrollbar-thin"
        >
          {sections.map((section) => (
            <div key={section.title} className="mb-1.5 last:mb-0">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/60">
                {section.title}
              </p>
              <ul>
                {section.items.map((item) => (
                  <li key={item.href}>
                    <button
                      onClick={() => {
                        openWindow({ href: item.href, label: item.label });
                        setOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-muted transition-colors hover:bg-white/[0.06] hover:text-fg"
                      role="menuitem"
                    >
                      <AppWindow className="h-3.5 w-3.5 shrink-0 text-muted/70" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {windows.length > 0 ? (
            <div className="mt-2 flex items-center gap-2 border-t border-border px-1 pt-2">
              <button
                onClick={() => {
                  minimizeAll();
                  setOpen(false);
                }}
                className="flex-1 rounded-md border border-border px-2 py-1.5 text-[11px] text-muted transition-colors hover:bg-white/5 hover:text-fg"
              >
                Tout reduire
              </button>
              <button
                onClick={() => {
                  closeAll();
                  setOpen(false);
                }}
                className="flex-1 rounded-md border border-border px-2 py-1.5 text-[11px] text-muted transition-colors hover:bg-danger/15 hover:text-danger"
              >
                Tout fermer
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
