/** Types et libelles partages du module Anticheat. */
import type { BadgeVariant } from "@/lib/labels";

export type AnticheatSeverityValue = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AnticheatStatusValue = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "FALSE_POSITIVE";

export const ANTICHEAT_SEVERITY: Record<
  AnticheatSeverityValue,
  { label: string; variant: BadgeVariant; rank: number }
> = {
  CRITICAL: { label: "Critique", variant: "danger", rank: 4 },
  HIGH: { label: "Élevée", variant: "warning", rank: 3 },
  MEDIUM: { label: "Moyenne", variant: "info", rank: 2 },
  LOW: { label: "Faible", variant: "neutral", rank: 1 },
};

export function severityRank(severity: AnticheatSeverityValue): number {
  return ANTICHEAT_SEVERITY[severity].rank;
}

export const ANTICHEAT_STATUS: Record<
  AnticheatStatusValue,
  { label: string; variant: BadgeVariant; description: string }
> = {
  OPEN: {
    label: "Ouverte",
    variant: "danger",
    description: "Alerte non traitée par l'équipe",
  },
  ACKNOWLEDGED: {
    label: "Prise en compte",
    variant: "warning",
    description: "Un membre de l'équipe examine l'alerte",
  },
  RESOLVED: {
    label: "Résolue",
    variant: "success",
    description: "Vérifiée et traitée (sanction ou correction)",
  },
  FALSE_POSITIVE: {
    label: "Faux positif",
    variant: "neutral",
    description: "Comportement légitime confirmé",
  },
};

export interface DetectionMeta {
  label: string;
  description: string;
}

/** Catalogue des détections envoyées par l'agent `fdm-anticheat`. */
export const ANTICHEAT_DETECTIONS: Record<string, DetectionMeta> = {
  explosion_spam: {
    label: "Rafale d'explosions",
    description: "Nombre d'explosions supérieur au seuil sur une courte fenêtre.",
  },
  explosion_abnormal_scale: {
    label: "Explosion à échelle anormale",
    description: "`damageScale` ou rayon d'explosion hors des valeurs attendues.",
  },
  entity_spam: {
    label: "Création massive d'entités",
    description: "Le joueur crée des entités à un rythme anormal (véhicules, objets, peds).",
  },
  vehicle_spawn_spam: {
    label: "Spawn massif de véhicules",
    description: "Le joueur fait apparaître des véhicules à un rythme anormal.",
  },
  projectile_spam: {
    label: "Rafale de projectiles",
    description: "Tirs de projectiles répétés au-delà du seuil configuré.",
  },
  weapon_damage_anomaly: {
    label: "Dégâts d'arme anormaux",
    description: "Dégâts par impact supérieurs au maximum attendu pour une arme.",
  },
  weapon_damage_spam: {
    label: "Cadence de tirs anormale",
    description: "Nombre d'événements de dégâts inhabituellement élevé.",
  },
  speed_anomaly: {
    label: "Vitesse anormale",
    description: "Vitesse serveur du joueur au-delà du seuil (log-only).",
  },
  teleport_anomaly: {
    label: "Déplacement suspect",
    description: "Écart de position important entre deux mesures côté serveur.",
  },
  custom: {
    label: "Détection personnalisée",
    description: "Événement envoyé manuellement par une ressource ou un administrateur.",
  },
};

export const ANTICHEAT_CATEGORIES: Record<string, string> = {
  event: "Événement",
  explosion: "Explosion",
  entity: "Entité",
  projectile: "Projectile",
  weapon: "Arme",
  movement: "Déplacement",
  custom: "Personnalisé",
};

export function detectionMeta(detection: string): DetectionMeta {
  const known = ANTICHEAT_DETECTIONS[detection];
  if (known) return known;
  const label = detection
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return {
    label: label || "Détection inconnue",
    description: "Détection envoyée par l'agent sans description connue du panel.",
  };
}

export function categoryLabel(category: string): string {
  return ANTICHEAT_CATEGORIES[category] ?? category;
}

export interface AnticheatPerson {
  id: string;
  displayName: string;
  avatarColor: string;
}

export interface AnticheatEventInput {
  id: string;
  eventId: string;
  detection: string;
  category: string;
  severity: AnticheatSeverityValue;
  status: AnticheatStatusValue;
  playerLicense: string | null;
  playerName: string | null;
  playerNetId: number | null;
  playerSource: number | null;
  identifiers: unknown;
  details: unknown;
  serverId: string | null;
  resource: string | null;
  occurredAt: Date;
  lastSeenAt: Date;
  occurrences: number;
  createdAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedBy: AnticheatPerson | null;
  resolvedAt: Date | null;
  resolvedBy: AnticheatPerson | null;
  resolution: string | null;
}

export interface AnticheatEventEntry {
  id: string;
  eventId: string;
  detection: string;
  category: string;
  severity: AnticheatSeverityValue;
  status: AnticheatStatusValue;
  playerLicense: string | null;
  playerName: string | null;
  playerNetId: number | null;
  playerSource: number | null;
  identifiers: string[];
  details: unknown;
  serverId: string | null;
  resource: string | null;
  occurredAt: string;
  lastSeenAt: string;
  occurrences: number;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: AnticheatPerson | null;
  resolvedAt: string | null;
  resolvedBy: AnticheatPerson | null;
  resolution: string | null;
}

function toIdentifiers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.slice(0, 200))
    .slice(0, 20);
}

export function serializeAnticheatEvent(event: AnticheatEventInput): AnticheatEventEntry {
  return {
    id: event.id,
    eventId: event.eventId,
    detection: event.detection,
    category: event.category,
    severity: event.severity,
    status: event.status,
    playerLicense: event.playerLicense,
    playerName: event.playerName,
    playerNetId: event.playerNetId,
    playerSource: event.playerSource,
    identifiers: toIdentifiers(event.identifiers),
    details: event.details ?? null,
    serverId: event.serverId,
    resource: event.resource,
    occurredAt: event.occurredAt.toISOString(),
    lastSeenAt: event.lastSeenAt.toISOString(),
    occurrences: event.occurrences,
    createdAt: event.createdAt.toISOString(),
    acknowledgedAt: event.acknowledgedAt?.toISOString() ?? null,
    acknowledgedBy: event.acknowledgedBy,
    resolvedAt: event.resolvedAt?.toISOString() ?? null,
    resolvedBy: event.resolvedBy,
    resolution: event.resolution,
  };
}

/** Cle d'agregation : meme detection, meme joueur (ou meme source anonyme). */
export function anticheatAggregationKey(event: {
  detection: string;
  playerLicense: string | null;
  playerSource: number | null;
}): string {
  const player = event.playerLicense ?? (event.playerSource === null ? "" : String(event.playerSource));
  return `${event.detection}|${player}`;
}

export const ANTICHEAT_AGENT_ONLINE_MS = 120_000;

export interface AnticheatAgentInput {
  id: string;
  serverId: string;
  version: string | null;
  resourceName: string | null;
  queueSize: number;
  playerCount: number;
  detectionsTotal: number;
  lastError: string | null;
  lastSeenAt: Date;
  firstSeenAt: Date;
}

export interface AnticheatAgentEntry {
  id: string;
  serverId: string;
  version: string | null;
  resourceName: string | null;
  queueSize: number;
  playerCount: number;
  detectionsTotal: number;
  lastError: string | null;
  lastSeenAt: string;
  firstSeenAt: string;
  online: boolean;
}

export function serializeAnticheatAgent(
  agent: AnticheatAgentInput,
  now = new Date(),
): AnticheatAgentEntry {
  return {
    id: agent.id,
    serverId: agent.serverId,
    version: agent.version,
    resourceName: agent.resourceName,
    queueSize: agent.queueSize,
    playerCount: agent.playerCount,
    detectionsTotal: agent.detectionsTotal,
    lastError: agent.lastError,
    lastSeenAt: agent.lastSeenAt.toISOString(),
    firstSeenAt: agent.firstSeenAt.toISOString(),
    online: now.getTime() - agent.lastSeenAt.getTime() <= ANTICHEAT_AGENT_ONLINE_MS,
  };
}

export interface AnticheatSummary {
  total24h: number;
  open: number;
  acknowledged: number;
  criticalOpen: number;
  resolved: number;
  falsePositive: number;
  flaggedPlayers: number;
}

export interface AnticheatGroupCount {
  status: AnticheatStatusValue;
  severity: AnticheatSeverityValue;
  count: number;
}

/** Construit les statistiques affichees en tete du dashboard. */
export function buildAnticheatSummary(input: {
  groups: AnticheatGroupCount[];
  last24h: number;
  flaggedPlayers: number;
}): AnticheatSummary {
  const byStatus = (status: AnticheatStatusValue) =>
    input.groups
      .filter((group) => group.status === status)
      .reduce((total, group) => total + group.count, 0);

  return {
    total24h: input.last24h,
    open: byStatus("OPEN"),
    acknowledged: byStatus("ACKNOWLEDGED"),
    criticalOpen: input.groups
      .filter((group) => group.status === "OPEN" && group.severity === "CRITICAL")
      .reduce((total, group) => total + group.count, 0),
    resolved: byStatus("RESOLVED"),
    falsePositive: byStatus("FALSE_POSITIVE"),
    flaggedPlayers: input.flaggedPlayers,
  };
}

/** Resume local (tests / apercu) a partir d'une liste d'evenements deja serialises. */
export function summarizeEvents(
  events: AnticheatEventEntry[],
  now = new Date(),
): Omit<AnticheatSummary, "resolved" | "falsePositive"> {
  const dayAgo = now.getTime() - 86_400_000;
  const licenses = new Set(
    events
      .map((event) => event.playerLicense)
      .filter((license): license is string => Boolean(license)),
  );
  return {
    total24h: events.filter((event) => new Date(event.occurredAt).getTime() >= dayAgo).length,
    open: events.filter((event) => event.status === "OPEN").length,
    acknowledged: events.filter((event) => event.status === "ACKNOWLEDGED").length,
    criticalOpen: events.filter(
      (event) => event.status === "OPEN" && event.severity === "CRITICAL",
    ).length,
    flaggedPlayers: licenses.size,
  };
}
