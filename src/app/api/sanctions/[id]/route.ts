import { z } from "zod";
import { api } from "@/server/api";
import { conflict, json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import {
  BAN_SANCTIONS,
  nextPlayerStatusAfterRevoke,
  serializePlayerSanction,
  type PlayerStatusValue,
  type SanctionTypeValue,
} from "@/lib/players";

const revokeSchema = z.object({
  revokeReason: z.string().trim().min(5).max(2000),
});

const sanctionInclude = {
  issuedBy: { select: { id: true, displayName: true, avatarColor: true } },
  revokedBy: { select: { id: true, displayName: true, avatarColor: true } },
} as const;

export const PATCH = api(async (request, context) => {
  const user = await requirePermission("sanctions.manage");
  const { id } = await context.params;
  const body = await parseJson(request, revokeSchema);

  const sanction = await prisma.playerSanction.findUnique({
    where: { id },
    include: { player: true },
  });
  if (!sanction) throw notFound("Sanction introuvable");
  if (sanction.revokedAt) throw conflict("Cette sanction est deja revoquee");

  const now = new Date();
  const updated = await prisma.playerSanction.update({
    where: { id },
    data: {
      revokedAt: now,
      revokedReason: body.revokeReason,
      revokedById: user.id,
    },
    include: sanctionInclude,
  });

  if (BAN_SANCTIONS.includes(sanction.type as SanctionTypeValue)) {
    const remaining = await prisma.playerSanction.count({
      where: {
        playerId: sanction.playerId,
        revokedAt: null,
        type: { in: ["TEMP_BAN", "PERMANENT_BAN"] },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
    });

    const nextStatus = nextPlayerStatusAfterRevoke(
      sanction.player.status as PlayerStatusValue,
      remaining,
    );
    if (nextStatus !== sanction.player.status) {
      await prisma.player.update({
        where: { id: sanction.playerId },
        data: { status: nextStatus },
      });
    }
  }

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "sanction.revoke",
    targetType: "player_sanction",
    targetId: sanction.id,
    metadata: {
      player: sanction.player.displayName,
      type: sanction.type,
      revokeReason: body.revokeReason,
    },
  });

  return json({ sanction: serializePlayerSanction(updated) });
});
