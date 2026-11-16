import { api } from "@/server/api";
import { json } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { prisma } from "@/lib/prisma";

function parseRange(params: URLSearchParams): { from: Date; to: Date; label: string } {
  const now = new Date();
  const preset = params.get("preset") ?? "30d";
  if (preset === "custom") {
    const from = params.get("from");
    const to = params.get("to");
    return {
      from: from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1),
      to: to ? new Date(to) : now,
      label: "Personnalisee",
    };
  }
  const days = preset === "today" ? 0 : preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  const from =
    preset === "today"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : new Date(now.getTime() - days * 864e5);
  return { from, to: now, label: preset };
}

export const GET = api(async (request) => {
  const user = await requirePermission("analytics.view");
  const params = new URL(request.url).searchParams;
  const { from, to, label } = parseRange(params);
  const scopeAll = hasPermission(user, "sessions.view.all");
  const userIdFilter = params.get("userId");
  const resourceFilter = params.get("resource");
  const project = params.get("project");

  const sessionWhere = {
    startedAt: { gte: from, lte: to },
    ...(scopeAll ? {} : { userId: user.id }),
    ...(userIdFilter && scopeAll ? { userId: userIdFilter } : {}),
  };

  const [sessions, users, completedTasks, fixedBugs, changes, taskCategories] = await Promise.all([
    prisma.devSession.findMany({
      where: sessionWhere,
      select: {
        id: true,
        userId: true,
        status: true,
        startedAt: true,
        endedAt: true,
        accumulatedActiveSeconds: true,
        lastResumedAt: true,
        user: { select: { displayName: true, avatarColor: true } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, displayName: true, avatarColor: true, role: true },
    }),
    prisma.task.findMany({
      where: {
        status: "DONE",
        completedAt: { gte: from, lte: to },
        ...(resourceFilter ? { resource: resourceFilter } : {}),
        ...(userIdFilter ? { assigneeId: userIdFilter } : {}),
      },
      select: { assigneeId: true, category: true, resource: true, completedAt: true },
    }),
    prisma.bug.findMany({
      where: {
        status: { in: ["FIXED", "CLOSED"] },
        fixedAt: { gte: from, lte: to },
        ...(resourceFilter ? { resource: resourceFilter } : {}),
        ...(userIdFilter ? { assigneeId: userIdFilter } : {}),
      },
      select: { assigneeId: true },
    }),
    prisma.fileChange.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        ...(resourceFilter ? { resource: resourceFilter } : {}),
        ...(userIdFilter ? { userId: userIdFilter } : {}),
      },
      select: { userId: true, resource: true, createdAt: true, changeType: true },
    }),
    prisma.task.findMany({
      where: { status: "DONE", completedAt: { gte: from, lte: to } },
      select: { category: true },
    }),
  ]);

  const now = new Date();
  const perUser = new Map<
    string,
    { userId: string; name: string; color: string; activeSeconds: number; sessions: number; tasks: number; bugs: number; changes: number }
  >();

  for (const developer of users) {
    perUser.set(developer.id, {
      userId: developer.id,
      name: developer.displayName,
      color: developer.avatarColor,
      activeSeconds: 0,
      sessions: 0,
      tasks: 0,
      bugs: 0,
      changes: 0,
    });
  }

  for (const session of sessions) {
    const entry = perUser.get(session.userId);
    if (!entry) continue;
    entry.sessions += 1;
    entry.activeSeconds +=
      session.accumulatedActiveSeconds +
      (session.status === "ACTIVE" && session.lastResumedAt
        ? Math.max(0, Math.floor((now.getTime() - session.lastResumedAt.getTime()) / 1000))
        : 0);
  }
  for (const task of completedTasks) {
    if (task.assigneeId) {
      const entry = perUser.get(task.assigneeId);
      if (entry) entry.tasks += 1;
    }
  }
  for (const bug of fixedBugs) {
    if (bug.assigneeId) {
      const entry = perUser.get(bug.assigneeId);
      if (entry) entry.bugs += 1;
    }
  }
  for (const change of changes) {
    if (change.userId) {
      const entry = perUser.get(change.userId);
      if (entry) entry.changes += 1;
    }
  }

  const totalActiveSeconds = Array.from(perUser.values()).reduce(
    (sum, entry) => sum + entry.activeSeconds,
    0,
  );

  // Serie temporelle (jour par jour).
  const days = Math.max(
    1,
    Math.min(120, Math.ceil((to.getTime() - from.getTime()) / 864e5) + 1),
  );
  const serie = Array.from({ length: days }, (_, index) => {
    const date = new Date(from.getTime() + index * 864e5);
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      activeSeconds: 0,
      changes: 0,
      tasks: 0,
    };
  });
  const serieIndex = new Map(serie.map((entry) => [entry.date, entry]));
  for (const session of sessions) {
    const key = session.startedAt.toISOString().slice(0, 10);
    const entry = serieIndex.get(key);
    if (entry) {
      entry.activeSeconds +=
        session.accumulatedActiveSeconds +
        (session.status === "ACTIVE" && session.lastResumedAt
          ? Math.max(0, Math.floor((now.getTime() - session.lastResumedAt.getTime()) / 1000))
          : 0);
    }
  }
  for (const change of changes) {
    const entry = serieIndex.get(change.createdAt.toISOString().slice(0, 10));
    if (entry) entry.changes += 1;
  }
  for (const task of completedTasks) {
    if (!task.completedAt) continue;
    const entry = serieIndex.get(task.completedAt.toISOString().slice(0, 10));
    if (entry) entry.tasks += 1;
  }

  const resources = new Map<string, number>();
  for (const change of changes) {
    if (!change.resource) continue;
    resources.set(change.resource, (resources.get(change.resource) ?? 0) + 1);
  }

  const categoryCounts = new Map<string, number>();
  for (const task of taskCategories) {
    categoryCounts.set(task.category, (categoryCounts.get(task.category) ?? 0) + 1);
  }

  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((session) => session.status === "COMPLETED");

  return json({
    range: { from: from.toISOString(), to: to.toISOString(), label, project },
    totals: {
      activeSeconds: totalActiveSeconds,
      sessions: totalSessions,
      averageSessionSeconds:
        completedSessions.length > 0
          ? Math.round(
              completedSessions.reduce((sum, session) => sum + session.accumulatedActiveSeconds, 0) /
                completedSessions.length,
            )
          : 0,
      tasks: completedTasks.length,
      bugs: fixedBugs.length,
      changes: changes.length,
      developers: Array.from(perUser.values()).filter((entry) => entry.sessions > 0).length,
    },
    perUser: Array.from(perUser.values())
      .filter((entry) => entry.sessions > 0 || entry.tasks > 0 || entry.changes > 0)
      .sort((a, b) => b.activeSeconds - a.activeSeconds),
    serie,
    resources: Array.from(resources.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    categories: Array.from(categoryCounts.entries()).map(([category, count]) => ({ category, count })),
    users,
  });
});
