import { z } from "zod";
import { api } from "@/server/api";
import { badRequest, json, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import {
  EVENT_STATUS,
  buildEventSummary,
  serializeServerEvent,
  type EventStatusValue,
} from "@/lib/events";

const createSchema = z.object({
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().min(10).max(10_000),
  category: z.string().trim().min(1).max(60).default("Communaute"),
  location: z.string().trim().max(120).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  maxPlayers: z.number().int().min(1).max(1024).nullable().optional(),
  reward: z.string().trim().max(160).optional(),
  requirements: z.string().trim().max(4000).optional(),
  status: z.enum(["DRAFT", "PLANNED", "OPEN"]).default("PLANNED"),
});

const organizerSelect = {
  select: { id: true, displayName: true, avatarColor: true },
} as const;

export const GET = api(async (request) => {
  await requirePermission("events.view");
  const params = new URL(request.url).searchParams;
  const search = params.get("q")?.trim();
  const statusParam = params.get("status")?.trim();
  const status =
    statusParam && Object.prototype.hasOwnProperty.call(EVENT_STATUS, statusParam)
      ? (statusParam as EventStatusValue)
      : undefined;

  const events = await prisma.serverEvent.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search } },
              { description: { contains: search } },
              { category: { contains: search } },
              { location: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: [{ startsAt: "desc" }],
    take: 500,
    include: { organizer: organizerSelect },
  });

  const serialized = events.map(serializeServerEvent);
  return json({ events: serialized, summary: buildEventSummary(serialized) });
});

export const POST = api(async (request) => {
  const user = await requirePermission("events.manage");
  const body = await parseJson(request, createSchema);

  if (body.endsAt <= body.startsAt) {
    throw badRequest("La fin de l'evenement doit etre posterieure au debut");
  }

  const event = await prisma.serverEvent.create({
    data: {
      title: body.title,
      description: body.description,
      category: body.category,
      location: body.location?.trim() || null,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      maxPlayers: body.maxPlayers ?? null,
      reward: body.reward?.trim() || null,
      requirements: body.requirements?.trim() || null,
      status: body.status,
      organizerId: user.id,
    },
    include: { organizer: organizerSelect },
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "event.create",
    targetType: "server_event",
    targetId: event.id,
    metadata: {
      title: event.title,
      category: event.category,
      startsAt: event.startsAt.toISOString(),
    },
  });

  return json({ event: serializeServerEvent(event) }, 201);
});
