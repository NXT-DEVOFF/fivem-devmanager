/**
 * Ingestion des detections de l'agent FiveM `fdm-anticheat`.
 *
 * Authentification : Bearer token partage via ANTICHEAT_INGEST_TOKEN.
 * Ce endpoint n'utilise PAS de session navigateur : il est appele par le
 * serveur FiveM. Aucune punition n'est declenchee ici, uniquement un rapport.
 *
 * Les detections repetees (meme joueur, meme detection, alerte encore ouverte)
 * sont agregees pendant 10 minutes : `occurrences` et `lastSeenAt` sont mis a
 * jour au lieu de creer une alerte par tir. Les preuves restent conservees.
 */
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  anticheatAggregationKey,
  severityRank,
  type AnticheatSeverityValue,
} from "@/lib/anticheat";
import { sha256 } from "@/server/crypto";
import { assertAnticheatToken } from "@/server/anticheat-auth";
import {
  HttpError,
  badRequest,
  getClientIp,
  json,
  jsonError,
  rateLimit,
} from "@/server/http";

const MAX_BODY_BYTES = 128 * 1024;
const MAX_EVENTS = 50;
const GROUP_WINDOW_MS = 10 * 60 * 1000;

const severitySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

const eventSchema = z.object({
  eventId: z
    .string()
    .trim()
    .min(6)
    .max(120)
    .regex(/^[A-Za-z0-9:_.-]+$/, "eventId invalide"),
  detection: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9_]+$/, "detection invalide"),
  category: z
    .string()
    .trim()
    .max(40)
    .regex(/^[a-z0-9_]+$/, "categorie invalide")
    .default("custom"),
  severity: severitySchema.default("MEDIUM"),
  playerLicense: z.string().trim().max(120).nullable().optional(),
  playerName: z.string().trim().max(120).nullable().optional(),
  playerNetId: z.number().int().min(0).max(65535).nullable().optional(),
  playerSource: z.number().int().min(0).max(65535).nullable().optional(),
  identifiers: z.array(z.string().trim().max(200)).max(20).optional(),
  details: z.record(z.unknown()).optional(),
  occurredAt: z.string().datetime().optional(),
});

const payloadSchema = z.object({
  serverId: z.string().trim().max(120).optional(),
  events: z.array(eventSchema).min(1).max(MAX_EVENTS),
});

/** Conserve les details JSON sous une taille raisonnable. */
function limitJson(value: unknown, maxBytes = 8000): unknown {
  if (value === undefined || value === null) return null;
  const serialized = JSON.stringify(value);
  if (serialized.length <= maxBytes) return value;
  return { truncated: true, preview: serialized.slice(0, maxBytes) };
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const ip = getClientIp(request) ?? "unknown";
    const limited = rateLimit(`anticheat:ingest:${ip}`, 240, 60_000);
    if (!limited.ok) {
      throw new HttpError(429, "Trop de requetes d'ingestion", "rate_limited");
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      throw new HttpError(413, "Charge utile trop volumineuse", "payload_too_large");
    }

    assertAnticheatToken(request);

    // Verifie aussi la taille reelle (content-length peut etre absent ou menti).
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      throw new HttpError(413, "Charge utile trop volumineuse", "payload_too_large");
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(raw);
    } catch {
      throw badRequest("Corps JSON invalide");
    }

    const payload = payloadSchema.parse(parsedBody);
    const now = new Date();
    const serverId = payload.serverId?.slice(0, 120) ?? null;

    const data = payload.events.map((event) => {
      const occurredAt = event.occurredAt ? new Date(event.occurredAt) : now;
      const safeOccurredAt =
        Number.isNaN(occurredAt.getTime()) || occurredAt.getTime() > now.getTime() + 300_000
          ? now
          : occurredAt;
      return {
        eventId: event.eventId,
        detection: event.detection,
        category: event.category,
        severity: event.severity,
        playerLicense: event.playerLicense || null,
        playerName: event.playerName || null,
        playerNetId: event.playerNetId ?? null,
        playerSource: event.playerSource ?? null,
        identifiers: (event.identifiers ?? undefined) as Prisma.InputJsonValue | undefined,
        details: (limitJson(event.details) ?? undefined) as Prisma.InputJsonValue | undefined,
        serverId,
        occurredAt: safeOccurredAt,
        lastSeenAt: safeOccurredAt,
      };
    });

    // Idempotence : un renvoi reseau du meme eventId ne cree pas de doublon.
    const byId = new Map(data.map((event) => [event.eventId, event]));
    const unique = [...byId.values()];
    const duplicateIds = data.length - unique.length;

    const existing = await prisma.anticheatEvent.findMany({
      where: { eventId: { in: unique.map((event) => event.eventId) } },
      select: { eventId: true },
    });
    const known = new Set(existing.map((event) => event.eventId));
    const fresh = unique.filter((event) => !known.has(event.eventId));
    const duplicates = duplicateIds + (unique.length - fresh.length);

    const groupingSince = new Date(now.getTime() - GROUP_WINDOW_MS);
    const candidates = new Map<string, { id: string; severity: AnticheatSeverityValue } | null>();
    let created = 0;
    let aggregated = 0;

    for (const event of fresh) {
      const key = anticheatAggregationKey(event);
      let candidate = candidates.get(key);

      if (candidate === undefined) {
        const found = await prisma.anticheatEvent.findFirst({
          where: {
            detection: event.detection,
            status: { in: ["OPEN", "ACKNOWLEDGED"] },
            playerLicense: event.playerLicense,
            ...(event.playerLicense ? {} : { playerSource: event.playerSource }),
            createdAt: { gte: groupingSince },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, severity: true },
        });
        candidate = found
          ? { id: found.id, severity: found.severity as AnticheatSeverityValue }
          : null;
        candidates.set(key, candidate);
      }

      if (candidate) {
        const upgrade = severityRank(event.severity) > severityRank(candidate.severity);
        await prisma.anticheatEvent.update({
          where: { id: candidate.id },
          data: {
            occurrences: { increment: 1 },
            lastSeenAt: event.lastSeenAt,
            ...(upgrade ? { severity: event.severity } : {}),
            ...(event.playerName ? { playerName: event.playerName } : {}),
            ...(event.playerSource !== null
              ? { playerSource: event.playerSource, playerNetId: event.playerNetId }
              : {}),
          },
        });
        candidates.set(key, {
          id: candidate.id,
          severity: upgrade ? event.severity : candidate.severity,
        });
        aggregated += 1;
      } else {
        const row = await prisma.anticheatEvent.create({
          data: event,
          select: { id: true, severity: true },
        });
        candidates.set(key, {
          id: row.id,
          severity: row.severity as AnticheatSeverityValue,
        });
        created += 1;
      }
    }

    // Rattache les alertes aux fiches joueurs existantes sans changer leur statut.
    const licenses = [
      ...new Set(
        data
          .map((event) => event.playerLicense)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    if (licenses.length > 0) {
      await prisma.player
        .updateMany({ where: { license: { in: licenses } }, data: { lastSeenAt: now } })
        .catch(() => undefined);
    }

    return json(
      {
        ok: true,
        received: payload.events.length,
        accepted: created + aggregated,
        created,
        aggregated,
        duplicates,
      },
      202,
    );
  } catch (error) {
    if (error instanceof HttpError) {
      // Journalise le refus sans jamais exposer le token fourni.
      console.warn(
        `[anticheat] ingestion refusee (${error.status}) ip=${sha256(
          getClientIp(request) ?? "unknown",
        ).slice(0, 12)}`,
      );
    }
    return jsonError(error);
  }
}
