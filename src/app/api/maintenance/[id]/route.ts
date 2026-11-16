import { z } from "zod";
import { api } from "@/server/api";
import { badRequest, json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { serializeMaintenanceWindow } from "@/lib/maintenance";

const updateSchema = z.object({
  title: z.string().trim().min(5).max(200).optional(),
  description: z.string().trim().min(10).max(10_000).optional(),
  scope: z.string().trim().max(120).nullable().optional(),
  impact: z.string().trim().max(4000).nullable().optional(),
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELED"]).optional(),
  scheduledStart: z.coerce.date().optional(),
  scheduledEnd: z.coerce.date().optional(),
  cancelReason: z.string().trim().max(4000).nullable().optional(),
});

const include = {
  createdBy: { select: { id: true, displayName: true, avatarColor: true } },
} as const;

export const PATCH = api(async (request, context) => {
  const user = await requirePermission("maintenance.manage");
  const { id } = await context.params;
  const body = await parseJson(request, updateSchema);

  const existing = await prisma.maintenanceWindow.findUnique({ where: { id } });
  if (!existing) throw notFound("Fenetre de maintenance introuvable");

  const nextStart = body.scheduledStart ?? existing.scheduledStart;
  const nextEnd = body.scheduledEnd ?? existing.scheduledEnd;
  if (nextEnd <= nextStart) {
    throw badRequest("La fin de la maintenance doit etre posterieure au debut");
  }

  const nextStatus = body.status ?? existing.status;
  const statusChanged = body.status !== undefined && body.status !== existing.status;
  const nextCancelReason =
    body.cancelReason !== undefined ? body.cancelReason : existing.cancelReason;
  if (nextStatus === "CANCELED" && !nextCancelReason?.trim()) {
    throw badRequest("Renseignez le motif d'annulation");
  }

  const now = new Date();
  const window = await prisma.maintenanceWindow.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.scope !== undefined ? { scope: body.scope } : {}),
      ...(body.impact !== undefined ? { impact: body.impact } : {}),
      ...(body.scheduledStart !== undefined ? { scheduledStart: body.scheduledStart } : {}),
      ...(body.scheduledEnd !== undefined ? { scheduledEnd: body.scheduledEnd } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.cancelReason !== undefined && nextStatus === "CANCELED"
        ? { cancelReason: body.cancelReason }
        : {}),
      ...(statusChanged && nextStatus === "PLANNED"
        ? {
            startedAt: null,
            completedAt: null,
            canceledAt: null,
            cancelReason: null,
          }
        : {}),
      ...(statusChanged && nextStatus === "IN_PROGRESS"
        ? {
            startedAt: existing.startedAt ?? now,
            completedAt: null,
            canceledAt: null,
            cancelReason: null,
          }
        : {}),
      ...(statusChanged && nextStatus === "COMPLETED"
        ? {
            startedAt: existing.startedAt ?? now,
            completedAt: now,
            canceledAt: null,
            cancelReason: null,
          }
        : {}),
      ...(statusChanged && nextStatus === "CANCELED"
        ? {
            completedAt: null,
            canceledAt: now,
          }
        : {}),
    },
    include,
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "maintenance.update",
    targetType: "maintenance",
    targetId: window.id,
    metadata: {
      title: window.title,
      fields: Object.keys(body),
      status: window.status,
    },
  });

  return json({ window: serializeMaintenanceWindow(window) });
});
