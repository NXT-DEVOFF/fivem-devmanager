"use client";

/**
 * Gestionnaire de fenetres internes : permet d'ouvrir plusieurs modules en
 * parallele, de les deplacer, les redimensionner, les reduire et les fermer.
 * La geometrie est conservee dans le localStorage (par navigateur).
 */
import * as React from "react";

export interface WorkspaceWindowState {
  id: string;
  href: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
  restore: { x: number; y: number; width: number; height: number } | null;
}

interface OpenWindowInput {
  href: string;
  label: string;
}

interface WorkspaceContextValue {
  windows: WorkspaceWindowState[];
  openWindow: (input: OpenWindowInput) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  toggleMaximize: (id: string) => void;
  updateWindow: (id: string, patch: Partial<WorkspaceWindowState>) => void;
  minimizeAll: () => void;
  closeAll: () => void;
}

export const MIN_WINDOW_WIDTH = 360;
export const MIN_WINDOW_HEIGHT = 220;
const MAX_WINDOWS = 8;
const STORAGE_KEY = "fdm:workspace";

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const context = React.useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace doit etre utilise dans un WorkspaceProvider");
  }
  return context;
}

function viewport() {
  if (typeof window === "undefined") return { width: 1280, height: 800 };
  return { width: window.innerWidth, height: window.innerHeight };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function readStored(): { windows: WorkspaceWindowState[]; topZ: number } | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { windows?: unknown; topZ?: unknown };
    if (!Array.isArray(parsed.windows)) return null;
    const windows = parsed.windows
      .filter((entry): entry is WorkspaceWindowState => {
        if (!entry || typeof entry !== "object") return false;
        const item = entry as Partial<WorkspaceWindowState>;
        return (
          typeof item.id === "string" &&
          typeof item.href === "string" &&
          typeof item.label === "string" &&
          typeof item.x === "number" &&
          typeof item.y === "number" &&
          typeof item.width === "number" &&
          typeof item.height === "number"
        );
      })
      .slice(0, MAX_WINDOWS)
      .map((item) => ({
        ...item,
        z: typeof item.z === "number" ? item.z : 100,
        minimized: Boolean(item.minimized),
        maximized: Boolean(item.maximized),
        restore: item.restore ?? null,
      }));
    const topZ = typeof parsed.topZ === "number" ? parsed.topZ : 100;
    return { windows, topZ };
  } catch {
    return null;
  }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = React.useState<WorkspaceWindowState[]>([]);
  const [hydrated, setHydrated] = React.useState(false);
  const topZ = React.useRef(100);

  // Restauration apres montage (localStorage indisponible cote serveur).
  React.useEffect(() => {
    const stored = readStored();
    if (stored) {
      setWindows(stored.windows);
      topZ.current = stored.topZ;
    }
    setHydrated(true);
  }, []);

  // Sauvegarde differee pour ne pas ecrire a chaque pixel de deplacement.
  React.useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ windows, topZ: topZ.current }),
        );
      } catch {
        // Quota ou navigation privee : la session reste utilisable.
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [windows, hydrated]);

  // Apres un redimensionnement du navigateur, aucune fenetre ne doit sortir
  // de l'ecran ni devenir inatteignable.
  React.useEffect(() => {
    const onResize = () => {
      const { width: vpWidth, height: vpHeight } = viewport();
      setWindows((current) =>
        current.map((window) => {
          if (window.maximized) return window;
          const width = Math.min(window.width, Math.max(MIN_WINDOW_WIDTH, vpWidth - 16));
          const height = Math.min(window.height, Math.max(MIN_WINDOW_HEIGHT, vpHeight - 16));
          return {
            ...window,
            width,
            height,
            x: clamp(window.x, 0, Math.max(0, vpWidth - width)),
            y: clamp(window.y, 0, Math.max(0, vpHeight - 48)),
          };
        }),
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const openWindow = React.useCallback((input: OpenWindowInput) => {
    setWindows((current) => {
      const sameModule = current.filter((window) => window.href === input.href);
      const minimized = sameModule.find((window) => window.minimized);
      if (minimized) {
        topZ.current += 1;
        return current.map((window) =>
          window.id === minimized.id
            ? { ...window, minimized: false, z: topZ.current }
            : window,
        );
      }

      const { width: vpWidth, height: vpHeight } = viewport();
      const width = Math.min(980, Math.max(MIN_WINDOW_WIDTH, vpWidth - 120));
      const height = Math.min(660, Math.max(MIN_WINDOW_HEIGHT, vpHeight - 120));
      const offset = (current.length % 6) * 30;

      let base = current;
      if (base.length >= MAX_WINDOWS) {
        const oldest = base.reduce((a, b) => (a.z <= b.z ? a : b));
        base = base.filter((window) => window.id !== oldest.id);
      }

      topZ.current += 1;
      const created: WorkspaceWindowState = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        href: input.href,
        label: sameModule.length > 0 ? `${input.label} ${sameModule.length + 1}` : input.label,
        x: clamp(56 + offset, 8, Math.max(8, vpWidth - width - 24)),
        y: clamp(48 + offset, 8, Math.max(8, vpHeight - height - 24)),
        width,
        height,
        z: topZ.current,
        minimized: false,
        maximized: false,
        restore: null,
      };
      return [...base, created];
    });
  }, []);

  const closeWindow = React.useCallback((id: string) => {
    setWindows((current) => current.filter((window) => window.id !== id));
  }, []);

  const focusWindow = React.useCallback((id: string) => {
    setWindows((current) => {
      const target = current.find((window) => window.id === id);
      if (!target) return current;
      const highest = current.reduce((max, window) => Math.max(max, window.z), 0);
      if (target.z === highest && !target.minimized) return current;
      topZ.current = Math.max(topZ.current, highest) + 1;
      return current.map((window) =>
        window.id === id ? { ...window, z: topZ.current, minimized: false } : window,
      );
    });
  }, []);

  const minimizeWindow = React.useCallback((id: string) => {
    setWindows((current) =>
      current.map((window) => (window.id === id ? { ...window, minimized: true } : window)),
    );
  }, []);

  const toggleMaximize = React.useCallback((id: string) => {
    const { width: vpWidth, height: vpHeight } = viewport();
    setWindows((current) =>
      current.map((window) => {
        if (window.id !== id) return window;
        if (window.maximized) {
          const restore =
            window.restore ??
            {
              x: 64,
              y: 48,
              width: Math.min(980, Math.max(MIN_WINDOW_WIDTH, vpWidth - 160)),
              height: Math.min(660, Math.max(MIN_WINDOW_HEIGHT, vpHeight - 140)),
            };
          return { ...window, maximized: false, restore: null, ...restore };
        }
        return {
          ...window,
          maximized: true,
          restore: { x: window.x, y: window.y, width: window.width, height: window.height },
        };
      }),
    );
  }, []);

  const updateWindow = React.useCallback(
    (id: string, patch: Partial<WorkspaceWindowState>) => {
      setWindows((current) =>
        current.map((window) => (window.id === id ? { ...window, ...patch } : window)),
      );
    },
    [],
  );

  const minimizeAll = React.useCallback(() => {
    setWindows((current) => current.map((window) => ({ ...window, minimized: true })));
  }, []);

  const closeAll = React.useCallback(() => setWindows([]), []);

  const value = React.useMemo(
    () => ({
      windows,
      openWindow,
      closeWindow,
      focusWindow,
      minimizeWindow,
      toggleMaximize,
      updateWindow,
      minimizeAll,
      closeAll,
    }),
    [
      windows,
      openWindow,
      closeWindow,
      focusWindow,
      minimizeWindow,
      toggleMaximize,
      updateWindow,
      minimizeAll,
      closeAll,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
