import { z } from "zod";
import { api } from "@/server/api";
import { json, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { toStringArray } from "@/lib/json-array";
import { generateCode } from "@/server/codes";
import { audit } from "@/server/audit";
import { notify } from "@/server/notifications";

const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const categorySchema = z.enum([
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
]);

export const GET = api(async (request) => {
  await requirePermission("tasks.view");
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const assigneeId = params.get("assigneeId");
  const resource = params.get("resource");
  const search = params.get("q")?.trim();
  const scope = params.get("scope");

  const tasks = await prisma.task.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(assigneeId ? { assigneeId: assigneeId === "me" ? undefined : assigneeId } : {}),
      ...(resource ? { resource } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search } },
              { code: { contains: search } },
              { description: { contains: search } },
            ],
          }
        : {}),
      ...(scope === "mine" ? { assigneeId: (await requirePermission("tasks.view")).id } : {}),
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    take: 300,
    include: {
      assignee: { select: { id: true, displayName: true, avatarColor: true } },
      creator: { select: { id: true, displayName: true } },
      _count: { select: { comments: true, subtasks: true, fileChanges: true, checklist: true } },
      checklist: { select: { done: true } },
      parent: { select: { id: true, code: true } },
    },
  });

  return json({
    tasks: tasks.map((task) => ({
      id: task.id,
      code: task.code,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      category: task.category,
      resource: task.resource,
      sprintId: task.sprintId,
      files: toStringArray(task.files),
      tags: toStringArray(task.tags),
      assignee: task.assignee,
      creator: task.creator,
      parent: task.parent,
      dueDate: task.dueDate?.toISOString() ?? null,
      estimatedMinutes: task.estimatedMinutes,
      timeSpentSeconds: task.timeSpentSeconds,
      autoValidate: task.autoValidate,
      requiresReview: task.requiresReview,
      completedAt: task.completedAt?.toISOString() ?? null,
      validatedAt: task.validatedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      counts: task._count,
      checklistProgress: {
        done: task.checklist.filter((item) => item.done).length,
        total: task.checklist.length,
      },
    })),
  });
});

const createSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().max(10_000).optional(),
  status: z
    .enum(["BACKLOG", "TODO", "IN_PROGRESS", "TESTING", "REVIEW", "DONE", "BLOCKED"])
    .default("BACKLOG"),
  priority: prioritySchema.default("MEDIUM"),
  category: categorySchema.default("SCRIPT"),
  assigneeId: z.string().nullable().optional(),
  resource: z.string().trim().max(120).nullable().optional(),
  files: z.array(z.string().max(500)).max(50).default([]),
  tags: z.array(z.string().max(40)).max(15).default([]),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedMinutes: z.number().int().min(0).max(10_000).nullable().optional(),
  autoValidate: z.boolean().default(false),
  requiresReview: z.boolean().default(true),
  parentId: z.string().nullable().optional(),
  checklist: z.array(z.string().max(200)).max(30).default([]),
});

export const POST = api(async (request) => {
  const user = await requirePermission("tasks.create");
  const body = await parseJson(request, createSchema);

  if (body.assigneeId && body.assigneeId !== user.id && !hasPermission(user, "tasks.assign")) {
    return json({ error: "Permission tasks.assign requise", code: "forbidden" }, { status: 403 });
  }

  if (body.assigneeId) {
    const assignee = await prisma.user.findUnique({ where: { id: body.assigneeId } });
    if (!assignee || !assignee.isActive) {
      return json({ error: "Developpeur introuvable ou inactif", code: "invalid_assignee" }, { status: 400 });
    }
  }

  let code = await generateCode("DEV");
  let task;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      task = await prisma.task.create({
        data: {
          code,
          title: body.title,
          description: body.description ?? null,
          status: body.status,
          priority: body.priority,
          category: body.category,
          assigneeId: body.assigneeId ?? null,
          creatorId: user.id,
          resource: body.resource ?? null,
          files: body.files,
          tags: body.tags,
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          estimatedMinutes: body.estimatedMinutes ?? null,
          autoValidate: body.autoValidate,
          requiresReview: body.requiresReview,
          parentId: body.parentId ?? null,
          checklist: {
            create: (body.checklist ?? []).map((label, index) => ({ label, position: index })),
          },
          ...(body.status === "DONE" ? { completedAt: new Date() } : {}),
        },
      });
      break;
    } catch (error) {
      if (attempt === 4) throw error;
      code = await generateCode("DEV");
    }
  }

  if (!task) return json({ error: "Creation impossible" }, { status: 500 });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "task.create",
    targetType: "task",
    targetId: task.id,
    metadata: { code: task.code, title: task.title, status: task.status },
  });

  if (task.assigneeId && task.assigneeId !== user.id) {
    await notify(task.assigneeId, {
      type: "task.assigned",
      title: `Nouvelle tache : ${task.code}`,
      body: task.title,
      link: `/tasks/${task.id}`,
    });
  }

  return json({
    task: { ...task, files: toStringArray(task.files), tags: toStringArray(task.tags) },
  }, 201);
});
