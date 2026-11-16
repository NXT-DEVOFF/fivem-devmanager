import { api } from "@/server/api";
import { json, HttpError, rateLimit, tooManyRequests } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { getPterodactylConfig } from "@/server/integrations";
import { syncTrackedFiles } from "@/server/workers";
import { audit } from "@/server/audit";

function syncIntervalSeconds(): number {
  return Math.max(60, Number(process.env.FILE_SYNC_INTERVAL_SECONDS ?? 180) || 180);
}

export const GET = api(async () => {
  await requirePermission("files.view");

  const intervalSeconds = syncIntervalSeconds();
  const staleBefore = new Date(Date.now() - intervalSeconds * 2_000);
  const [config, tracked, trackedCount, checked, stale, deleted, lastChecked, changes] =
    await Promise.all([
      getPterodactylConfig(),
      prisma.trackedFile.findMany({
        orderBy: { lastCheckedAt: "asc" },
        take: 100,
      }),
      prisma.trackedFile.count(),
      prisma.trackedFile.count({
        where: { hash: { not: null }, lastCheckedAt: { gte: staleBefore } },
      }),
      prisma.trackedFile.count({
        where: { hash: { not: null }, lastCheckedAt: { lt: staleBefore } },
      }),
      prisma.trackedFile.count({ where: { hash: null } }),
      prisma.trackedFile.aggregate({ _max: { lastCheckedAt: true } }),
      prisma.fileChange.findMany({
        where: { source: "SYNC" },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          path: true,
          changeType: true,
          createdAt: true,
          task: { select: { code: true } },
        },
      }),
    ]);

  return json({
    configured: Boolean(config),
    intervalSeconds,
    summary: {
      tracked: trackedCount,
      checked,
      stale,
      deleted,
      lastCheckedAt: lastChecked._max.lastCheckedAt?.toISOString() ?? null,
    },
    files: tracked.map((file) => ({
      id: file.id,
      path: file.path,
      resource: file.resource,
      size: file.size,
      version: file.version,
      lastCheckedAt: file.lastCheckedAt.toISOString(),
      remoteModifiedAt: file.remoteModifiedAt?.toISOString() ?? null,
      state:
        file.hash === null
          ? "deleted"
          : file.lastCheckedAt < staleBefore
            ? "stale"
            : "synced",
    })),
    changes: changes.map((change) => ({
      id: change.id,
      path: change.path,
      changeType: change.changeType,
      createdAt: change.createdAt.toISOString(),
      taskCode: change.task?.code ?? null,
    })),
  });
});

export const POST = api(async () => {
  const actor = await requirePermission("sync.manage");
  const limited = rateLimit(`sync:${actor.id}`, 1, 15_000);
  if (!limited.ok) {
    throw tooManyRequests(`Synchronisation deja lancee recemment. Reessayez dans ${limited.retryAfter} s.`);
  }

  if (!(await getPterodactylConfig())) {
    throw new HttpError(412, "Pterodactyl n'est pas configure pour la synchronisation des fichiers.", "sync_not_configured");
  }

  const detected = await syncTrackedFiles(200);
  await audit({
    actorId: actor.id,
    actorLabel: actor.displayName,
    action: "files.sync",
    targetType: "files",
    metadata: { detected, limit: 200 },
  });

  return json({ ok: true, detected, at: new Date().toISOString() });
});
