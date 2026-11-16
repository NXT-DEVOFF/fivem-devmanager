import { z } from "zod";
import { api } from "@/server/api";
import { conflict, forbidden, json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { toStringArray } from "@/lib/json-array";
import { audit } from "@/server/audit";
import { notify } from "@/server/notifications";
import { emitActivity } from "@/server/realtime";

export const GET = api(async (_request, context) => {
  await requirePermission("bugs.view");
  const { id } = await context.params;

  const bug = await prisma.bug.findUnique({
    where: { id },
    include: {
      reporter: { select: { id: true, displayName: true, avatarColor: true } },
      assignee: { select: { id: true, displayName: true, avatarColor: true } },
      task: { select: { id: true, code: true, title: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, displayName: true, avatarColor: true } } },
      },
      changes: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { displayName: true } } },
      },
    },
  });
  if (!bug) throw notFound("Bug introuvable");

  return json({
    bug: {
      ...bug,
      screenshots: toStringArray(bug.screenshots),
      createdAt: bug.createdAt.toISOString(),
      updatedAt: bug.updatedAt.toISOString(),
      fixedAt: bug.fixedAt?.toISOString() ?? null,
      closedAt: bug.closedAt?.toISOString() ?? null,
      comments: bug.comments.map((comment) => ({
        ...comment,
        createdAt: comment.createdAt.toISOString(),
      })),
      changes: bug.changes.map((change) => ({
        id: change.id,
        path: change.path,
        changeType: change.changeType,
        createdAt: change.createdAt.toISOString(),
        user: change.user?.displayName ?? null,
      })),
    },
  });
});

const updateSchema = z.object({
  status: z.enum(["NEW", "TRIAGE", "FIXING", "TESTING", "FIXED", "CLOSED"]).optional(),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  assigneeId: z.string().nullable().optional(),
  title: z.string().trim().min(5).max(200).optional(),
  description: z.string().trim().min(10).max(10_000).optional(),
  logs: z.string().max(20_000).nullable().optional(),
  reproduceSteps: z.string().max(5000).nullable().optional(),
  expectedResult: z.string().max(2000).nullable().optional(),
  actualResult: z.string().max(2000).nullable().optional(),
  fixValidated: z.boolean().optional(),
  validationNote: z.string().max(1000).optional(),
});

export const PATCH = api(async (request, context) => {
  const user = await requirePermission("bugs.edit");
  const { id } = await context.params;
  const body = await parseJson(request, updateSchema);

  const bug = await prisma.bug.findUnique({ where: { id } });
  if (!bug) throw notFound("Bug introuvable");

  if (body.assigneeId !== undefined && !hasPermission(user, "bugs.assign")) {
    throw forbidden("Permission bugs.assign requise");
  }
  if (body.status === "CLOSED" && !hasPermission(user, "bugs.close")) {
    throw forbidden("Permission bugs.close requise");
  }

  // La fermeture exige une correction validee : jamais sur simple modification.
  if (body.status === "CLOSED" && !bug.fixValidated && !body.fixValidated) {
    throw conflict(
      "La correction doit etre validee avant de fermer le bug (controle fonctionnel ou confirmation explicite).",
    );
  }

  const now = new Date();
  const updated = await prisma.bug.update({
    where: { id },
    data: {
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.severity !== undefined ? { severity: body.severity } : {}),
      ...(body.assigneeId !== undefined ? { assigneeId: body.assigneeId } : {}),
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.logs !== undefined ? { logs: body.logs } : {}),
      ...(body.reproduceSteps !== undefined ? { reproduceSteps: body.reproduceSteps } : {}),
      ...(body.expectedResult !== undefined ? { expectedResult: body.expectedResult } : {}),
      ...(body.actualResult !== undefined ? { actualResult: body.actualResult } : {}),
      ...(body.fixValidated === true ? { fixValidated: true, fixedAt: bug.fixedAt ?? now } : {}),
      ...(body.status === "CLOSED" ? { closedAt: now } : {}),
      ...(body.status && body.status !== "CLOSED" ? { closedAt: null } : {}),
    },
  });

  if (body.validationNote) {
    await prisma.bugComment.create({
      data: { bugId: id, authorId: user.id, body: body.validationNote },
    });
  }

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: body.status === "CLOSED" ? "bug.close" : "bug.update",
    targetType: "bug",
    targetId: id,
    metadata: { fields: Object.keys(body), status: body.status, severity: body.severity },
  });

  if (bug.reporterId !== user.id && body.status) {
    await notify(bug.reporterId, {
      type: "bug.updated",
      title: `Bug ${bug.code} : ${body.status}`,
      body: bug.title,
      link: `/bugs/${id}`,
    });
  }
  if (body.status === "CLOSED") {
    emitActivity({
      type: "bug.reported",
      title: `Bug corrige : ${bug.code}`,
      detail: bug.title,
      actor: { id: user.id, name: user.displayName },
      link: `/bugs/${id}`,
      timestamp: now.toISOString(),
    });
  }

  return json({ bug: { ...updated, screenshots: toStringArray(updated.screenshots) } });
});
