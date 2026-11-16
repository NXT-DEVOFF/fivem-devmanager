import { z } from "zod";
import { api } from "@/server/api";
import { conflict, json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { serializePlayer } from "@/lib/players";

const updateSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  license: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[A-Za-z0-9:_-]+$/, "Licence invalide (lettres, chiffres, :, _ et - uniquement)")
    .optional(),
  discordId: z.string().trim().max(40).nullable().optional(),
  steamHex: z.string().trim().max(60).nullable().optional(),
  status: z.enum(["ACTIVE", "WATCHED", "SUSPENDED", "BANNED"]).optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

const personSelect = {
  select: { id: true, displayName: true, avatarColor: true },
} as const;

const playerInclude = {
  createdBy: personSelect,
  sanctions: {
    orderBy: { createdAt: "desc" as const },
    include: { issuedBy: personSelect, revokedBy: personSelect },
  },
} as const;

export const GET = api(async (_request, context) => {
  await requirePermission("players.view");
  const { id } = await context.params;

  const player = await prisma.player.findUnique({ where: { id }, include: playerInclude });
  if (!player) throw notFound("Joueur introuvable");

  return json({ player: serializePlayer(player) });
});

export const PATCH = api(async (request, context) => {
  const user = await requirePermission("players.manage");
  const { id } = await context.params;
  const body = await parseJson(request, updateSchema);

  const existing = await prisma.player.findUnique({ where: { id } });
  if (!existing) throw notFound("Joueur introuvable");

  if (body.license && body.license !== existing.license) {
    const duplicate = await prisma.player.findUnique({ where: { license: body.license } });
    if (duplicate && duplicate.id !== id) {
      throw conflict("Cette licence est deja enregistree");
    }
  }

  const player = await prisma.player.update({
    where: { id },
    data: {
      ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
      ...(body.license !== undefined ? { license: body.license } : {}),
      ...(body.discordId !== undefined ? { discordId: body.discordId || null } : {}),
      ...(body.steamHex !== undefined ? { steamHex: body.steamHex || null } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
    },
    include: playerInclude,
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "player.update",
    targetType: "player",
    targetId: player.id,
    metadata: { displayName: player.displayName, fields: Object.keys(body) },
  });

  return json({ player: serializePlayer(player) });
});

export const DELETE = api(async (_request, context) => {
  const user = await requirePermission("players.manage");
  const { id } = await context.params;

  const existing = await prisma.player.findUnique({ where: { id } });
  if (!existing) throw notFound("Joueur introuvable");

  await prisma.player.delete({ where: { id } });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "player.delete",
    targetType: "player",
    targetId: id,
    metadata: { displayName: existing.displayName, license: existing.license },
  });

  return json({ ok: true });
});
