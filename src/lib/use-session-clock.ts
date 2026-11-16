"use client";

import * as React from "react";

/**
 * Chronometre de session synchronise sur la mesure serveur.
 *
 * `activeSeconds` est toujours calcule par le serveur ; on memorise l'instant
 * local ou cette valeur a ete recue, puis on derive. Deux ecrans qui lisent la
 * meme session affichent donc la meme duree, et un rafraichissement ne double
 * jamais le compteur (l'ancien `tick` cumulatif derivait a chaque sondage).
 */
export function useSessionClock(activeSeconds: number, running: boolean): number {
  const anchor = React.useRef({ activeSeconds, at: Date.now() });
  const [, force] = React.useState(0);

  React.useEffect(() => {
    anchor.current = { activeSeconds, at: Date.now() };
  }, [activeSeconds]);

  React.useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => force((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  if (!running) return activeSeconds;
  const elapsed = Math.max(0, Math.floor((Date.now() - anchor.current.at) / 1000));
  return activeSeconds + elapsed;
}
