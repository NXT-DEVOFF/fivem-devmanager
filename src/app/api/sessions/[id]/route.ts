import { z } from "zod";
import { api } from "@/server/api";
import { forbidden, json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { computeActiveSeconds, computeDurationSeconds, isIdle } from "@/server/session-time";
import { addSessionNote, endSession, pauseSession, resumeSession, switchTask } from "@/server/sessions";

async function loadAuthorized(id: string, user: Awaited<ReturnType<typeof requirePermission>>) {
  const session = await prisma.devSession.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, displayName: true, email: true, avatarColor: true } },
      tasks: { select: { id: true, code: true, title: true, status: true, timeSpentSeconds: true } },
      events: { orderBy: { createdAt: "asc" }, take: 500 },
      report: { select: { id: true, number: true } },
      fileChanges: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { user: { select: { displayName: true } }, task: { select: { code: true } } },
      },
    },
  });
  if (!session) throw notFound("Session introuvable");
  if (session.userId !== user.id && !hasPermission(user, "sessions.view.all")) {
    throw forbidden("Acces a cette session non autorise");
  }
  return session;
}

export const GET = api(async (_request, context) => {
  const user = await requirePermission("sessions.view.own");
  const { id } = await context.params;
  const session = await loadAuthorized(id, user);

  const now = new Date();
  return json({
    session: {
      ...session,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      lastResumedAt: session.lastResumedAt?.toISOString() ?? null,
      lastActivityAt: session.lastActivityAt.toISOString(),
      idleWarningSentAt: session.idleWarningSentAt?.toISOString() ?? null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      durationSeconds: computeDurationSeconds(session, now),
      activeSeconds: computeActiveSeconds(session, now),
      idle: isIdle(session, now),
      events: session.events.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
      fileChanges: session.fileChanges.map((change) => ({
        id: change.id,
        path: change.path,
        resource: change.resource,
        changeType: change.changeType,
        createdAt: change.createdAt.toISOString(),
        user: change.user?.displayName ?? null,
        taskCode: change.task?.code ?? null,
      })),
    },
  });
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pause"), reason: z.string().max(300).optional() }),
  z.object({ action: z.literal("resume") }),
  z.object({
    action: z.literal("end"),
    summary: z.string().max(2000).optional(),
    notes: z.string().max(5000).optional(),
  }),
  z.object({ action: z.literal("note"), message: z.string().min(1).max(2000) }),
  z.object({ action: z.literal("switch-task"), taskId: z.string().min(1) }),
  z.object({ action: z.literal("idle-ack") }),
]);

export const PATCH = api(async (request, context) => {
  const user = await requirePermission("sessions.view.own");
  const { id } = await context.params;
  const body = await parseJson(request, actionSchema);

  switch (body.action) {
    case "pause":
      return json({ session: await pauseSession(id, user, body.reason) });
    case "resume":
      return json({ session: await resumeSession(id, user) });
    case "end": {
      const result = await endSession({
        sessionId: id,
        user,
        summary: body.summary,
        notes: body.notes,
      });
      return json({
        session: result.session,
        reportId: result.report?.id ?? null,
        reportNumber: result.report?.number ?? null,
      });
    }
    case "note":
      return json({ event: await addSessionNote({ sessionId: id, user, message: body.message }) });
    case "switch-task":
      return json({ session: await switchTask({ sessionId: id, user, taskId: body.taskId }) });
    case "idle-ack": {
      await prisma.devSession.update({
        where: { id },
        data: {
          lastActivityAt: new Date(),
          idleWarningSentAt: null,
          events: {
            create: {
              userId: user.id,
              type: "IDLE_ACK",
              message: "Le developpeur confirme son temps de travail",
            },
          },
        },
      });
      return json({ ok: true });
    }
    default:
      return json({ error: "Action inconnue" }, { status: 400 });
  }
});
