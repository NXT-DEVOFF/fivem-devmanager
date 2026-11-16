import { z } from "zod";
import { api } from "@/server/api";
import { badRequest, json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";

const taskSchema = z.object({ taskId: z.string().min(1) });

async function getSprintAndTask(sprintId: string, taskId: string) {
  const [sprint, task] = await Promise.all([
    prisma.sprint.findUnique({ where: { id: sprintId }, select: { id: true, name: true } }),
    prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, code: true, sprintId: true },
    }),
  ]);
  if (!sprint) throw notFound("Sprint introuvable");
  if (!task) throw notFound("Tache introuvable");
  return { sprint, task };
}

export const POST = api(async (request, context) => {
  const user = await requirePermission("sprints.manage");
  const { id } = await context.params;
  const body = await parseJson(request, taskSchema);
  const { sprint, task } = await getSprintAndTask(id, body.taskId);
  if (task.sprintId && task.sprintId !== id) {
    throw badRequest("Cette tache appartient deja a un autre sprint");
  }

  await prisma.task.update({ where: { id: task.id }, data: { sprintId: id } });
  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "sprint.task.add",
    targetType: "sprint",
    targetId: id,
    metadata: { taskCode: task.code, sprint: sprint.name },
  });

  return json({ ok: true });
});

export const DELETE = api(async (request, context) => {
  const user = await requirePermission("sprints.manage");
  const { id } = await context.params;
  const body = await parseJson(request, taskSchema);
  const { sprint, task } = await getSprintAndTask(id, body.taskId);
  if (task.sprintId !== id) throw badRequest("Cette tache n'appartient pas a ce sprint");

  await prisma.task.update({ where: { id: task.id }, data: { sprintId: null } });
  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "sprint.task.remove",
    targetType: "sprint",
    targetId: id,
    metadata: { taskCode: task.code, sprint: sprint.name },
  });

  return json({ ok: true });
});
