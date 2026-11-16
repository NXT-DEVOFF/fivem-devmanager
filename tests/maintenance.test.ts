import { describe, expect, it } from "vitest";
import {
  buildMaintenanceSummary,
  maintenanceCode,
  serializeMaintenanceWindow,
  type MaintenanceWindow,
} from "@/lib/maintenance";

function makeWindow(overrides: Partial<MaintenanceWindow> = {}): MaintenanceWindow {
  return {
    id: "window-1",
    number: 1,
    code: "MNT-0001",
    title: "Redémarrage planifié",
    description: "Vérifier les ressources avant le redémarrage.",
    scope: "Serveur complet",
    impact: null,
    status: "PLANNED",
    scheduledStart: "2026-11-08T10:00:00.000Z",
    scheduledEnd: "2026-11-08T11:00:00.000Z",
    startedAt: null,
    completedAt: null,
    canceledAt: null,
    cancelReason: null,
    createdAt: "2026-11-06T10:00:00.000Z",
    updatedAt: "2026-11-06T10:00:00.000Z",
    createdBy: { id: "user-1", displayName: "Lead", avatarColor: "#5865F2" },
    ...overrides,
  };
}

describe("maintenance", () => {
  it("formate les numeros de maintenance", () => {
    expect(maintenanceCode(1)).toBe("MNT-0001");
    expect(maintenanceCode(42)).toBe("MNT-0042");
  });

  it("calcule les indicateurs et la prochaine fenetre", () => {
    const now = new Date("2026-11-07T12:00:00.000Z");
    const windows = [
      makeWindow({ id: "planned", status: "PLANNED" }),
      makeWindow({
        id: "active",
        status: "IN_PROGRESS",
        scheduledStart: "2026-11-07T10:00:00.000Z",
        scheduledEnd: "2026-11-07T14:00:00.000Z",
        startedAt: "2026-11-07T10:05:00.000Z",
      }),
      makeWindow({
        id: "recent-completed",
        status: "COMPLETED",
        completedAt: "2026-11-01T12:00:00.000Z",
      }),
      makeWindow({
        id: "old-completed",
        status: "COMPLETED",
        completedAt: "2026-09-01T12:00:00.000Z",
      }),
      makeWindow({ id: "canceled", status: "CANCELED", canceledAt: "2026-11-06T12:00:00.000Z" }),
    ];

    const summary = buildMaintenanceSummary(windows, now);

    expect(summary.planned).toBe(1);
    expect(summary.inProgress).toBe(1);
    expect(summary.completed30d).toBe(1);
    expect(summary.next?.id).toBe("active");
  });

  it("serialise les dates en ISO", () => {
    const serialized = serializeMaintenanceWindow({
      id: "window-1",
      number: 7,
      title: "Maintenance",
      description: "Description valide",
      scope: null,
      impact: null,
      status: "PLANNED",
      scheduledStart: new Date("2026-11-08T10:00:00.000Z"),
      scheduledEnd: new Date("2026-11-08T11:00:00.000Z"),
      startedAt: null,
      completedAt: null,
      canceledAt: null,
      cancelReason: null,
      createdAt: new Date("2026-11-06T10:00:00.000Z"),
      updatedAt: new Date("2026-11-06T10:00:00.000Z"),
      createdBy: { id: "user-1", displayName: "Lead", avatarColor: "#5865F2" },
    });

    expect(serialized.code).toBe("MNT-0007");
    expect(serialized.scheduledStart).toBe("2026-11-08T10:00:00.000Z");
  });
});
