import { z } from "zod";
import { api } from "@/server/api";
import { conflict, json, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import {
  PLAYER_STATUS,
  buildPlayersSummary,
  serializePlayer,
  type PlayerStatusValue,
} from "@/lib/players";

const playerStatusSchema = z.enum(["ACTIVE", "WATCHED", "SUSPENDED", "BANNED"]);

const createSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  license: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[A-Za-z0-9:_-]+$/, "Licence invalide (lettres, chiffres, :, _ et - uniquement)"),
  discordId: z.string().trim().max(40).optional(),
  steamHex: z.string().trim().max(60).optional(),
  status: playerStatusSchema.default("ACTIVE"),
  notes: z.string().trim().max(5000).optional(),
});

const personSelect = {
  select: { id: true, displayName: true, avatarColor: true },
} as const;

const sanctionInclude = {
  issuedBy: personSelect,
  revokedBy: personSelect,
} as const;

const playerInclude = {
  createdBy: personSelect,
  sanctions: { orderBy: { createdAt: "desc" as const }, include: sanctionInclude },
} as const;

export const GET = api(async (request) => {
  await requirePermission("players.view");
  const params = new URL(request.url).searchParams;
  const search = params.get("q")?.trim();
  const statusParam = params.get("status")?.trim();
  const status =
    statusParam && Object.prototype.hasOwnProperty.call(PLAYER_STATUS, statusParam)
      ? (statusParam as PlayerStatusValue)
      : undefined;

  const players = await prisma.player.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { displayName: { contains: search } },
              { license: { contains: search } },
              { discordId: { contains: search } },
              { steamHex: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 500,
    include: playerInclude,
  });

  const serialized = players.map(serializePlayer);
  return json({ players: serialized, summary: buildPlayersSummary(serialized) });
});

export const POST = api(async (request) => {
  const user = await requirePermission("players.manage");
  const body = await parseJson(request, createSchema);

  const duplicate = await prisma.player.findUnique({ where: { license: body.license } });
  if (duplicate) throw conflict("Cette licence est deja enregistree");

  const player = await prisma.player.create({
    data: {
      displayName: body.displayName,
      license: body.license,
      discordId: body.discordId?.trim() || null,
      steamHex: body.steamHex?.trim() || null,
      status: body.status,
      notes: body.notes?.trim() || null,
      createdById: user.id,
    },
    include: playerInclude,
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "player.create",
    targetType: "player",
    targetId: player.id,
    metadata: { displayName: player.displayName, license: player.license },
  });

  return json({ player: serializePlayer(player) }, 201);
});
