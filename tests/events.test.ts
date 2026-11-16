import { describe, expect, it } from "vitest";
import { buildEventSummary, eventCode, serializeServerEvent } from "@/lib/events";

const NOW = new Date("2026-11-07T12:00:00.000Z");

function event(
  overrides: Partial<Parameters<typeof buildEventSummary>[0][number]> & { id: string },
) {
  return {
    title: "Evenement",
    category: "Communaute",
    location: null,
    status: "PLANNED" as const,
    startsAt: "2026-11-10T20:00:00.000Z",
    endsAt: "2026-11-10T22:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

describe("events", () => {
  it("formate le code evenement", () => {
    expect(eventCode(3)).toBe("EVT-0003");
    expect(eventCode(42)).toBe("EVT-0042");
  });

  it("resume les evenements et choisit le prochain", () => {
    const summary = buildEventSummary(
      [
        event({ id: "a", status: "DRAFT" }),
        event({ id: "b", status: "PLANNED", startsAt: "2026-11-12T20:00:00.000Z" }),
        event({ id: "c", status: "OPEN", startsAt: "2026-11-09T20:00:00.000Z" }),
        event({ id: "d", status: "IN_PROGRESS", startsAt: "2026-11-07T11:00:00.000Z" }),
        event({
          id: "e",
          status: "COMPLETED",
          startsAt: "2026-10-30T20:00:00.000Z",
          completedAt: "2026-10-30T22:00:00.000Z",
        }),
        event({
          id: "f",
          status: "COMPLETED",
          startsAt: "2026-09-01T20:00:00.000Z",
          completedAt: "2026-09-01T22:00:00.000Z",
        }),
        event({ id: "g", status: "CANCELED" }),
        event({ id: "h", status: "PLANNED", startsAt: "2026-11-01T20:00:00.000Z" }),
      ],
      NOW,
    );

    expect(summary.total).toBe(8);
    expect(summary.planned).toBe(3);
    expect(summary.open).toBe(1);
    expect(summary.inProgress).toBe(1);
    expect(summary.completed30d).toBe(1);
    expect(summary.next).toEqual({
      id: "c",
      title: "Evenement",
      category: "Communaute",
      location: null,
      startsAt: "2026-11-09T20:00:00.000Z",
    });
  });

  it("ne propose aucun prochain evenement quand tout est passe", () => {
    const summary = buildEventSummary(
      [
        event({
          id: "a",
          status: "COMPLETED",
          startsAt: "2026-10-01T20:00:00.000Z",
          completedAt: "2026-10-01T22:00:00.000Z",
        }),
      ],
      NOW,
    );
    expect(summary.next).toBeNull();
  });

  it("serialise les dates en ISO et ajoute le code", () => {
    const serialized = serializeServerEvent({
      id: "evt-1",
      number: 12,
      title: "Course nocturne",
      description: "Une course ouverte a tous",
      category: "Course",
      status: "OPEN",
      location: "Sandy Shores",
      startsAt: new Date("2026-11-10T20:00:00.000Z"),
      endsAt: new Date("2026-11-10T22:00:00.000Z"),
      maxPlayers: 32,
      reward: "50 000 $",
      requirements: null,
      startedAt: null,
      completedAt: null,
      canceledAt: null,
      cancelReason: null,
      createdAt: new Date("2026-11-01T09:00:00.000Z"),
      updatedAt: new Date("2026-11-02T09:00:00.000Z"),
      organizer: { id: "u1", displayName: "Alex", avatarColor: "#5865F2" },
    });

    expect(serialized.code).toBe("EVT-0012");
    expect(serialized.startsAt).toBe("2026-11-10T20:00:00.000Z");
    expect(serialized.completedAt).toBeNull();
    expect(serialized.organizer.displayName).toBe("Alex");
  });
});
