import { api } from "@/server/api";
import { json } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { getPterodactylConfig } from "@/server/integrations";
import { getMetrics, RETENTION_DAYS } from "@/server/metrics";

/** Historique des ressources du serveur (echantillons du worker). */
export const GET = api(async (request) => {
  await requirePermission("monitoring.view");
  const range = new URL(request.url).searchParams.get("range");
  const configured = Boolean(await getPterodactylConfig());

  if (!configured) {
    return json({
      configured: false,
      retentionDays: RETENTION_DAYS,
      intervalSeconds: Math.max(30, Number(process.env.METRICS_INTERVAL_SECONDS ?? 60)),
      range: { id: "24h", label: "24 heures", bucketMs: 0 },
      points: [],
      summary: null,
      latest: null,
    });
  }

  const metrics = await getMetrics(range);
  return json({
    configured: true,
    retentionDays: RETENTION_DAYS,
    intervalSeconds: Math.max(30, Number(process.env.METRICS_INTERVAL_SECONDS ?? 60)),
    ...metrics,
  });
});
