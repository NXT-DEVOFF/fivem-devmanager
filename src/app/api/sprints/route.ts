import { z } from "zod";
import { api } from "@/server/api";
import { badRequest, json, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { serializeSprint } from "@/lib/sprints";

const createSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    goal: z.string().trim().max(4000).optional(),
    status: z.enum(["PLANNED", "ACTIVE"]).default("PLANNED"),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  })
  .refine((value) => new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime(), {
    message: "La date de fin doit suivre la date de debut",
    path: ["endsAt"],
  });

const sprintInclude = {
  createdBy: { select: { id: true, displayName: true } },
  tasks: {
    orderBy: [{ status: "asc" as const }, { priority: "desc" as const }],
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      priority: true,
      resource: true,
      assignee: { select: { id: true, displayName: true, avatarColor: true } },
    },
  },
};

export const GET = api(async () => {
  await requirePermission("sprints.view");
  const sprints = await prisma.sprint.findMany({
    orderBy: [{ startsAt: "desc" }],
    include: sprintInclude,
  });
  return json({ sprints: sprints.map(serializeSprint) });
});

export const POST = api(async (request) => {
  const user = await requirePermission("sprints.manage");
  const body = await parseJson(request, createSchema);
  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw badRequest("Dates de sprint invalides");
  }

  const sprint = await prisma.sprint.create({
    data: {
      name: body.name,
      goal: body.goal ?? null,
      status: body.status,
      startsAt,
      endsAt,
      createdById: user.id,
    },
    include: sprintInclude,
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "sprint.create",
    targetType: "sprint",
    targetId: sprint.id,
    metadata: { name: sprint.name, status: sprint.status },
  });

  return json({ sprint: serializeSprint(sprint) }, 201);
});
