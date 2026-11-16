import { z } from "zod";
import { api } from "@/server/api";
import { forbidden, json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { evaluateTaskReadiness } from "@/server/changes";
import { audit } from "@/server/audit";
import { notify } from "@/server/notifications";

const schema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().max(1000).optional(),
  force: z.boolean().optional(),
});

export const POST = api(async (request, context) => {
  const user = await requirePermission("tasks.edit");
  const { id } = await context.params;
  const body = await parseJson(request, schema);

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw notFound("Tache introuvable");

  const readiness = await evaluateTaskReadiness(id);
  const isValidator = hasPermission(user, "tasks.validate");
  const autoEligible = task.autoValidate && !task.requiresReview && readiness.ready;
  const isAssignee = task.assigneeId === user.id;

  if (body.decision === "approve") {
    if (!isValidator && !(isAssignee && autoEligible)) {
      throw forbidden(
        readiness.ready
          ? "Cette tache necessite une validation par un responsable"
          : "Tous les criteres de validation ne sont pas remplis",
      );
    }
    if (!readiness.ready && !isValidator) {
      throw forbidden("Criteres de validation incomplets");
    }
    if (!readiness.ready && isValidator && !body.force) {
      return json(
        {
          error: "Des criteres ne sont pas remplis. Confirmez la validation forcee.",
          code: "criteria_incomplete",
          readiness,
        },
        { status: 409 },
      );
    }

    const now = new Date();
    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: "DONE",
        completedAt: task.completedAt ?? now,
        validatedAt: now,
        validatedById: user.id,
        validationKind: isValidator && !autoEligible ? "HUMAN" : "AUTO",
      },
    });

    if (body.note) {
      await prisma.taskComment.create({
        data: { taskId: id, authorId: user.id, body: `Validation : ${body.note}` },
      });
    }

    await audit({
      actorId: user.id,
      actorLabel: user.displayName,
      action: "task.validate",
      targetType: "task",
      targetId: id,
      metadata: {
        kind: updated.validationKind,
        forced: Boolean(body.force),
        criteria: readiness.criteria.filter((criterion) => !criterion.satisfied).map((c) => c.key),
      },
    });

    if (task.assigneeId && task.assigneeId !== user.id) {
      await notify(task.assigneeId, {
        type: "task.validated",
        title: `Tache validee : ${task.code}`,
        body: task.title,
        link: `/tasks/${id}`,
      });
    }

    return json({ task: updated, readiness, kind: updated.validationKind });
  }

  // Rejet : la tache repart en developpement avec une trace.
  if (!isValidator) throw forbidden("Permission tasks.validate requise");
  const now = new Date();
  const updated = await prisma.task.update({
    where: { id },
    data: {
      status: "IN_PROGRESS",
      validatedAt: null,
      validatedById: null,
      validationKind: null,
      completedAt: null,
    },
  });

  await prisma.taskComment.create({
    data: {
      taskId: id,
      authorId: user.id,
      body: `Validation refusee${body.note ? ` : ${body.note}` : ""}`,
    },
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "task.reject",
    targetType: "task",
    targetId: id,
    metadata: { note: body.note },
  });

  if (task.assigneeId) {
    await notify(task.assigneeId, {
      type: "task.rejected",
      title: `Validation refusee : ${task.code}`,
      body: body.note ?? "Consultez les commentaires de la tache.",
      link: `/tasks/${id}`,
    });
  }

  return json({ task: updated, readiness, rejectedAt: now.toISOString() });
});
