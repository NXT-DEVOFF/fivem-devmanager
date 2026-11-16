/** Calculs de temps de session (toujours base sur des timestamps serveur). */
import type { DevSession } from "@prisma/client";

export type SessionTimeInput = Pick<
  DevSession,
  "status" | "startedAt" | "endedAt" | "lastResumedAt" | "accumulatedActiveSeconds"
>;

/** Temps actif (secondes) calcule a partir des intervalles enregistres. */
export function computeActiveSeconds(session: SessionTimeInput, now: Date = new Date()): number {
  let seconds = Math.max(0, session.accumulatedActiveSeconds ?? 0);
  if (session.status === "ACTIVE") {
    // Une session fraichement demarree n'a pas encore de lastResumedAt : sans ce
    // repli, le temps actif restait bloque a 0 pendant toute la session.
    const since = session.lastResumedAt ?? session.startedAt;
    seconds += Math.max(0, Math.floor((now.getTime() - since.getTime()) / 1000));
  }
  return seconds;
}

/** Duree totale (horloge) de la session. */
export function computeDurationSeconds(session: SessionTimeInput, now: Date = new Date()): number {
  const end = session.endedAt ?? now;
  return Math.max(0, Math.floor((end.getTime() - session.startedAt.getTime()) / 1000));
}

export function isIdle(
  session: Pick<DevSession, "status" | "lastActivityAt" | "idleTimeoutMinutes">,
  now: Date = new Date(),
): boolean {
  if (session.status !== "ACTIVE") return false;
  const thresholdMs = Math.max(1, session.idleTimeoutMinutes) * 60 * 1000;
  return now.getTime() - session.lastActivityAt.getTime() > thresholdMs;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  if (m > 0) return `${m}m${String(s).padStart(2, "0")}`;
  return `${s}s`;
}

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((value) => String(value).padStart(2, "0")).join(":");
}

/** Somme des pauses achevees a partir des evenements. */
export function computePauseSeconds(
  events: Array<{ type: string; createdAt: Date }>,
  now: Date = new Date(),
): number {
  let pausedAt: Date | null = null;
  let total = 0;
  for (const event of events) {
    if (event.type === "PAUSE") pausedAt = event.createdAt;
    if (event.type === "RESUME" && pausedAt) {
      total += Math.max(0, Math.floor((event.createdAt.getTime() - pausedAt.getTime()) / 1000));
      pausedAt = null;
    }
  }
  if (pausedAt) total += Math.max(0, Math.floor((now.getTime() - pausedAt.getTime()) / 1000));
  return total;
}
