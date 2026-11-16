import { api } from "@/server/api";
import { json } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const GET = api(async (request) => {
  const user = await requirePermission("files.view");
  const params = new URL(request.url).searchParams;

  const limit = Math.min(Number(params.get("limit") ?? 80) || 80, 200);
  const path = params.get("path")?.trim();
  const resource = params.get("resource")?.trim();
  const sessionId = params.get("sessionId")?.trim();
  const taskId = params.get("taskId")?.trim();
  const type = params.get("type")?.trim();
  const userId = params.get("userId")?.trim();
  const validated = params.get("validated");

  const canViewAll = hasPermission(user, "sessions.view.all");

  const where: Prisma.FileChangeWhereInput = {
    ...(canViewAll ? {} : { userId: user.id }),
    ...(path ? { path: { contains: path } } : {}),
    ...(resource ? { resource } : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(taskId ? { taskId } : {}),
    ...(userId ? { userId } : {}),
    ...(type ? { changeType: type as never } : {}),
    ...(validated === "true" ? { validated: true } : validated === "false" ? { validated: false } : {}),
  };

  const [changes, pending, todayCount] = await Promise.all([
    prisma.fileChange.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { id: true, displayName: true, avatarColor: true } },
        task: { select: { id: true, code: true, title: true } },
        session: { select: { id: true, number: true } },
      },
    }),
    prisma.fileChange.count({ where: { ...where, validated: false } }),
    prisma.fileChange.count({
      where: { ...where, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
  ]);

  return json({
    changes: changes.map((change) => ({
      id: change.id,
      path: change.path,
      resource: change.resource,
      changeType: change.changeType,
      source: change.source,
      sizeBefore: change.sizeBefore,
      sizeAfter: change.sizeAfter,
      taskMatchScore: change.taskMatchScore,
      taskMatchReason: change.taskMatchReason,
      validated: change.validated,
      createdAt: change.createdAt.toISOString(),
      user: change.user,
      task: change.task,
      session: change.session,
    })),
    stats: { pending, todayCount, total: changes.length },
  });
});
