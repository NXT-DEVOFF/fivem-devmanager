/**
 * Heartbeat de l'agent FiveM : permet au dashboard de distinguer un agent
 * connecte d'un agent arrete, meme quand aucune detection n'est envoyee.
 */
import { z } from "zod";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertAnticheatToken } from "@/server/anticheat-auth";
import { getClientIp, json, jsonError, parseJson, rateLimit } from "@/server/http";

const heartbeatSchema = z.object({
  serverId: z.string().trim().min(1).max(120),
  version: z.string().trim().max(40).optional(),
  resourceName: z.string().trim().max(120).optional(),
  queueSize: z.number().int().min(0).max(100_000).default(0),
  playerCount: z.number().int().min(0).max(2048).default(0),
  detectionsTotal: z.number().int().min(0).max(10_000_000).default(0),
  lastError: z.string().trim().max(255).optional(),
});

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const limited = rateLimit(`anticheat:heartbeat:${getClientIp(request) ?? "unknown"}`, 60, 60_000);
    if (!limited.ok) {
      return json({ error: "Trop de heartbeats", code: "rate_limited" }, 429);
    }

    assertAnticheatToken(request);
    const payload = await parseJson(request, heartbeatSchema);
    const now = new Date();

    const agent = await prisma.anticheatAgent.upsert({
      where: { serverId: payload.serverId },
      create: {
        serverId: payload.serverId,
        version: payload.version ?? null,
        resourceName: payload.resourceName ?? null,
        queueSize: payload.queueSize,
        playerCount: payload.playerCount,
        detectionsTotal: payload.detectionsTotal,
        lastError: payload.lastError ?? null,
        lastSeenAt: now,
      },
      update: {
        version: payload.version ?? null,
        resourceName: payload.resourceName ?? null,
        queueSize: payload.queueSize,
        playerCount: payload.playerCount,
        detectionsTotal: payload.detectionsTotal,
        lastError: payload.lastError ?? null,
        lastSeenAt: now,
      },
    });

    return json({
      ok: true,
      serverId: agent.serverId,
      receivedAt: now.toISOString(),
    });
  } catch (error) {
    return jsonError(error);
  }
}
