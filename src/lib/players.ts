/** Types et calculs partages du module Joueurs & sanctions. */
import type { BadgeVariant } from "@/lib/labels";

export type PlayerStatusValue = "ACTIVE" | "WATCHED" | "SUSPENDED" | "BANNED";
export type SanctionTypeValue = "WARNING" | "MUTE" | "KICK" | "TEMP_BAN" | "PERMANENT_BAN";

export const PLAYER_STATUS: Record<
  PlayerStatusValue,
  { label: string; variant: BadgeVariant; description: string }
> = {
  ACTIVE: {
    label: "Actif",
    variant: "success",
    description: "Joueur sans restriction en cours",
  },
  WATCHED: {
    label: "Sous surveillance",
    variant: "warning",
    description: "Comportement à surveiller par l'équipe",
  },
  SUSPENDED: {
    label: "Suspendu",
    variant: "info",
    description: "Accès restreint temporairement",
  },
  BANNED: {
    label: "Banni",
    variant: "danger",
    description: "Accès au serveur interdit",
  },
};

export const SANCTION_TYPE: Record<
  SanctionTypeValue,
  { label: string; variant: BadgeVariant; description: string }
> = {
  WARNING: {
    label: "Avertissement",
    variant: "info",
    description: "Rappel à l'ordre sans restriction",
  },
  MUTE: {
    label: "Mute",
    variant: "warning",
    description: "Chat désactivé pendant une durée définie",
  },
  KICK: {
    label: "Expulsion",
    variant: "warning",
    description: "Joueur déconnecté immédiatement",
  },
  TEMP_BAN: {
    label: "Bannissement temporaire",
    variant: "danger",
    description: "Accès bloqué jusqu'à la date de fin",
  },
  PERMANENT_BAN: {
    label: "Bannissement définitif",
    variant: "danger",
    description: "Accès bloqué sans échéance",
  },
};

export const BAN_SANCTIONS: SanctionTypeValue[] = ["TEMP_BAN", "PERMANENT_BAN"];
export const DURATION_SANCTIONS: SanctionTypeValue[] = ["MUTE", "TEMP_BAN"];

export interface PlayerPerson {
  id: string;
  displayName: string;
  avatarColor: string;
}

export interface PlayerSanction {
  id: string;
  number: number;
  code: string;
  type: SanctionTypeValue;
  reason: string;
  evidence: string | null;
  durationHours: number | null;
  startsAt: string;
  endsAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  active: boolean;
  createdAt: string;
  issuedBy: PlayerPerson;
  revokedBy: PlayerPerson | null;
}

export interface PlayerSanctionInput {
  id: string;
  number: number;
  type: SanctionTypeValue;
  reason: string;
  evidence: string | null;
  durationHours: number | null;
  startsAt: Date;
  endsAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
  createdAt: Date;
  issuedBy: PlayerPerson;
  revokedBy: PlayerPerson | null;
}

export interface PlayerEntry {
  id: string;
  license: string;
  displayName: string;
  discordId: string | null;
  steamHex: string | null;
  status: PlayerStatusValue;
  notes: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: PlayerPerson | null;
  sanctions: PlayerSanction[];
  activeSanctions: number;
  totalSanctions: number;
}

export interface PlayerInput {
  id: string;
  license: string;
  displayName: string;
  discordId: string | null;
  steamHex: string | null;
  status: PlayerStatusValue;
  notes: string | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: PlayerPerson | null;
  sanctions: PlayerSanctionInput[];
}

export interface PlayersSummary {
  total: number;
  active: number;
  watched: number;
  banned: number;
  activeSanctions: number;
  sanctions30d: number;
}

export function sanctionCode(number: number): string {
  return `SAN-${String(number).padStart(4, "0")}`;
}

export interface SanctionActivityInput {
  type: SanctionTypeValue;
  revokedAt: Date | string | null;
  endsAt: Date | string | null;
}

/** Une sanction est active tant qu'elle n'est pas revoquee et non expiree. */
export function sanctionIsActive(sanction: SanctionActivityInput, now = new Date()): boolean {
  if (sanction.revokedAt) return false;
  if (sanction.type === "PERMANENT_BAN") return true;
  if (sanction.type === "TEMP_BAN" || sanction.type === "MUTE") {
    if (!sanction.endsAt) return true;
    return new Date(sanction.endsAt).getTime() > now.getTime();
  }
  return false;
}

export interface PlayerStatusSource {
  type: SanctionTypeValue;
  revokedAt: Date | string | null;
  endsAt: Date | string | null;
}

/**
 * Statut effectif d'un joueur : un bannissement actif impose `BANNED`, tandis
 * qu'une fiche restee `BANNED` alors que tous ses bans sont expires repasse
 * `ACTIVE`. Un statut `BANNED` sans aucun ban enregistre reste un choix manuel.
 */
export function resolvePlayerStatus(
  status: PlayerStatusValue,
  sanctions: PlayerStatusSource[],
  now = new Date(),
): PlayerStatusValue {
  const bans = sanctions.filter((sanction) => BAN_SANCTIONS.includes(sanction.type));
  if (bans.some((ban) => sanctionIsActive(ban, now))) return "BANNED";
  if (status === "BANNED" && bans.length > 0) return "ACTIVE";
  return status;
}

export function serializePlayerSanction(sanction: PlayerSanctionInput): PlayerSanction {
  return {
    id: sanction.id,
    number: sanction.number,
    code: sanctionCode(sanction.number),
    type: sanction.type,
    reason: sanction.reason,
    evidence: sanction.evidence,
    durationHours: sanction.durationHours,
    startsAt: sanction.startsAt.toISOString(),
    endsAt: sanction.endsAt?.toISOString() ?? null,
    revokedAt: sanction.revokedAt?.toISOString() ?? null,
    revokedReason: sanction.revokedReason,
    active: sanctionIsActive(sanction),
    createdAt: sanction.createdAt.toISOString(),
    issuedBy: sanction.issuedBy,
    revokedBy: sanction.revokedBy,
  };
}

export function serializePlayer(player: PlayerInput): PlayerEntry {
  const sanctions = player.sanctions.map(serializePlayerSanction);
  return {
    id: player.id,
    license: player.license,
    displayName: player.displayName,
    discordId: player.discordId,
    steamHex: player.steamHex,
    status: resolvePlayerStatus(player.status, player.sanctions),
    notes: player.notes,
    lastSeenAt: player.lastSeenAt?.toISOString() ?? null,
    createdAt: player.createdAt.toISOString(),
    updatedAt: player.updatedAt.toISOString(),
    createdBy: player.createdBy,
    sanctions,
    activeSanctions: sanctions.filter((sanction) => sanction.active).length,
    totalSanctions: sanctions.length,
  };
}

export function buildPlayersSummary(
  players: Array<{
    status: PlayerStatusValue;
    sanctions: Array<Pick<PlayerSanction, "active" | "createdAt">>;
  }>,
  now = new Date(),
): PlayersSummary {
  const thirtyDaysAgo = now.getTime() - 30 * 86_400_000;
  return {
    total: players.length,
    active: players.filter((player) => player.status === "ACTIVE").length,
    watched: players.filter((player) => player.status === "WATCHED").length,
    banned: players.filter((player) => player.status === "BANNED").length,
    activeSanctions: players.reduce(
      (total, player) => total + player.sanctions.filter((sanction) => sanction.active).length,
      0,
    ),
    sanctions30d: players.reduce(
      (total, player) =>
        total +
        player.sanctions.filter(
          (sanction) => new Date(sanction.createdAt).getTime() >= thirtyDaysAgo,
        ).length,
      0,
    ),
  };
}

/**
 * Statut d'un joueur apres revocation : un bannissement levee remet la fiche
 * en actif uniquement s'il ne reste aucun bannissement actif.
 */
export function nextPlayerStatusAfterRevoke(
  current: PlayerStatusValue,
  remainingActiveBans: number,
): PlayerStatusValue {
  if (current === "BANNED" && remainingActiveBans === 0) return "ACTIVE";
  return current;
}
