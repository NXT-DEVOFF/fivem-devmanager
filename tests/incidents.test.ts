import { describe, expect, it } from "vitest";
import {
  buildIncidentSummary,
  incidentCode,
  type IncidentView,
} from "@/lib/incidents";

const person = { id: "u1", displayName: "Dev", avatarColor: "#5865F2" };

function incident(overrides: Partial<IncidentView>): IncidentView {
  return {
    id: overrides.id ?? "i1",
    number: overrides.number ?? 1,
    code: incidentCode(overrides.number ?? 1),
    title: "Incident",
    description: "Description",
    severity: "HIGH",
    status: "OPEN",
    resource: null,
    impact: null,
    resolution: null,
    startedAt: "2026-11-01T10:00:00.000Z",
    acknowledgedAt: null,
    mitigatedAt: null,
    resolvedAt: null,
    createdAt: "2026-11-01T10:00:00.000Z",
    reporter: person,
    assignee: null,
    ...overrides,
  };
}

describe("incidents", () => {
  it("formate le code incident", () => {
    expect(incidentCode(7)).toBe("INC-0007");
    expect(incidentCode(1234)).toBe("INC-1234");
  });

  it("agrege les incidents actifs et critiques", () => {
    const summary = buildIncidentSummary(
      [
        incident({ id: "a", number: 1, severity: "CRITICAL", status: "OPEN" }),
        incident({ id: "b", number: 2, status: "INVESTIGATING" }),
        incident({
          id: "c",
          number: 3,
          status: "RESOLVED",
          startedAt: "2026-10-20T10:00:00.000Z",
          resolvedAt: "2026-10-20T12:00:00.000Z",
        }),
      ],
      new Date("2026-11-05T10:00:00.000Z"),
    );

    expect(summary.active).toBe(2);
    expect(summary.critical).toBe(1);
    expect(summary.investigating).toBe(1);
    expect(summary.resolved30d).toBe(1);
    expect(summary.avgResolutionSeconds).toBe(7_200);
  });

  it("ignore les resolutions de plus de 30 jours", () => {
    const summary = buildIncidentSummary(
      [
        incident({
          id: "old",
          status: "RESOLVED",
          startedAt: "2026-09-01T10:00:00.000Z",
          resolvedAt: "2026-09-01T11:00:00.000Z",
        }),
      ],
      new Date("2026-11-05T10:00:00.000Z"),
    );
    expect(summary.resolved30d).toBe(0);
    expect(summary.avgResolutionSeconds).toBe(0);
  });
});
