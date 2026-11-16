import { z } from "zod";
import { api } from "@/server/api";
import { badRequest, json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { serializeServerEvent } from "@/lib/events";

const updateSchema = z.object({
  title: z.string().trim().min(5).max(160).optional(),
  description: z.string().trim().min(10).max(10_000).optional(),
  category: z.string().trim().min(1).max(60).optional(),
  location: z.string().trim().max(120).nullable().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  maxPlayers: z.number().int().min(1).max(1024).nullable().optional(),
  reward: z.string().trim().max(160).nullable().optional(),
  requirements: z.string().trim().max(4000).nullable().optional(),
  status: z
    .enum(["DRAFT", "PLANNED", "OPEN", "IN_PROGRESS", "COMPLETED", "CANCELED"])
    .optional(),
  cancelReason: z.string().trim().max(4000).nullable().optional(),
});

const organizerSelect = {
  select: { id: true, displayName: true, avatarColor: true },
} as const;

export const GET = api(async (_request, context) => {
  await requirePermission("events.view");
  const { id } = await context.params;

  const event = await prisma.serverEvent.findUnique({
    where: { id },
    include: { organizer: organizerSelect },
  });
  if (!event) throw notFound("Evenement introuvable");

  return json({ event: serializeServerEvent(event) });
});

export const PATCH = api(async (request, context) => {
  const user = await requirePermission("events.manage");
  const { id } = await context.params;
  const body = await parseJson(request, updateSchema);

  const existing = await prisma.serverEvent.findUnique({ where: { id } });
  if (!existing) throw notFound("Evenement introuvable");

  const nextStart = body.startsAt ?? existing.startsAt;
  const nextEnd = body.endsAt ?? existing.endsAt;
  if (nextEnd <= nextStart) {
    throw badRequest("La fin de l'evenement doit etre posterieure au debut");
  }

  const nextStatus = body.status ?? existing.status;
  const statusChanged = body.status !== undefined && body.status !== existing.status;
  const nextCancelReason =
    body.cancelReason !== undefined ? body.cancelReason : existing.cancelReason;
  if (nextStatus === "CANCELED" && !nextCancelReason?.trim()) {
    throw badRequest("Renseignez le motif d'annulation");
  }

  const now = new Date();
  const event = await prisma.serverEvent.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.location !== undefined ? { location: body.location || null } : {}),
      ...(body.startsAt !== undefined ? { startsAt: body.startsAt } : {}),
      ...(body.endsAt !== undefined ? { endsAt: body.endsAt } : {}),
      ...(body.maxPlayers !== undefined ? { maxPlayers: body.maxPlayers } : {}),
      ...(body.reward !== undefined ? { reward: body.reward || null } : {}),
      ...(body.requirements !== undefined
        ? { requirements: body.requirements || null }
        : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.cancelReason !== undefined && nextStatus === "CANCELED"
        ? { cancelReason: body.cancelReason }
        : {}),
      ...(statusChanged && (nextStatus === "DRAFT" || nextStatus === "PLANNED")
        ? { startedAt: null, completedAt: null, canceledAt: null, cancelReason: null }
        : {}),
      ...(statusChanged && nextStatus === "OPEN"
        ? { startedAt: null, completedAt: null, canceledAt: null, cancelReason: null }
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
        ? { completedAt: null, canceledAt: now }
        : {}),
    },
    include: { organizer: organizerSelect },
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "event.update",
    targetType: "server_event",
    targetId: event.id,
    metadata: {
      title: event.title,
      status: event.status,
      fields: Object.keys(body),
    },
  });

  return json({ event: serializeServerEvent(event) });
});

export const DELETE = api(async (_request, context) => {
  const user = await requirePermission("events.manage");
  const { id } = await context.params;

  const existing = await prisma.serverEvent.findUnique({ where: { id } });
  if (!existing) throw notFound("Evenement introuvable");

  await prisma.serverEvent.delete({ where: { id } });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "event.delete",
    targetType: "server_event",
    targetId: id,
    metadata: { title: existing.title, category: existing.category },
  });

  return json({ ok: true });
});
