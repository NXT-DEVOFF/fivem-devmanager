import { z } from "zod";
import { api } from "@/server/api";
import { badRequest, json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { serializeAnticheatEvent } from "@/lib/anticheat";

const updateSchema = z.object({
  status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED", "FALSE_POSITIVE"]),
  resolution: z.string().trim().max(2000).optional(),
});

const personSelect = {
  select: { id: true, displayName: true, avatarColor: true },
} as const;

const eventInclude = {
  acknowledgedBy: personSelect,
  resolvedBy: personSelect,
} as const;

export const PATCH = api(async (request, context) => {
  const user = await requirePermission("anticheat.manage");
  const { id } = await context.params;
  const body = await parseJson(request, updateSchema);

  const existing = await prisma.anticheatEvent.findUnique({ where: { id } });
  if (!existing) throw notFound("Alerte anticheat introuvable");

  const resolving = body.status === "RESOLVED" || body.status === "FALSE_POSITIVE";
  if (resolving && (body.resolution?.length ?? 0) < 5) {
    throw badRequest("Une note de resolution de 5 caracteres minimum est requise");
  }

  const now = new Date();
  const data: {
    status: typeof body.status;
    resolution?: string | null;
    acknowledgedAt?: Date | null;
    acknowledgedById?: string | null;
    resolvedAt?: Date | null;
    resolvedById?: string | null;
  } = { status: body.status };

  if (body.status === "OPEN") {
    data.acknowledgedAt = null;
    data.acknowledgedById = null;
    data.resolvedAt = null;
    data.resolvedById = null;
    data.resolution = null;
  }

  if (body.status === "ACKNOWLEDGED") {
    data.acknowledgedAt = existing.acknowledgedAt ?? now;
    data.acknowledgedById = existing.acknowledgedById ?? user.id;
    data.resolvedAt = null;
    data.resolvedById = null;
    data.resolution = null;
  }

  if (resolving) {
    data.acknowledgedAt = existing.acknowledgedAt ?? now;
    data.acknowledgedById = existing.acknowledgedById ?? user.id;
    data.resolvedAt = now;
    data.resolvedById = user.id;
    data.resolution = body.resolution!.slice(0, 2000);
  }

  const updated = await prisma.anticheatEvent.update({
    where: { id },
    data,
    include: eventInclude,
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action:
      body.status === "ACKNOWLEDGED"
        ? "anticheat.acknowledge"
        : body.status === "OPEN"
          ? "anticheat.reopen"
          : "anticheat.resolve",
    targetType: "anticheat_event",
    targetId: updated.id,
    metadata: {
      detection: updated.detection,
      severity: updated.severity,
      status: updated.status,
      playerLicense: updated.playerLicense,
    },
  });

  return json({ event: serializeAnticheatEvent(updated) });
});
