import { api } from "@/server/api";
import { json, parseDateParam } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTION_LABELS } from "@/server/audit";
import type { AuditResult, Prisma } from "@prisma/client";

export const GET = api(async (request) => {
  await requirePermission("audit.view");
  const params = new URL(request.url).searchParams;

  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(params.get("pageSize") ?? 30) || 30));
  const action = params.get("action")?.trim();
  const actorId = params.get("actorId")?.trim();
  const resultParam = params.get("result");
  const result: AuditResult | null =
    resultParam === "SUCCESS" || resultParam === "FAILURE" || resultParam === "DENIED"
      ? resultParam
      : null;
  const from = parseDateParam(params.get("from"), "from");
  const to = parseDateParam(params.get("to"), "to");
  const search = params.get("q")?.trim();

  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(actorId ? { actorId } : {}),
    ...(result ? { result } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { actorLabel: { contains: search } },
            { targetId: { contains: search } },
            { action: { contains: search } },
          ],
        }
      : {}),
  };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { displayName: true, role: true } } },
    }),
  ]);

  return json({
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    actions: AUDIT_ACTION_LABELS,
    logs: logs.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
      actionLabel: AUDIT_ACTION_LABELS[log.action] ?? log.action,
    })),
  });
});
