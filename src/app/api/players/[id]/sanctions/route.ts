import { z } from "zod";
import { api } from "@/server/api";
import { badRequest, json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import {
  BAN_SANCTIONS,
  DURATION_SANCTIONS,
  serializePlayerSanction,
  type SanctionTypeValue,
} from "@/lib/players";

const createSchema = z.object({
  type: z.enum(["WARNING", "MUTE", "KICK", "TEMP_BAN", "PERMANENT_BAN"]),
  reason: z.string().trim().min(5).max(4000),
  evidence: z.string().trim().max(4000).optional(),
  durationHours: z.number().int().min(1).max(87_600).optional(),
});

const sanctionInclude = {
  issuedBy: { select: { id: true, displayName: true, avatarColor: true } },
  revokedBy: { select: { id: true, displayName: true, avatarColor: true } },
} as const;

export const POST = api(async (request, context) => {
  const user = await requirePermission("sanctions.create");
  const { id } = await context.params;
  const body = await parseJson(request, createSchema);

  const player = await prisma.player.findUnique({ where: { id } });
  if (!player) throw notFound("Joueur introuvable");

  const needsDuration = DURATION_SANCTIONS.includes(body.type as SanctionTypeValue);
  if (needsDuration && !body.durationHours) {
    throw badRequest("Renseignez une duree en heures pour ce type de sanction");
  }

  const now = new Date();
  const endsAt = needsDuration ? new Date(now.getTime() + body.durationHours! * 3_600_000) : null;

  const sanction = await prisma.playerSanction.create({
    data: {
      playerId: player.id,
      type: body.type,
      reason: body.reason,
      evidence: body.evidence?.trim() || null,
      durationHours: needsDuration ? body.durationHours! : null,
      startsAt: now,
      endsAt,
      issuedById: user.id,
    },
    include: sanctionInclude,
  });

  if (BAN_SANCTIONS.includes(body.type as SanctionTypeValue) && player.status !== "BANNED") {
    await prisma.player.update({ where: { id: player.id }, data: { status: "BANNED" } });
  }

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "sanction.create",
    targetType: "player_sanction",
    targetId: sanction.id,
    metadata: {
      player: player.displayName,
      license: player.license,
      type: sanction.type,
      durationHours: sanction.durationHours,
    },
  });

  return json({ sanction: serializePlayerSanction(sanction) }, 201);
});
