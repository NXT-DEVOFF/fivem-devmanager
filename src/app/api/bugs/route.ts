import { z } from "zod";
import { api } from "@/server/api";
import { json, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { toStringArray } from "@/lib/json-array";
import { generateCode } from "@/server/codes";
import { audit } from "@/server/audit";
import { notify, notifyMany } from "@/server/notifications";
import { emitActivity } from "@/server/realtime";

const severitySchema = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);

export const GET = api(async (request) => {
  await requirePermission("bugs.view");
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const severity = params.get("severity");
  const assigneeId = params.get("assigneeId");
  const resource = params.get("resource");
  const search = params.get("q")?.trim();

  const bugs = await prisma.bug.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(severity ? { severity: severity as never } : {}),
      ...(assigneeId ? { assigneeId } : {}),
      ...(resource ? { resource } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search } },
              { code: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
    take: 300,
    include: {
      reporter: { select: { id: true, displayName: true, avatarColor: true } },
      assignee: { select: { id: true, displayName: true, avatarColor: true } },
      task: { select: { id: true, code: true } },
      _count: { select: { comments: true, changes: true } },
    },
  });

  return json({
    bugs: bugs.map((bug) => ({
      ...bug,
      screenshots: toStringArray(bug.screenshots),
      createdAt: bug.createdAt.toISOString(),
      updatedAt: bug.updatedAt.toISOString(),
      fixedAt: bug.fixedAt?.toISOString() ?? null,
      closedAt: bug.closedAt?.toISOString() ?? null,
      counts: bug._count,
    })),
  });
});

const createSchema = z.object({
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().min(10).max(10_000),
  severity: severitySchema.default("MEDIUM"),
  resource: z.string().trim().max(120).optional(),
  filePath: z.string().trim().max(500).optional(),
  reproduceSteps: z.string().max(5000).optional(),
  expectedResult: z.string().max(2000).optional(),
  actualResult: z.string().max(2000).optional(),
  logs: z.string().max(20_000).optional(),
  screenshots: z.array(z.string().url().max(500)).max(5).default([]),
  assigneeId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
});

export const POST = api(async (request) => {
  const user = await requirePermission("bugs.create");
  const body = await parseJson(request, createSchema);

  let code = await generateCode("BUG");
  let bug;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      bug = await prisma.bug.create({
        data: {
          code,
          title: body.title,
          description: body.description,
          severity: body.severity,
          resource: body.resource ?? null,
          filePath: body.filePath ?? null,
          reproduceSteps: body.reproduceSteps ?? null,
          expectedResult: body.expectedResult ?? null,
          actualResult: body.actualResult ?? null,
          logs: body.logs ?? null,
          screenshots: body.screenshots,
          reporterId: user.id,
          assigneeId: body.assigneeId ?? null,
          taskId: body.taskId ?? null,
        },
      });
      break;
    } catch (error) {
      if (attempt === 4) throw error;
      code = await generateCode("BUG");
    }
  }
  if (!bug) return json({ error: "Creation impossible" }, { status: 500 });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "bug.create",
    targetType: "bug",
    targetId: bug.id,
    metadata: { code: bug.code, severity: bug.severity },
  });

  emitActivity({
    type: "bug.reported",
    title: `Bug signale : ${bug.code}`,
    detail: bug.title,
    actor: { id: user.id, name: user.displayName },
    link: `/bugs/${bug.id}`,
    timestamp: new Date().toISOString(),
  });

  if (bug.assigneeId) {
    await notify(bug.assigneeId, {
      type: "bug.assigned",
      title: `Bug assigne : ${bug.code}`,
      body: bug.title,
      link: `/bugs/${bug.id}`,
    });
  } else {
    const leads = await prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN", "LEAD_DEV"] }, isActive: true },
      select: { id: true },
    });
    await notifyMany(
      leads.map((lead) => lead.id),
      {
        type: "bug.reported",
        title: `Nouveau bug : ${bug.code} (${bug.severity})`,
        body: bug.title,
        link: `/bugs/${bug.id}`,
      },
    );
  }

  return json({ bug: { ...bug, screenshots: toStringArray(bug.screenshots) } }, 201);
});
