import { z } from "zod";
import { api } from "@/server/api";
import { badRequest, json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { notify } from "@/server/notifications";
import { emitActivity } from "@/server/realtime";
import { incidentCode, serializeIncident } from "@/lib/incidents";

const updateSchema = z.object({
  title: z.string().trim().min(5).max(200).optional(),
  description: z.string().trim().min(10).max(10_000).optional(),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  status: z.enum(["OPEN", "INVESTIGATING", "MITIGATED", "RESOLVED"]).optional(),
  resource: z.string().trim().max(120).nullable().optional(),
  impact: z.string().trim().max(4000).nullable().optional(),
  resolution: z.string().trim().max(8000).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
});

const incidentInclude = {
  reportedBy: { select: { id: true, displayName: true, avatarColor: true } },
  assignee: { select: { id: true, displayName: true, avatarColor: true } },
};

export const PATCH = api(async (request, context) => {
  const user = await requirePermission("incidents.manage");
  const { id } = await context.params;
  const body = await parseJson(request, updateSchema);

  const existing = await prisma.incident.findUnique({ where: { id } });
  if (!existing) throw notFound("Incident introuvable");

  const nextStatus = body.status ?? existing.status;
  if (nextStatus === "RESOLVED" && !existing.resolution && !body.resolution?.trim()) {
    throw badRequest("Renseignez la resolution avant de clore l'incident");
  }

  if (body.assigneeId) {
    const assignee = await prisma.user.findUnique({ where: { id: body.assigneeId } });
    if (!assignee || !assignee.isActive) {
      throw badRequest("Responsable introuvable ou inactif");
    }
  }

  const now = new Date();
  const statusChanged = body.status !== undefined && body.status !== existing.status;
  const incident = await prisma.incident.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.severity !== undefined ? { severity: body.severity } : {}),
      ...(body.resource !== undefined ? { resource: body.resource } : {}),
      ...(body.impact !== undefined ? { impact: body.impact } : {}),
      ...(body.resolution !== undefined ? { resolution: body.resolution } : {}),
      ...(body.assigneeId !== undefined ? { assigneeId: body.assigneeId } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(statusChanged && body.status === "INVESTIGATING" && !existing.acknowledgedAt
        ? { acknowledgedAt: now }
        : {}),
      ...(statusChanged && body.status === "MITIGATED"
        ? { acknowledgedAt: existing.acknowledgedAt ?? now, mitigatedAt: now }
        : {}),
      ...(statusChanged && body.status === "RESOLVED"
        ? {
            acknowledgedAt: existing.acknowledgedAt ?? now,
            mitigatedAt: existing.mitigatedAt ?? now,
            resolvedAt: now,
          }
        : {}),
      ...(statusChanged && body.status !== "RESOLVED" ? { resolvedAt: null } : {}),
      ...(statusChanged && body.status === "OPEN"
        ? { acknowledgedAt: null, mitigatedAt: null, resolvedAt: null }
        : {}),
    },
    include: incidentInclude,
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: incident.status === "RESOLVED" ? "incident.resolve" : "incident.update",
    targetType: "incident",
    targetId: incident.id,
    metadata: {
      code: incidentCode(incident.number),
      fields: Object.keys(body),
      status: incident.status,
    },
  });

  if (
    incident.assigneeId &&
    incident.assigneeId !== user.id &&
    body.assigneeId &&
    body.assigneeId !== existing.assigneeId
  ) {
    await notify(incident.assigneeId, {
      type: "incident.assigned",
      title: `Incident assigne : ${incidentCode(incident.number)}`,
      body: incident.title,
      link: "/incidents",
    });
  }

  if (statusChanged && (incident.status === "MITIGATED" || incident.status === "RESOLVED")) {
    emitActivity({
      type: incident.status === "RESOLVED" ? "incident.resolved" : "incident.mitigated",
      title: `Incident ${incidentCode(incident.number)} ${
        incident.status === "RESOLVED" ? "resolu" : "maitrise"
      }`,
      detail: incident.title,
      actor: { id: user.id, name: user.displayName },
      link: "/incidents",
      timestamp: new Date().toISOString(),
    });
  }

  return json({ incident: serializeIncident(incident) });
});
