import { z } from "zod";
import { api } from "@/server/api";
import { badRequest, json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { serializeSprint } from "@/lib/sprints";

const updateSchema = z
  .object({
    name: z.string().trim().min(3).max(120).optional(),
    goal: z.string().trim().max(4000).nullable().optional(),
    status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
  })
  .refine(
    (value) =>
      !value.startsAt ||
      !value.endsAt ||
      new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime(),
    { message: "La date de fin doit suivre la date de debut", path: ["endsAt"] },
  );

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

export const PATCH = api(async (request, context) => {
  const user = await requirePermission("sprints.manage");
  const { id } = await context.params;
  const body = await parseJson(request, updateSchema);

  const existing = await prisma.sprint.findUnique({ where: { id } });
  if (!existing) throw notFound("Sprint introuvable");

  const startsAt = body.startsAt ? new Date(body.startsAt) : existing.startsAt;
  const endsAt = body.endsAt ? new Date(body.endsAt) : existing.endsAt;
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw badRequest("La date de fin doit suivre la date de debut");
  }

  const now = new Date();
  const nextStatus = body.status ?? existing.status;
  const sprint = await prisma.sprint.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.goal !== undefined ? { goal: body.goal } : {}),
      ...(body.startsAt !== undefined ? { startsAt } : {}),
      ...(body.endsAt !== undefined ? { endsAt } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(nextStatus === "COMPLETED" && !existing.completedAt ? { completedAt: now } : {}),
      ...(nextStatus !== "COMPLETED" && existing.completedAt ? { completedAt: null } : {}),
    },
    include: sprintInclude,
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "sprint.update",
    targetType: "sprint",
    targetId: id,
    metadata: { fields: Object.keys(body), status: sprint.status },
  });

  return json({ sprint: serializeSprint(sprint) });
});
