import { z } from "zod";
import { api } from "@/server/api";
import { forbidden, json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { toStringArray } from "@/lib/json-array";
import { audit } from "@/server/audit";
import { notify } from "@/server/notifications";
import { evaluateTaskReadiness } from "@/server/changes";

const updateSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().max(10_000).nullable().optional(),
  status: z
    .enum(["BACKLOG", "TODO", "IN_PROGRESS", "TESTING", "REVIEW", "DONE", "BLOCKED"])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  category: z
    .enum([
      "SCRIPT",
      "UI",
      "MAPPING",
      "VEHICLES",
      "OPTIMIZATION",
      "DATABASE",
      "CONFIG",
      "SECURITY",
      "BUGFIX",
      "GAMEPLAY",
      "ADMINISTRATION",
    ])
    .optional(),
  assigneeId: z.string().nullable().optional(),
  resource: z.string().max(120).nullable().optional(),
  files: z.array(z.string().max(500)).max(50).optional(),
  tags: z.array(z.string().max(40)).max(15).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedMinutes: z.number().int().min(0).max(10_000).nullable().optional(),
  autoValidate: z.boolean().optional(),
  requiresReview: z.boolean().optional(),
  checklist: z
    .array(z.object({ id: z.string().optional(), label: z.string().min(1).max(200), done: z.boolean().default(false) }))
    .max(50)
    .optional(),
});

export const GET = api(async (_request, context) => {
  await requirePermission("tasks.view");
  const { id } = await context.params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, displayName: true, avatarColor: true, email: true } },
      creator: { select: { id: true, displayName: true } },
      subtasks: { select: { id: true, code: true, title: true, status: true } },
      checklist: { orderBy: { position: "asc" } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, displayName: true, avatarColor: true } } },
      },
      attachments: {
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { id: true, displayName: true, avatarColor: true } } },
      },
      fileChanges: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { displayName: true } } },
      },
      dependencies: { include: { dependsOn: { select: { id: true, code: true, title: true, status: true } } } },
      dependents: { include: { task: { select: { id: true, code: true, title: true, status: true } } } },
      sessions: { select: { id: true, number: true, startedAt: true, status: true }, take: 10 },
    },
  });
  if (!task) throw notFound("Tache introuvable");

  const readiness = await evaluateTaskReadiness(task.id);

  return json({
    task: {
      ...task,
      files: toStringArray(task.files),
      tags: toStringArray(task.tags),
      dueDate: task.dueDate?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      validatedAt: task.validatedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      comments: task.comments.map((comment) => ({
        ...comment,
        createdAt: comment.createdAt.toISOString(),
      })),
      fileChanges: task.fileChanges.map((change) => ({
        ...change,
        createdAt: change.createdAt.toISOString(),
      })),
      sessions: task.sessions.map((session) => ({
        ...session,
        startedAt: session.startedAt.toISOString(),
      })),
    },
    readiness,
  });
});

export const PATCH = api(async (request, context) => {
  const user = await requirePermission("tasks.edit");
  const { id } = await context.params;
  const body = await parseJson(request, updateSchema);

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) throw notFound("Tache introuvable");

  const isAssignee = existing.assigneeId === user.id;
  const canManage = hasPermission(user, "tasks.assign");
  if (!isAssignee && !canManage && existing.creatorId !== user.id) {
    throw forbidden("Vous ne pouvez modifier que vos taches");
  }
  if (body.assigneeId !== undefined && !canManage) {
    throw forbidden("Permission tasks.assign requise");
  }
  if (body.status === "DONE" && !hasPermission(user, "tasks.validate") && !isAssignee) {
    throw forbidden("Permission tasks.validate requise");
  }

  const statusChanged = body.status !== undefined && body.status !== existing.status;
  const now = new Date();

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.assigneeId !== undefined ? { assigneeId: body.assigneeId } : {}),
      ...(body.resource !== undefined ? { resource: body.resource } : {}),
      ...(body.files !== undefined ? { files: body.files } : {}),
      ...(body.tags !== undefined ? { tags: body.tags } : {}),
      ...(body.dueDate !== undefined ? { dueDate: body.dueDate ? new Date(body.dueDate) : null } : {}),
      ...(body.estimatedMinutes !== undefined ? { estimatedMinutes: body.estimatedMinutes } : {}),
      ...(body.autoValidate !== undefined ? { autoValidate: body.autoValidate } : {}),
      ...(body.requiresReview !== undefined ? { requiresReview: body.requiresReview } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(statusChanged && body.status === "DONE" && !existing.completedAt
        ? { completedAt: now }
        : {}),
      ...(statusChanged && body.status !== "DONE" ? { completedAt: null } : {}),
      ...(body.checklist
        ? {
            checklist: {
              deleteMany: {},
              create: body.checklist.map((item, index) => ({
                label: item.label,
                done: item.done,
                position: index,
              })),
            },
          }
        : {}),
    },
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "task.update",
    targetType: "task",
    targetId: id,
    metadata: { fields: Object.keys(body), status: body.status },
  });

  if (task.assigneeId && task.assigneeId !== user.id && body.assigneeId) {
    await notify(task.assigneeId, {
      type: "task.assigned",
      title: `Tache assignee : ${task.code}`,
      body: task.title,
      link: `/tasks/${task.id}`,
    });
  }

  return json({
    task: { ...task, files: toStringArray(task.files), tags: toStringArray(task.tags) },
  });
});

export const DELETE = api(async (_request, context) => {
  const user = await requirePermission("tasks.delete");
  const { id } = await context.params;

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw notFound("Tache introuvable");

  await prisma.task.delete({ where: { id } });
  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "task.delete",
    targetType: "task",
    targetId: id,
    metadata: { code: task.code, title: task.title },
  });

  return json({ ok: true });
});
