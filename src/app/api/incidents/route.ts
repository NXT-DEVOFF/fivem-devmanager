import { z } from "zod";
import { api } from "@/server/api";
import { badRequest, json, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { notify, notifyMany } from "@/server/notifications";
import { emitActivity } from "@/server/realtime";
import { buildIncidentSummary, incidentCode, serializeIncident } from "@/lib/incidents";

const createSchema = z.object({
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().min(10).max(10_000),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  resource: z.string().trim().max(120).optional(),
  impact: z.string().trim().max(4000).optional(),
  assigneeId: z.string().nullable().optional(),
});

const incidentInclude = {
  reportedBy: { select: { id: true, displayName: true, avatarColor: true } },
  assignee: { select: { id: true, displayName: true, avatarColor: true } },
};

export const GET = api(async (request) => {
  await requirePermission("incidents.view");
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const severity = params.get("severity");
  const search = params.get("q")?.trim();

  const all = await prisma.incident.findMany({
    orderBy: [{ startedAt: "desc" }],
    take: 500,
    include: incidentInclude,
  });
  const allViews = all.map(serializeIncident);

  const incidents = allViews
    .filter((incident) => (status ? incident.status === status : true))
    .filter((incident) => (severity ? incident.severity === severity : true))
    .filter((incident) =>
      search
        ? `${incident.code} ${incident.title} ${incident.resource ?? ""}`
            .toLowerCase()
            .includes(search.toLowerCase())
        : true,
    );

  return json({ incidents, summary: buildIncidentSummary(allViews) });
});

export const POST = api(async (request) => {
  const user = await requirePermission("incidents.create");
  const body = await parseJson(request, createSchema);

  if (body.assigneeId) {
    const assignee = await prisma.user.findUnique({ where: { id: body.assigneeId } });
    if (!assignee || !assignee.isActive) {
      throw badRequest("Responsable introuvable ou inactif");
    }
  }

  const incident = await prisma.incident.create({
    data: {
      title: body.title,
      description: body.description,
      severity: body.severity,
      resource: body.resource ?? null,
      impact: body.impact ?? null,
      reportedById: user.id,
      assigneeId: body.assigneeId ?? null,
    },
    include: incidentInclude,
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "incident.create",
    targetType: "incident",
    targetId: incident.id,
    metadata: { code: incidentCode(incident.number), severity: incident.severity },
  });

  emitActivity({
    type: "incident.reported",
    title: `Incident ${incidentCode(incident.number)} · ${incident.severity}`,
    detail: incident.title,
    actor: { id: user.id, name: user.displayName },
    link: "/incidents",
    timestamp: new Date().toISOString(),
  });

  if (incident.assigneeId) {
    await notify(incident.assigneeId, {
      type: "incident.assigned",
      title: `Incident assigne : ${incidentCode(incident.number)}`,
      body: incident.title,
      link: "/incidents",
    });
  } else {
    const leads = await prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN", "LEAD_DEV"] }, isActive: true },
      select: { id: true },
    });
    await notifyMany(
      leads.map((lead) => lead.id),
      {
        type: "incident.reported",
        title: `Nouvel incident : ${incidentCode(incident.number)} (${incident.severity})`,
        body: incident.title,
        link: "/incidents",
      },
    );
  }

  return json({ incident: serializeIncident(incident) }, 201);
});
