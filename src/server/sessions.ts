/**
 * Cycle de vie des sessions de developpement.
 * Le temps est TOUJOURS calcule cote serveur a partir des timestamps.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { HttpError, conflict, forbidden, notFound } from "@/server/http";
import type { AuthUser } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { computeActiveSeconds, computeDurationSeconds, isIdle } from "@/server/session-time";
import { emitActivity } from "@/server/realtime";
import { notifyMany } from "@/server/notifications";
import { audit } from "@/server/audit";
import { generateSessionReport } from "@/server/reports";
import { getSettings } from "@/server/settings";

export async function getActiveSession(userId: string) {
  return prisma.devSession.findFirst({
    where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { startedAt: "desc" },
    include: { tasks: { select: { id: true, code: true, title: true, status: true } } },
  });
}

export async function startSession(input: {
  user: AuthUser;
  taskIds: string[];
  idleTimeoutMinutes?: number;
  resourceNames?: string[];
}) {
  const existing = await getActiveSession(input.user.id);
  if (existing) {
    throw conflict("Une session est deja active. Terminez-la avant d'en demarrer une nouvelle.");
  }

  const settings = await getSettings();
  const idleTimeoutMinutes =
    input.idleTimeoutMinutes && input.idleTimeoutMinutes >= 1
      ? Math.min(input.idleTimeoutMinutes, 180)
      : settings.defaultIdleMinutes;

  const tasks = input.taskIds.length
    ? await prisma.task.findMany({ where: { id: { in: input.taskIds } } })
    : [];

  if (input.taskIds.length !== tasks.length) {
    throw new HttpError(400, "Une ou plusieurs taches sont introuvables", "invalid_tasks");
  }

  // Un developpeur ne peut pas demarrer une session sur une tache non assignee
  // sauf s'il peut attribuer des taches.
  const canAssign = hasPermission(input.user, "tasks.assign");
  for (const task of tasks) {
    if (!canAssign && task.assigneeId && task.assigneeId !== input.user.id) {
      throw forbidden(`La tache ${task.code} est assignee a un autre developpeur`);
    }
    if (!canAssign && !task.assigneeId) {
      await prisma.task.update({ where: { id: task.id }, data: { assigneeId: input.user.id } });
    }
  }

  const session = await prisma.devSession.create({
    data: {
      userId: input.user.id,
      idleTimeoutMinutes,
      currentTaskId: tasks[0]?.id ?? null,
      // Le chronometre actif demarre immediatement (sinon le temps reste a 0).
      lastResumedAt: new Date(),
      lastActivityAt: new Date(),
      tasks: { connect: tasks.map((task) => ({ id: task.id })) },
      events: {
        create: {
          userId: input.user.id,
          type: "START",
          message: "Session demarree",
          taskId: tasks[0]?.id ?? null,
          metadata: { resourceNames: input.resourceNames ?? [], taskCodes: tasks.map((t) => t.code) },
        },
      },
    },
    include: { tasks: { select: { id: true, code: true, title: true } } },
  });

  // Les taches selectionnees passent automatiquement "a faire" -> "en cours".
  if (tasks.length > 0) {
    await prisma.task.updateMany({
      where: { id: { in: tasks.map((t) => t.id) }, status: { in: ["BACKLOG", "TODO"] } },
      data: { status: "IN_PROGRESS" },
    });
  }

  await audit({
    actorId: input.user.id,
    actorLabel: input.user.displayName,
    action: "session.start",
    targetType: "session",
    targetId: session.id,
    metadata: { taskCodes: tasks.map((t) => t.code) },
  });

  emitActivity({
    type: "session.started",
    title: `${input.user.displayName} a demarre une session`,
    detail: tasks.length ? tasks.map((t) => t.code).join(", ") : "Sans tache associee",
    actor: { id: input.user.id, name: input.user.displayName },
    link: `/sessions/${session.id}`,
    timestamp: new Date().toISOString(),
  });

  return session;
}

async function loadSession(sessionId: string) {
  const session = await prisma.devSession.findUnique({
    where: { id: sessionId },
    include: { tasks: { select: { id: true, code: true, title: true } } },
  });
  if (!session) throw notFound("Session introuvable");
  return session;
}

function assertCanAct(session: { userId: string; status: string }, user: AuthUser) {
  if (session.userId !== user.id && !hasPermission(user, "sessions.manage")) {
    throw forbidden("Vous ne pouvez pas agir sur la session d'un autre developpeur");
  }
  if (!["ACTIVE", "PAUSED"].includes(session.status)) {
    throw conflict("Cette session est deja terminee");
  }
}

export async function pauseSession(sessionId: string, user: AuthUser, reason?: string) {
  const session = await loadSession(sessionId);
  assertCanAct(session, user);
  if (session.status === "PAUSED") return session;

  const now = new Date();
  const activeSeconds = computeActiveSeconds(session, now);

  const updated = await prisma.devSession.update({
    where: { id: session.id },
    data: {
      status: "PAUSED",
      lastResumedAt: null,
      accumulatedActiveSeconds: activeSeconds,
      events: {
        create: {
          userId: user.id,
          type: "PAUSE",
          message: reason?.slice(0, 500) ?? "Session mise en pause",
          taskId: session.currentTaskId,
        },
      },
    },
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "session.pause",
    targetType: "session",
    targetId: session.id,
    metadata: { reason },
  });

  emitActivity({
    type: "session.paused",
    title: `${user.displayName} a mis sa session en pause`,
    detail: reason,
    actor: { id: user.id, name: user.displayName },
    link: `/sessions/${session.id}`,
    timestamp: now.toISOString(),
  });

  return updated;
}

export async function resumeSession(sessionId: string, user: AuthUser) {
  const session = await loadSession(sessionId);
  assertCanAct(session, user);
  if (session.status === "ACTIVE") return session;

  const updated = await prisma.devSession.update({
    where: { id: session.id },
    data: {
      status: "ACTIVE",
      lastResumedAt: new Date(),
      lastActivityAt: new Date(),
      idleWarningSentAt: null,
      events: {
        create: {
          userId: user.id,
          type: "RESUME",
          message: "Session reprise",
          taskId: session.currentTaskId,
        },
      },
    },
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "session.resume",
    targetType: "session",
    targetId: session.id,
  });

  emitActivity({
    type: "session.resumed",
    title: `${user.displayName} a repris sa session`,
    actor: { id: user.id, name: user.displayName },
    link: `/sessions/${session.id}`,
    timestamp: new Date().toISOString(),
  });

  return updated;
}

/** Verrou optimiste: evite les doubles clotures. */
export async function endSession(input: {
  sessionId: string;
  user: AuthUser;
  summary?: string;
  notes?: string;
}) {
  const session = await loadSession(input.sessionId);
  assertCanAct(session, input.user);

  const now = new Date();
  const activeSeconds = computeActiveSeconds(session, now);
  const durationSeconds = computeDurationSeconds({ ...session, endedAt: now }, now);

  const updated = await prisma.devSession.update({
    where: { id: session.id },
    data: {
      status: "COMPLETED",
      endedAt: now,
      lastResumedAt: null,
      accumulatedActiveSeconds: activeSeconds,
      summary: input.summary?.slice(0, 2000) ?? session.summary,
      notes: input.notes?.slice(0, 5000) ?? session.notes,
      closedById: input.user.id,
      events: {
        create: {
          userId: input.user.id,
          type: "END",
          message: input.summary?.slice(0, 500) ?? "Session terminee",
          taskId: session.currentTaskId,
          metadata: { durationSeconds, activeSeconds },
        },
      },
    },
  });

  // Repartition du temps sur la tache courante (temps reellement mesure).
  if (session.currentTaskId) {
    await prisma.task
      .update({
        where: { id: session.currentTaskId },
        data: { timeSpentSeconds: { increment: activeSeconds } },
      })
      .catch(() => undefined);
  }

  await audit({
    actorId: input.user.id,
    actorLabel: input.user.displayName,
    action: "session.end",
    targetType: "session",
    targetId: session.id,
    metadata: { durationSeconds, activeSeconds },
  });

  emitActivity({
    type: "session.ended",
    title: `${input.user.displayName} a termine sa session`,
    detail: `${Math.round(activeSeconds / 60)} min de travail actif`,
    actor: { id: input.user.id, name: input.user.displayName },
    link: `/sessions/${session.id}`,
    timestamp: now.toISOString(),
  });

  // Generation automatique du rapport (donnees reelles uniquement).
  const report = await generateSessionReport(session.id).catch((error) => {
    console.error("[sessions] generation du rapport impossible:", error);
    return null;
  });

  const managers = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN", "LEAD_DEV"] }, isActive: true },
    select: { id: true },
  });
  await notifyMany(
    managers.map((manager) => manager.id),
    {
      type: "report.available",
      title: `Rapport de session disponible`,
      body: `${input.user.displayName} - ${Math.round(activeSeconds / 60)} min actives.`,
      link: `/sessions/${session.id}`,
    },
  );

  return { session: updated, report };
}

export async function switchTask(input: { sessionId: string; user: AuthUser; taskId: string }) {
  const session = await loadSession(input.sessionId);
  assertCanAct(session, input.user);

  const task = await prisma.task.findUnique({ where: { id: input.taskId } });
  if (!task) throw notFound("Tache introuvable");
  if (task.assigneeId && task.assigneeId !== input.user.id && !hasPermission(input.user, "tasks.assign")) {
    throw forbidden("Cette tache est assignee a un autre developpeur");
  }

  const now = new Date();
  // Temps passe sur la tache precedente depuis le dernier changement.
  if (session.currentTaskId && session.currentTaskId !== task.id && session.status === "ACTIVE") {
    const lastSwitch = await prisma.devSessionEvent.findFirst({
      where: {
        sessionId: session.id,
        type: { in: ["TASK_SWITCH", "RESUME", "START"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (lastSwitch) {
      const elapsed = Math.max(0, Math.floor((now.getTime() - lastSwitch.createdAt.getTime()) / 1000));
      await prisma.task
        .update({
          where: { id: session.currentTaskId },
          data: { timeSpentSeconds: { increment: elapsed } },
        })
        .catch(() => undefined);
    }
  }

  const updated = await prisma.devSession.update({
    where: { id: session.id },
    data: {
      currentTaskId: task.id,
      tasks: { connect: { id: task.id } },
      lastActivityAt: now,
      events: {
        create: {
          userId: input.user.id,
          type: "TASK_SWITCH",
          message: `Passage sur ${task.code}`,
          taskId: task.id,
        },
      },
    },
    include: { tasks: { select: { id: true, code: true, title: true, status: true } } },
  });

  return updated;
}

export async function addSessionNote(input: {
  sessionId: string;
  user: AuthUser;
  message: string;
}) {
  const session = await loadSession(input.sessionId);
  assertCanAct(session, input.user);
  if (!input.message.trim()) throw new HttpError(400, "Note vide");

  return prisma.devSessionEvent.create({
    data: {
      sessionId: session.id,
      userId: input.user.id,
      type: "NOTE",
      message: input.message.slice(0, 2000),
      taskId: session.currentTaskId,
    },
  });
}

export async function touchSessionActivity(sessionId: string): Promise<void> {
  await prisma.devSession
    .update({ where: { id: sessionId }, data: { lastActivityAt: new Date() } })
    .catch(() => undefined);
}

/** Detection d'inactivite : signale sans jamais retirer du temps. */
export async function detectIdleSessions(): Promise<number> {
  const sessions = await prisma.devSession.findMany({
    where: { status: "ACTIVE" },
    include: { user: { select: { id: true, displayName: true } } },
  });

  let warned = 0;
  const now = new Date();
  for (const session of sessions) {
    if (!isIdle(session, now)) continue;
    if (session.idleWarningSentAt && now.getTime() - session.idleWarningSentAt.getTime() < 10 * 60 * 1000) {
      continue;
    }
    await prisma.devSession.update({
      where: { id: session.id },
      data: {
        idleWarningSentAt: now,
        events: {
          create: {
            userId: session.userId,
            type: "IDLE_WARNING",
            message: `Aucune activite depuis ${session.idleTimeoutMinutes} minutes.`,
          },
        },
      },
    });
    await notifyMany([session.userId], {
      type: "session.idle",
      title: "Session inactive",
      body: `Aucune activite detectee depuis ${session.idleTimeoutMinutes} minutes. Confirmez votre temps ou mettez la session en pause.`,
      link: `/sessions/${session.id}`,
    });
    warned += 1;
  }
  return warned;
}
