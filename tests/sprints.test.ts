import { describe, expect, it } from "vitest";
import { daysUntil, sprintProgress } from "@/lib/sprints";

describe("sprints", () => {
  it("calcule la progression a partir des taches terminees", () => {
    expect(
      sprintProgress([
        { status: "DONE" },
        { status: "IN_PROGRESS" },
        { status: "TODO" },
        { status: "DONE" },
      ]),
    ).toEqual({ total: 4, done: 2, percent: 50 });
  });

  it("retourne une progression nulle pour un sprint vide", () => {
    expect(sprintProgress([])).toEqual({ total: 0, done: 0, percent: 0 });
  });

  it("calcule les jours restants sans dependre de l'heure", () => {
    const now = new Date("2026-11-05T15:30:00.000Z");
    expect(daysUntil("2026-11-05T23:00:00.000Z", now)).toBe(0);
    expect(daysUntil("2026-11-08T01:00:00.000Z", now)).toBe(3);
    expect(daysUntil("2026-11-03T23:00:00.000Z", now)).toBe(-2);
  });
});
