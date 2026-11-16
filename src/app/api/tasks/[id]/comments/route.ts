import { z } from "zod";
import { api } from "@/server/api";
import { json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { notify } from "@/server/notifications";

const schema = z.object({ body: z.string().trim().min(1).max(5000) });

export const POST = api(async (request, context) => {
  const user = await requirePermission("tasks.view");
  const { id } = await context.params;
  const body = await parseJson(request, schema);

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw notFound("Tache introuvable");

  const comment = await prisma.taskComment.create({
    data: { taskId: id, authorId: user.id, body: body.body },
    include: { author: { select: { id: true, displayName: true, avatarColor: true } } },
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "task.comment",
    targetType: "task",
    targetId: id,
    metadata: { length: body.body.length },
  });

  if (task.assigneeId && task.assigneeId !== user.id) {
    await notify(task.assigneeId, {
      type: "task.comment",
      title: `Nouveau commentaire : ${task.code}`,
      body: body.body.slice(0, 200),
      link: `/tasks/${id}`,
    });
  }

  return json({ comment: { ...comment, createdAt: comment.createdAt.toISOString() } }, 201);
});
