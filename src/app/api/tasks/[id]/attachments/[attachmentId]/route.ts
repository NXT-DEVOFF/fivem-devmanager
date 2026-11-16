import { api } from "@/server/api";
import { forbidden, json, notFound } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { readTaskAttachment, removeTaskAttachmentFile } from "@/server/attachments";

async function loadAttachment(taskId: string, attachmentId: string) {
  const attachment = await prisma.taskAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      uploadedBy: { select: { id: true, displayName: true } },
      task: { select: { id: true, code: true, assigneeId: true, creatorId: true } },
    },
  });
  if (!attachment || attachment.taskId !== taskId) throw notFound("Piece jointe introuvable");
  return attachment;
}

function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export const GET = api(async (_request, context) => {
  await requirePermission("tasks.view");
  const { id, attachmentId } = await context.params;
  const attachment = await loadAttachment(id, attachmentId);

  const buffer = await readTaskAttachment(attachment.storageKey);
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(buffer.length),
      "Content-Disposition": contentDisposition(attachment.name),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export const DELETE = api(async (_request, context) => {
  const user = await requirePermission("tasks.edit");
  const { id, attachmentId } = await context.params;
  const attachment = await loadAttachment(id, attachmentId);

  const isUploader = attachment.uploadedById === user.id;
  const canManage = hasPermission(user, "tasks.assign");
  if (!isUploader && !canManage && attachment.task.creatorId !== user.id) {
    throw forbidden("Suppression de cette piece jointe non autorisee.");
  }

  await removeTaskAttachmentFile(attachment.storageKey);
  await prisma.taskAttachment.delete({ where: { id: attachment.id } });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "task.attachment.remove",
    targetType: "task",
    targetId: id,
    metadata: {
      attachmentId: attachment.id,
      name: attachment.name,
      size: attachment.size,
      taskCode: attachment.task.code,
    },
  });

  return json({ ok: true });
});
