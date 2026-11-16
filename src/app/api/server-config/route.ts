import { api } from "@/server/api";
import { json } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { getPterodactylConfig } from "@/server/integrations";
import { buildConfigReport, DEFAULT_CONFIG_PATH } from "@/lib/server-config";
import { readServerConfig } from "@/server/server-config";

/** Audit du server.cfg FiveM, lu via l'API Pterodactyl. */
export const GET = api(async (request) => {
  await requirePermission("server.view");
  const requested = new URL(request.url).searchParams.get("path") ?? DEFAULT_CONFIG_PATH;

  const configured = Boolean(await getPterodactylConfig());
  if (!configured) {
    return json({
      configured: false,
      ok: false,
      path: requested,
      error: "Pterodactyl n'est pas configure : renseignez le panel dans Infrastructure.",
      checks: [],
      settings: [],
      endpoints: { tcp: [], udp: [] },
      resources: { ensured: [], duplicates: [], missing: [], notStarted: [] },
      generatedAt: new Date().toISOString(),
      lineCount: 0,
      directiveCount: 0,
      aceCount: 0,
    });
  }

  const installed = await prisma.resource.findMany({
    select: { name: true, folder: true },
    orderBy: { name: "asc" },
  });

  try {
    const { path, content } = await readServerConfig(requested);
    return json({ configured: true, ...buildConfigReport(path, content, installed) });
  } catch (error) {
    return json({
      configured: true,
      ok: false,
      path: requested,
      error: error instanceof Error ? error.message : "Lecture du server.cfg impossible",
      generatedAt: new Date().toISOString(),
      lineCount: 0,
      directiveCount: 0,
      aceCount: 0,
      settings: [],
      endpoints: { tcp: [], udp: [] },
      resources: { ensured: [], duplicates: [], missing: [], notStarted: [] },
      checks: [],
    });
  }
});
