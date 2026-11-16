import { api } from "@/server/api";
import { badRequest, forbidden, json, notFound } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { MAX_ATTACHMENT_BYTES, saveTaskAttachment } from "@/server/attachments";

async function loadTask(id: string) {
  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, code: true, title: true, assigneeId: true, creatorId: true },
  });
  if (!task) throw notFound("Tache introuvable");
  return task;
}

export const GET = api(async (_request, context) => {
  const { id } = await context.params;
  await requirePermission("tasks.view");
  await loadTask(id);

  const attachments = await prisma.taskAttachment.findMany({
    where: { taskId: id },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { id: true, displayName: true, avatarColor: true } } },
  });

  return json({
    attachments: attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      createdAt: attachment.createdAt.toISOString(),
      uploadedBy: attachment.uploadedBy,
    })),
  });
});

export const POST = api(async (request, context) => {
  const user = await requirePermission("tasks.edit");
  const { id } = await context.params;
  const task = await loadTask(id);

  const isAssignee = task.assigneeId === user.id;
  const canManage = hasPermission(user, "tasks.assign");
  if (!isAssignee && !canManage && task.creatorId !== user.id) {
    throw forbidden("Vous ne pouvez joindre des fichiers qu'aux taches que vous gerez.");
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_ATTACHMENT_BYTES + 1_000_000) {
    throw badRequest(`Fichier trop volumineux (limite ${Math.floor(MAX_ATTACHMENT_BYTES / (1024 * 1024))} Mo).`);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw badRequest("Formulaire multipart invalide.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Fichier requis (champ 'file').");

  const { attachment, sha256 } = await saveTaskAttachment({ taskId: id, userId: user.id, file });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "task.attachment.add",
    targetType: "task",
    targetId: id,
    metadata: {
      attachmentId: attachment.id,
      name: attachment.name,
      size: attachment.size,
      mimeType: attachment.mimeType,
      sha256,
      taskCode: task.code,
    },
  });

  return json(
    {
      attachment: {
        id: attachment.id,
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
        createdAt: attachment.createdAt.toISOString(),
        uploadedBy: attachment.uploadedBy,
      },
    },
    201,
  );
});
