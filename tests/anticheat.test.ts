import { describe, expect, it } from "vitest";
import {
  ANTICHEAT_AGENT_ONLINE_MS,
  ANTICHEAT_STATUS,
  anticheatAggregationKey,
  buildAnticheatSummary,
  categoryLabel,
  detectionMeta,
  serializeAnticheatAgent,
  serializeAnticheatEvent,
  severityRank,
  summarizeEvents,
  type AnticheatAgentInput,
  type AnticheatEventEntry,
  type AnticheatEventInput,
} from "@/lib/anticheat";

const NOW = new Date("2026-11-08T12:00:00.000Z");

const EVENT: AnticheatEventInput = {
  id: "evt_1",
  eventId: "1762603200000-42-7",
  detection: "explosion_spam",
  category: "explosion",
  severity: "HIGH",
  status: "OPEN",
  playerLicense: "license:abc123",
  playerName: "John Carter",
  playerNetId: 42,
  playerSource: 42,
  identifiers: ["license:abc123", 42, "steam:1100001"],
  details: { count: 14, windowMs: 10000 },
  serverId: "mon-serveur",
  resource: "fdm-anticheat",
  occurredAt: new Date("2026-11-08T11:58:00.000Z"),
  lastSeenAt: new Date("2026-11-08T11:59:30.000Z"),
  occurrences: 3,
  createdAt: new Date("2026-11-08T11:58:03.000Z"),
  acknowledgedAt: null,
  acknowledgedBy: null,
  resolvedAt: null,
  resolvedBy: null,
  resolution: null,
};

const AGENT: AnticheatAgentInput = {
  id: "agent_1",
  serverId: "mon-serveur",
  version: "1.1.0",
  resourceName: "fdm-anticheat",
  queueSize: 4,
  playerCount: 18,
  detectionsTotal: 120,
  lastError: null,
  lastSeenAt: new Date(NOW.getTime() - 30_000),
  firstSeenAt: new Date("2026-11-01T10:00:00.000Z"),
};

describe("anticheat", () => {
  it("resout les libelles connus et inconnus", () => {
    expect(detectionMeta("explosion_spam").label).toBe("Rafale d'explosions");
    expect(detectionMeta("weapon_damage_anomaly").label).toContain("Dégâts");
    expect(detectionMeta("vehicle_spawn_spam").label).toContain("véhicules");
    expect(detectionMeta("custom_detection").label).toBe("Custom Detection");
    expect(categoryLabel("movement")).toBe("Déplacement");
    expect(categoryLabel("inconnue")).toBe("inconnue");
  });

  it("serialise un evenement en ne gardant que des identifiants texte", () => {
    const entry = serializeAnticheatEvent(EVENT);
    expect(entry.occurredAt).toBe("2026-11-08T11:58:00.000Z");
    expect(entry.lastSeenAt).toBe("2026-11-08T11:59:30.000Z");
    expect(entry.occurrences).toBe(3);
    expect(entry.acknowledgedAt).toBeNull();
    expect(entry.identifiers).toEqual(["license:abc123", "steam:1100001"]);
    expect(entry.details).toEqual({ count: 14, windowMs: 10000 });
    expect(ANTICHEAT_STATUS[entry.status].label).toBe("Ouverte");
  });

  it("regroupe les detections par joueur identifie ou par source anonyme", () => {
    expect(
      anticheatAggregationKey({
        detection: "explosion_spam",
        playerLicense: "license:abc",
        playerSource: 12,
      }),
    ).toBe("explosion_spam|license:abc");
    expect(
      anticheatAggregationKey({
        detection: "explosion_spam",
        playerLicense: null,
        playerSource: 12,
      }),
    ).toBe("explosion_spam|12");
    expect(
      anticheatAggregationKey({
        detection: "custom",
        playerLicense: null,
        playerSource: null,
      }),
    ).toBe("custom|");
  });

  it("classe les severites de la plus faible a la plus forte", () => {
    expect(severityRank("LOW")).toBeLessThan(severityRank("MEDIUM"));
    expect(severityRank("MEDIUM")).toBeLessThan(severityRank("HIGH"));
    expect(severityRank("HIGH")).toBeLessThan(severityRank("CRITICAL"));
  });

  it("construit les statistiques a partir des groupes de statut", () => {
    const summary = buildAnticheatSummary({
      groups: [
        { status: "OPEN", severity: "CRITICAL", count: 2 },
        { status: "OPEN", severity: "HIGH", count: 3 },
        { status: "ACKNOWLEDGED", severity: "MEDIUM", count: 1 },
        { status: "RESOLVED", severity: "LOW", count: 4 },
        { status: "FALSE_POSITIVE", severity: "LOW", count: 1 },
      ],
      last24h: 9,
      flaggedPlayers: 5,
    });

    expect(summary).toEqual({
      total24h: 9,
      open: 5,
      acknowledged: 1,
      criticalOpen: 2,
      resolved: 4,
      falsePositive: 1,
      flaggedPlayers: 5,
    });
  });

  it("resume localement les evenements recents", () => {
    const entries: AnticheatEventEntry[] = [
      serializeAnticheatEvent(EVENT),
      serializeAnticheatEvent({
        ...EVENT,
        id: "evt_2",
        eventId: "evt-2",
        severity: "CRITICAL",
        playerLicense: "license:def456",
        occurredAt: new Date("2026-11-07T10:00:00.000Z"),
      }),
      serializeAnticheatEvent({
        ...EVENT,
        id: "evt_3",
        eventId: "evt-3",
        status: "ACKNOWLEDGED",
        playerLicense: null,
        occurredAt: new Date("2026-11-08T11:00:00.000Z"),
      }),
      serializeAnticheatEvent({
        ...EVENT,
        id: "evt_4",
        eventId: "evt-4",
        status: "RESOLVED",
        playerLicense: "license:abc123",
        occurredAt: new Date("2026-11-08T10:00:00.000Z"),
      }),
    ];

    const summary = summarizeEvents(entries, NOW);
    expect(summary.total24h).toBe(3);
    expect(summary.open).toBe(2);
    expect(summary.acknowledged).toBe(1);
    expect(summary.criticalOpen).toBe(1);
    expect(summary.flaggedPlayers).toBe(2);
  });

  it("determine si un agent est en ligne a partir de son heartbeat", () => {
    const online = serializeAnticheatAgent(AGENT, NOW);
    expect(online.online).toBe(true);
    expect(online.lastSeenAt).toBe(new Date(NOW.getTime() - 30_000).toISOString());
    expect(online.serverId).toBe("mon-serveur");

    const offline = serializeAnticheatAgent(
      {
        ...AGENT,
        lastSeenAt: new Date(NOW.getTime() - ANTICHEAT_AGENT_ONLINE_MS - 1),
      },
      NOW,
    );
    expect(offline.online).toBe(false);
  });
});
