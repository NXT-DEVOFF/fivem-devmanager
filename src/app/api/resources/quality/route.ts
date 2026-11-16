import { api } from "@/server/api";
import { json } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { toStringArray } from "@/lib/json-array";
import { analyzeResource, summarizeQuality } from "@/lib/resource-quality";

export const GET = api(async () => {
  const user = await requirePermission("resources.view");

  const resources = await prisma.resource.findMany({
    orderBy: { name: "asc" },
    select: {
      name: true,
      folder: true,
      state: true,
      fileCount: true,
      manifest: true,
      dependencies: true,
      missingDependencies: true,
    },
  });

  const reports = resources
    .map((resource) =>
      analyzeResource({
        name: resource.name,
        folder: resource.folder,
        state: resource.state,
        fileCount: resource.fileCount,
        manifest: resource.manifest,
        dependencies: toStringArray(resource.dependencies),
        missingDependencies: toStringArray(resource.missingDependencies),
      }),
    )
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));

  return json({
    canSync: hasPermission(user, "resources.manage"),
    summary: summarizeQuality(reports),
    reports,
  });
});
