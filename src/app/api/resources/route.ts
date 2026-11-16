import { api } from "@/server/api";
import { json } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { toStringArray } from "@/lib/json-array";
import { syncResources } from "@/server/resources";

export const GET = api(async (request) => {
  await requirePermission("resources.view");
  const params = new URL(request.url).searchParams;
  const search = params.get("q")?.trim() ?? "";
  const state = params.get("state");

  const resources = await prisma.resource.findMany({
    where: {
      ...(search ? { name: { contains: search } } : {}),
      ...(state ? { state } : {}),
    },
    orderBy: { name: "asc" },
    include: {
      owner: { select: { id: true, displayName: true } },
    },
  });

  return json({
    resources: resources.map((resource) => ({
      ...resource,
      dependencies: toStringArray(resource.dependencies),
      missingDependencies: toStringArray(resource.missingDependencies),
      sizeBytes: Number(resource.sizeBytes),
      lastModifiedAt: resource.lastModifiedAt?.toISOString() ?? null,
      lastDeployAt: resource.lastDeployAt?.toISOString() ?? null,
      lastRunStateAt: resource.lastRunStateAt?.toISOString() ?? null,
      updatedAt: resource.updatedAt.toISOString(),
      createdAt: resource.createdAt.toISOString(),
    })),
  });
});

/** Synchronisation depuis le serveur FiveM (analyse des fxmanifest.lua). */
export const POST = api(async () => {
  const actor = await requirePermission("resources.manage");
  const result = await syncResources(actor);
  return json(result);
});
