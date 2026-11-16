import { api } from "@/server/api";
import { json } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { prisma } from "@/lib/prisma";

export const GET = api(async (request) => {
  const user = await requirePermission("reports.view.own");
  const params = new URL(request.url).searchParams;
  const scope = params.get("scope") === "all" && hasPermission(user, "reports.view.all") ? "all" : "own";
  const userId = params.get("userId");
  const limit = Math.min(Number(params.get("limit") ?? 50) || 50, 200);

  const reports = await prisma.report.findMany({
    where: {
      ...(scope === "own" ? { userId: user.id } : {}),
      ...(userId && scope === "all" ? { userId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, displayName: true, avatarColor: true } },
      session: { select: { id: true, number: true, status: true } },
    },
  });

  return json({
    scope,
    reports: reports.map((report) => ({
      id: report.id,
      number: report.number,
      developer: report.user,
      sessionId: report.session.id,
      sessionNumber: report.session.number,
      startedAt: report.startedAt.toISOString(),
      endedAt: report.endedAt.toISOString(),
      durationSeconds: report.durationSeconds,
      activeSeconds: report.activeSeconds,
      createdAt: report.createdAt.toISOString(),
      summary: report.summary,
    })),
  });
});
