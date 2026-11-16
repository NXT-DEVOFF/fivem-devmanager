import { z } from "zod";
import { api } from "@/server/api";
import { json, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { toStringArray } from "@/lib/json-array";
import { requestDeployment } from "@/server/deployments";

export const GET = api(async (request) => {
  await requirePermission("deployments.view");
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const resource = params.get("resource");

  const deployments = await prisma.deployment.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(resource ? { resource } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      requestedBy: { select: { id: true, displayName: true, avatarColor: true } },
      approvedBy: { select: { id: true, displayName: true } },
    },
  });

  return json({
    deployments: deployments.map((deployment) => ({
      id: deployment.id,
      resource: deployment.resource,
      title: deployment.title,
      status: deployment.status,
      changes: deployment.changes,
      files: toStringArray(deployment.files),
      logs: deployment.logs,
      snapshotId: deployment.snapshotId,
      requestedBy: deployment.requestedBy,
      approvedBy: deployment.approvedBy,
      approvedAt: deployment.approvedAt?.toISOString() ?? null,
      rejectedReason: deployment.rejectedReason,
      deployedAt: deployment.deployedAt?.toISOString() ?? null,
      createdAt: deployment.createdAt.toISOString(),
      updatedAt: deployment.updatedAt.toISOString(),
    })),
  });
});

const schema = z.object({
  resource: z.string().trim().min(2).max(120),
  title: z.string().trim().min(3).max(200),
  notes: z.string().max(5000).optional(),
});

export const POST = api(async (request) => {
  const user = await requirePermission("deployments.request");
  const body = await parseJson(request, schema);

  const deployment = await requestDeployment({
    user,
    resource: body.resource,
    title: body.title,
    notes: body.notes,
  });

  return json({ deployment }, 201);
});
