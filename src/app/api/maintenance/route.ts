import { z } from "zod";
import { api } from "@/server/api";
import { badRequest, json, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import {
  buildMaintenanceSummary,
  serializeMaintenanceWindow,
} from "@/lib/maintenance";

const createSchema = z.object({
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().min(10).max(10_000),
  scope: z.string().trim().max(120).optional(),
  impact: z.string().trim().max(4000).optional(),
  scheduledStart: z.coerce.date(),
  scheduledEnd: z.coerce.date(),
});

const include = {
  createdBy: { select: { id: true, displayName: true, avatarColor: true } },
} as const;

function assertSchedule(start: Date, end: Date): void {
  if (end <= start) {
    throw badRequest("La fin de la maintenance doit etre posterieure au debut");
  }
}

export const GET = api(async () => {
  await requirePermission("maintenance.view");

  const windows = await prisma.maintenanceWindow.findMany({
    orderBy: [{ scheduledStart: "desc" }],
    take: 500,
    include,
  });
  const serialized = windows.map(serializeMaintenanceWindow);

  return json({ windows: serialized, summary: buildMaintenanceSummary(serialized) });
});

export const POST = api(async (request) => {
  const user = await requirePermission("maintenance.manage");
  const body = await parseJson(request, createSchema);
  assertSchedule(body.scheduledStart, body.scheduledEnd);

  const window = await prisma.maintenanceWindow.create({
    data: {
      title: body.title,
      description: body.description,
      scope: body.scope ?? null,
      impact: body.impact ?? null,
      scheduledStart: body.scheduledStart,
      scheduledEnd: body.scheduledEnd,
      createdById: user.id,
    },
    include,
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "maintenance.create",
    targetType: "maintenance",
    targetId: window.id,
    metadata: {
      title: window.title,
      scheduledStart: window.scheduledStart.toISOString(),
      scheduledEnd: window.scheduledEnd.toISOString(),
    },
  });

  return json({ window: serializeMaintenanceWindow(window) }, 201);
});
