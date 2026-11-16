/**
 * Surveillance du serveur : echantillonnage periodique des ressources
 * Pterodactyl et lecture agregee pour l'historique.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { getPterodactylConfig, resolvePterodactyl } from "@/server/integrations";

/** Duree de conservation des echantillons (jours). */
export const RETENTION_DAYS = 14;

export const METRIC_RANGES = [
  { id: "1h", label: "1 heure", windowMs: 60 * 60_000, bucketMs: 60_000 },
  { id: "6h", label: "6 heures", windowMs: 6 * 60 * 60_000, bucketMs: 3 * 60_000 },
  { id: "24h", label: "24 heures", windowMs: 24 * 60 * 60_000, bucketMs: 12 * 60_000 },
  { id: "7d", label: "7 jours", windowMs: 7 * 24 * 60 * 60_000, bucketMs: 60 * 60_000 },
] as const;

export type MetricRange = (typeof METRIC_RANGES)[number];
export type MetricRangeId = MetricRange["id"];

export function resolveRange(id: string | null): MetricRange {
  return METRIC_RANGES.find((range) => range.id === id) ?? METRIC_RANGES[2];
}

export interface MetricPoint {
  t: string;
  cpu: number;
  memory: number;
  memoryLimit: number;
  disk: number;
  diskLimit: number;
  state: string;
  uptime: number;
}

export interface MetricSummary {
  samples: number;
  avgCpu: number;
  maxCpu: number;
  avgMemory: number;
  maxMemory: number;
  memoryLimit: number;
  disk: number;
  diskLimit: number;
  uptime: number;
}

function toNumber(value: bigint | number | null | undefined): number {
  if (typeof value === "bigint") return Number(value);
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toBigInt(value: number | null | undefined): bigint {
  if (!value || !Number.isFinite(value)) return BigInt(0);
  return BigInt(Math.max(0, Math.round(value)));
}

/**
 * Enregistre un echantillon des ressources du serveur. Retourne false quand
 * Pterodactyl n'est pas configure ou injoignable : le worker continue sans
 * ecrire de valeur inventee.
 */
export async function sampleMetrics(): Promise<boolean> {
  const config = await getPterodactylConfig();
  if (!config) return false;

  const { client } = await resolvePterodactyl();
  const payload = await client.getResources();
  const resources = payload?.resources;
  if (!resources) return false;

  await prisma.metricSample.create({
    data: {
      state: (payload.current_state ?? "unknown").slice(0, 32),
      cpuPercent: Number(resources.cpu_absolute ?? 0),
      memoryBytes: toBigInt(resources.memory_bytes),
      memoryLimitBytes: toBigInt(resources.memory_limit_bytes),
      diskBytes: toBigInt(resources.disk_bytes),
      diskLimitBytes: toBigInt(resources.disk_limit_bytes),
      networkRxBytes: toBigInt(resources.network_rx_bytes),
      networkTxBytes: toBigInt(resources.network_tx_bytes),
      uptimeSeconds: Math.max(0, Math.round((resources.uptime ?? 0) / 1000)),
    },
  });

  await pruneOldSamples();

  return true;
}

/**
 * Purge des echantillons trop anciens. Le nettoyage est limite a une fois par
 * heure : inutile de lancer un DELETE a chaque releve (toutes les 60 s).
 */
let lastPruneAt = 0;

async function pruneOldSamples(): Promise<void> {
  if (Date.now() - lastPruneAt < 60 * 60_000) return;
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60_000);
  await prisma.metricSample.deleteMany({ where: { recordedAt: { lt: cutoff } } });
  lastPruneAt = Date.now();
}

export interface MetricsPayload {
  range: { id: string; label: string; bucketMs: number };
  points: MetricPoint[];
  summary: MetricSummary | null;
  latest: {
    state: string;
    cpu: number;
    memory: number;
    memoryLimit: number;
    disk: number;
    diskLimit: number;
    uptime: number;
    recordedAt: string;
  } | null;
}

export async function getMetrics(rangeInput: string | null): Promise<MetricsPayload> {
  const range = resolveRange(rangeInput);
  const since = new Date(Date.now() - range.windowMs);

  // Tri decroissant puis inversion : si la limite est atteinte, ce sont les
  // echantillons les plus recents qui sont conserves, jamais les plus anciens.
  const rows = (
    await prisma.metricSample.findMany({
      where: { recordedAt: { gte: since } },
      orderBy: { recordedAt: "desc" },
      take: 20_000,
    })
  ).reverse();

  const buckets = new Map<
    number,
    {
      cpu: number;
      memory: number;
      memoryLimit: number;
      disk: number;
      diskLimit: number;
      uptime: number;
      samples: number;
      state: string;
      at: number;
    }
  >();

  for (const row of rows) {
    const at = row.recordedAt.getTime();
    const key = Math.floor(at / range.bucketMs);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.cpu += row.cpuPercent;
      bucket.memory += toNumber(row.memoryBytes);
      bucket.memoryLimit = Math.max(bucket.memoryLimit, toNumber(row.memoryLimitBytes));
      bucket.disk = toNumber(row.diskBytes);
      bucket.diskLimit = Math.max(bucket.diskLimit, toNumber(row.diskLimitBytes));
      bucket.uptime = Math.max(bucket.uptime, row.uptimeSeconds);
      bucket.samples += 1;
      bucket.state = row.state;
      bucket.at = at;
    } else {
      buckets.set(key, {
        cpu: row.cpuPercent,
        memory: toNumber(row.memoryBytes),
        memoryLimit: toNumber(row.memoryLimitBytes),
        disk: toNumber(row.diskBytes),
        diskLimit: toNumber(row.diskLimitBytes),
        uptime: row.uptimeSeconds,
        samples: 1,
        state: row.state,
        at,
      });
    }
  }

  const points: MetricPoint[] = [...buckets.values()]
    .sort((a, b) => a.at - b.at)
    .map((bucket) => ({
      t: new Date(bucket.at).toISOString(),
      cpu: Number((bucket.cpu / bucket.samples).toFixed(2)),
      memory: Math.round(bucket.memory / bucket.samples),
      memoryLimit: bucket.memoryLimit,
      disk: bucket.disk,
      diskLimit: bucket.diskLimit,
      state: bucket.state,
      uptime: bucket.uptime,
    }));

  // Pas de Math.max(...rows) : sur 7 jours cela depasse la limite d'arguments
  // de V8 (Maximum call stack size exceeded).
  const maxOf = (pick: (row: (typeof rows)[number]) => number): number => {
    let max = 0;
    for (const row of rows) max = Math.max(max, pick(row));
    return max;
  };

  const summary: MetricSummary | null =
    rows.length === 0
      ? null
      : {
          samples: rows.length,
          avgCpu: Number(
            (rows.reduce((sum, row) => sum + row.cpuPercent, 0) / rows.length).toFixed(2),
          ),
          maxCpu: Number(maxOf((row) => row.cpuPercent).toFixed(2)),
          avgMemory: Math.round(
            rows.reduce((sum, row) => sum + toNumber(row.memoryBytes), 0) / rows.length,
          ),
          maxMemory: maxOf((row) => toNumber(row.memoryBytes)),
          memoryLimit: maxOf((row) => toNumber(row.memoryLimitBytes)),
          disk: toNumber(rows[rows.length - 1]?.diskBytes),
          diskLimit: toNumber(rows[rows.length - 1]?.diskLimitBytes),
          uptime: rows[rows.length - 1]?.uptimeSeconds ?? 0,
        };

  const last = rows[rows.length - 1];
  const latest = last
    ? {
        state: last.state,
        cpu: Number(last.cpuPercent.toFixed(2)),
        memory: toNumber(last.memoryBytes),
        memoryLimit: toNumber(last.memoryLimitBytes),
        disk: toNumber(last.diskBytes),
        diskLimit: toNumber(last.diskLimitBytes),
        uptime: last.uptimeSeconds,
        recordedAt: last.recordedAt.toISOString(),
      }
    : null;

  return {
    range: { id: range.id, label: range.label, bucketMs: range.bucketMs },
    points,
    summary,
    latest,
  };
}
