import { api } from "@/server/api";
import { json, notFound } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { toStringArray } from "@/lib/json-array";
import { getFileBackend } from "@/server/files";
import { normalizeRemotePath } from "@/server/path-safety";

export const GET = api(async (_request, context) => {
  await requirePermission("resources.view");
  const { name } = await context.params;
  const decoded = decodeURIComponent(name);

  const resource = await prisma.resource.findUnique({
    where: { name: decoded },
    include: { owner: { select: { id: true, displayName: true } } },
  });
  if (!resource) throw notFound("Ressource inconnue. Lancez une synchronisation.");

  const [changes, tasks] = await Promise.all([
    prisma.fileChange.findMany({
      where: { resource: decoded },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { user: { select: { displayName: true } }, task: { select: { code: true } } },
    }),
    prisma.task.findMany({
      where: { resource: decoded },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: { id: true, code: true, title: true, status: true },
    }),
  ]);

  let files: Array<{ name: string; path: string; isFile: boolean; size: number; modifiedAt: string }> = [];
  let filesError: string | null = null;
  try {
    const backend = await getFileBackend();
    const entries = await backend.list(normalizeRemotePath(resource.folder));
    files = entries.map((entry) => ({
      name: entry.name,
      path: entry.path,
      isFile: entry.isFile,
      size: entry.size,
      modifiedAt: entry.modifiedAt.toISOString(),
    }));
  } catch (error) {
    filesError = error instanceof Error ? error.message : "Impossible de lister les fichiers";
  }

  return json({
    resource: {
      ...resource,
      dependencies: toStringArray(resource.dependencies),
      missingDependencies: toStringArray(resource.missingDependencies),
      sizeBytes: Number(resource.sizeBytes),
      lastModifiedAt: resource.lastModifiedAt?.toISOString() ?? null,
      lastDeployAt: resource.lastDeployAt?.toISOString() ?? null,
    },
    files,
    filesError,
    changes: changes.map((change) => ({
      id: change.id,
      path: change.path,
      changeType: change.changeType,
      createdAt: change.createdAt.toISOString(),
      user: change.user?.displayName ?? null,
      taskCode: change.task?.code ?? null,
    })),
    tasks,
  });
});
