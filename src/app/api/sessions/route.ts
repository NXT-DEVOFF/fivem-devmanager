import { z } from "zod";
import { api } from "@/server/api";
import { json, parseDateParam, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { computeActiveSeconds, computeDurationSeconds } from "@/server/session-time";
import { startSession, getActiveSession } from "@/server/sessions";

export const GET = api(async (request) => {
  const user = await requirePermission("sessions.view.own");
  const params = new URL(request.url).searchParams;
  const scope = params.get("scope") === "all" && hasPermission(user, "sessions.view.all") ? "all" : "own";
  const status = params.get("status");
  const userId = params.get("userId");
  const from = parseDateParam(params.get("from"), "from");
  const to = parseDateParam(params.get("to"), "to");
  const limit = Math.min(Number(params.get("limit") ?? 50) || 50, 200);

  const sessions = await prisma.devSession.findMany({
    where: {
      ...(scope === "own" ? { userId: user.id } : {}),
      ...(userId && scope === "all" ? { userId } : {}),
      ...(status ? { status: status as never } : {}),
      ...(from || to
        ? {
            startedAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, displayName: true, avatarColor: true } },
      tasks: { select: { id: true, code: true, title: true, status: true } },
      _count: { select: { fileChanges: true, events: true } },
      report: { select: { id: true, number: true } },
    },
  });

  const now = new Date();
  return json({
    scope,
    sessions: sessions.map((session) => ({
      id: session.id,
      number: session.number,
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      durationSeconds: computeDurationSeconds(session, now),
      activeSeconds: computeActiveSeconds(session, now),
      user: session.user,
      tasks: session.tasks,
      fileChangeCount: session._count.fileChanges,
      summary: session.summary,
      reportId: session.report?.id ?? null,
      reportNumber: session.report?.number ?? null,
    })),
    active: await getActiveSession(user.id),
  });
});

const startSchema = z.object({
  taskIds: z.array(z.string()).max(15).default([]),
  idleTimeoutMinutes: z.number().int().min(1).max(180).optional(),
  resourceNames: z.array(z.string().max(120)).max(20).optional(),
});

export const POST = api(async (request) => {
  const user = await requirePermission("sessions.start");
  const body = await parseJson(request, startSchema);

  const session = await startSession({
    user,
    taskIds: body.taskIds ?? [],
    idleTimeoutMinutes: body.idleTimeoutMinutes,
    resourceNames: body.resourceNames ?? [],
  });

  return json({ session }, 201);
});
