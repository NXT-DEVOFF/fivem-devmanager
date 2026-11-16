import type { ReactNode } from "react";

/** Transition d'entree commune a toutes les pages, sans dependance JS. */
export function PageTransition({ children }: { children: ReactNode }) {
  return <div className="animate-in">{children}</div>;
}
