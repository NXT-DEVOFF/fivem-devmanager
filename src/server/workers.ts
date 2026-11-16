/**
 * Taches de fond (dans le processus Node) :
 * - avertissements d'inactivite
 * - publication des patch notes planifiees
 * - liberation des verrous expires
 * - synchronisation periodique des fichiers distants
 *
 * Demarrees par server.mjs apres l'ecoute HTTP. Aucune dependance externe.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { detectIdleSessions } from "@/server/sessions";
import { publishScheduledNotes } from "@/server/discord";
import { resolvePterodactyl, getPterodactylConfig } from "@/server/integrations";
import { recordFileChange } from "@/server/changes";
import { hashContent } from "@/server/changes";
import { normalizeRemotePath, parentPath } from "@/server/path-safety";
import { consoleRelay } from "@/server/pterodactyl/console-relay";
import { sampleMetrics } from "@/server/metrics";
import { backfillMissingReports, enrichPendingReportSummaries } from "@/server/reports";
import { isAiConfigured } from "@/server/ai";

const globalForWorkers = globalThis as unknown as { __fdmWorkersStarted?: boolean };

function runSafely(name: string, task: () => Promise<unknown>, intervalMs: number): NodeJS.Timeout {
  const execute = () => {
    task().catch((error) => console.error(`[workers] ${name}:`, error));
  };
  const timer = setInterval(execute, intervalMs);
  timer.unref?.();
  // Premier passage differe pour ne pas ralentir le demarrage.
  const initial = setTimeout(execute, 15_000);
  initial.unref?.();
  return timer;
}

/**
 * Synchronisation des fichiers suivis : compare la taille et la date de
 * modification distantes au dernier etat connu. Toute divergence est
 * enregistree comme modification (source SYNC, sans utilisateur).
 */
// Partage le verrou entre le worker d'instrumentation et les routes API.
const globalForSync = globalThis as typeof globalThis & {
  __fdmSyncInFlight?: Promise<number> | null;
};

export function syncTrackedFiles(limit = 60): Promise<number> {
  // Le worker et le bouton manuel peuvent se croiser : un seul passage a la fois.
  if (globalForSync.__fdmSyncInFlight) return globalForSync.__fdmSyncInFlight;
  globalForSync.__fdmSyncInFlight = syncTrackedFilesInternal(limit).finally(() => {
    globalForSync.__fdmSyncInFlight = null;
  });
  return globalForSync.__fdmSyncInFlight;
}

async function syncTrackedFilesInternal(limit = 60): Promise<number> {
  const config = await getPterodactylConfig();
  if (!config) return 0;
  const { client } = await resolvePterodactyl();

  const tracked = await prisma.trackedFile.findMany({
    orderBy: { lastCheckedAt: "asc" },
    take: limit,
  });
  if (tracked.length === 0) return 0;

  const byDirectory = new Map<string, typeof tracked>();
  for (const file of tracked) {
    const dir = parentPath(file.path);
    if (!byDirectory.has(dir)) byDirectory.set(dir, []);
    byDirectory.get(dir)!.push(file);
  }

  let detected = 0;
  for (const [directory, files] of byDirectory) {
    let entries;
    try {
      entries = await client.listFiles(normalizeRemotePath(directory));
    } catch {
      continue;
    }
    const remoteMap = new Map(entries.map((entry) => [entry.name, entry]));

    for (const file of files) {
      const name = file.path.split("/").pop()!;
      const remote = remoteMap.get(name);
      await prisma.trackedFile.update({
        where: { id: file.id },
        data: { lastCheckedAt: new Date() },
      }).catch(() => undefined);

      // Une suppression distante doit etre journalisee une seule fois. On garde
      // la ligne suivie avec hash=null pour pouvoir detecter une recreation.
      if (!remote || !remote.is_file) {
        if (file.hash !== null) {
          await prisma.trackedFile.update({
            where: { id: file.id },
            data: {
              hash: null,
              size: 0,
              remoteModifiedAt: null,
              version: { increment: 1 },
            },
          });
          await recordFileChange({
            path: file.path,
            changeType: "FILE_DELETED",
            source: "SYNC",
            before: null,
            after: null,
            userId: null,
            sessionId: null,
          });
          detected += 1;
        }
        continue;
      }
      const remoteModified = new Date(remote.modified_at);
      const changed =
        remote.size !== file.size ||
        !file.remoteModifiedAt ||
        remoteModified.getTime() > file.remoteModifiedAt.getTime();

      if (!changed) continue;

      // Contenu recupere uniquement si le fichier reste raisonnable.
      if (remote.size > 500_000 || !/\.(lua|js|ts|json|cfg|sql|yml|yaml|md|txt|html|css|xml)$/i.test(name)) {
        await prisma.trackedFile.update({
          where: { id: file.id },
          data: { size: remote.size, remoteModifiedAt: remoteModified },
        });
        continue;
      }

      const content = await client.readFile(file.path).catch(() => null);
      if (content === null) continue;

      const hash = hashContent(content);
      if (file.hash === hash) {
        await prisma.trackedFile.update({
          where: { id: file.id },
          data: { size: remote.size, remoteModifiedAt: remoteModified },
        });
        continue;
      }

      await prisma.trackedFile.update({
        where: { id: file.id },
        data: {
          hash,
          size: remote.size,
          remoteModifiedAt: remoteModified,
          version: { increment: 1 },
        },
      });
      await recordFileChange({
        path: file.path,
        changeType: "FILE_MODIFIED",
        source: "SYNC",
        before: null,
        after: content,
        userId: null,
        sessionId: null,
      });
      detected += 1;
    }
  }

  return detected;
}

export function startWorkers(): void {
  if (globalForWorkers.__fdmWorkersStarted) return;
  globalForWorkers.__fdmWorkersStarted = true;

  runSafely("idle-sessions", () => detectIdleSessions(), 60_000);
  // Maintient le flux Wings ouvert pour alimenter logs + detection de bugs.
  runSafely("console-monitor", () => consoleRelay.startMonitoring(), 60_000);
  runSafely("scheduled-patchnotes", () => publishScheduledNotes(), 60_000);
  // Filet de securite : une session terminee sans rapport en recoit un.
  runSafely("report-backfill", () => backfillMissingReports(), 10 * 60_000);
  // Bilan IA des rapports recents (silencieux si la cle n'est pas configuree).
  runSafely(
    "ai-report-enrich",
    () => (isAiConfigured() ? enrichPendingReportSummaries() : Promise.resolve(0)),
    3 * 60_000,
  );
  runSafely(
    "expired-locks",
    () =>
      prisma.trackedFile.updateMany({
        where: { lockExpiresAt: { lt: new Date() } },
        data: { lockedById: null, lockedAt: null, lockExpiresAt: null },
      }),
    5 * 60_000,
  );

  const syncInterval = Math.max(60, Number(process.env.FILE_SYNC_INTERVAL_SECONDS ?? 180)) * 1000;
  runSafely("file-sync", () => syncTrackedFiles(), syncInterval);

  // Echantillonnage des ressources : alimente le module Surveillance.
  const metricsInterval = Math.max(30, Number(process.env.METRICS_INTERVAL_SECONDS ?? 60)) * 1000;
  runSafely("metrics-sampler", () => sampleMetrics(), metricsInterval);

  console.log("[workers] taches de fond demarrees");
}
