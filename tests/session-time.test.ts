import { describe, expect, it } from "vitest";
import {
  computeActiveSeconds,
  computeDurationSeconds,
  computePauseSeconds,
  formatClock,
  formatDuration,
  isIdle,
} from "@/server/session-time";

const now = new Date("2026-11-04T12:00:00.000Z");

describe("temps de session", () => {
  it("calcule le temps actif d'une session en cours", () => {
    const seconds = computeActiveSeconds(
      {
        status: "ACTIVE",
        startedAt: new Date("2026-11-04T11:00:00.000Z"),
        endedAt: null,
        lastResumedAt: new Date("2026-11-04T11:45:00.000Z"),
        accumulatedActiveSeconds: 1800,
      },
      now,
    );
    expect(seconds).toBe(1800 + 15 * 60);
  });

  it("n'ajoute rien quand la session est en pause", () => {
    const seconds = computeActiveSeconds(
      {
        status: "PAUSED",
        startedAt: new Date("2026-11-04T11:00:00.000Z"),
        endedAt: null,
        lastResumedAt: null,
        accumulatedActiveSeconds: 900,
      },
      now,
    );
    expect(seconds).toBe(900);
  });

  it("calcule la duree totale meme apres cloture", () => {
    const duration = computeDurationSeconds(
      {
        status: "COMPLETED",
        startedAt: new Date("2026-11-04T10:00:00.000Z"),
        endedAt: new Date("2026-11-04T12:00:00.000Z"),
        lastResumedAt: null,
        accumulatedActiveSeconds: 0,
      },
      now,
    );
    expect(duration).toBe(7200);
  });

  it("detecte l'inactivite sans retirer de temps", () => {
    const session = {
      status: "ACTIVE" as const,
      lastActivityAt: new Date("2026-11-04T11:30:00.000Z"),
      idleTimeoutMinutes: 15,
    };
    expect(isIdle(session, now)).toBe(true);
    expect(isIdle({ ...session, lastActivityAt: new Date("2026-11-04T11:55:00.000Z") }, now)).toBe(false);
    expect(isIdle({ ...session, status: "PAUSED" as unknown as "ACTIVE" }, now)).toBe(false);
  });

  it("calcule les pauses a partir des evenements", () => {
    const seconds = computePauseSeconds(
      [
        { type: "PAUSE", createdAt: new Date("2026-11-04T11:00:00.000Z") },
        { type: "RESUME", createdAt: new Date("2026-11-04T11:10:00.000Z") },
        { type: "PAUSE", createdAt: new Date("2026-11-04T11:50:00.000Z") },
      ],
      now,
    );
    expect(seconds).toBe(600 + 600);
  });

  it("formate les durees et l'horloge", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(90)).toBe("1m30");
    expect(formatDuration(7200)).toBe("2h00");
    expect(formatClock(3661)).toBe("01:01:01");
    expect(formatClock(-5)).toBe("00:00:00");
  });
});
