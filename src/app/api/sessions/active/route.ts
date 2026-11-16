import { api } from "@/server/api";
import { json } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { computeActiveSeconds, computeDurationSeconds, isIdle } from "@/server/session-time";

export const GET = api(async () => {
  const user = await requirePermission("sessions.view.own");

  const session = await prisma.devSession.findFirst({
    where: { userId: user.id, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { startedAt: "desc" },
    include: {
      tasks: { select: { id: true, code: true, title: true, status: true, timeSpentSeconds: true } },
      events: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!session) return json({ session: null });

  const now = new Date();
  return json({
    session: {
      id: session.id,
      number: session.number,
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      currentTaskId: session.currentTaskId,
      idleTimeoutMinutes: session.idleTimeoutMinutes,
      tasks: session.tasks,
      activeSeconds: computeActiveSeconds(session, now),
      durationSeconds: computeDurationSeconds(session, now),
      idle: isIdle(session, now),
      serverTime: now.toISOString(),
      notes: session.events
        .filter((event) => event.type === "NOTE")
        .map((event) => ({ id: event.id, message: event.message, at: event.createdAt.toISOString() })),
    },
  });
});
