import { z } from "zod";
import { api } from "@/server/api";
import { json, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import {
  getPterodactylConfig,
  getSftpConfig,
  savePterodactylConfig,
} from "@/server/integrations";
import { resolvePterodactyl } from "@/server/integrations";
import { audit } from "@/server/audit";
import { describeFileBackend } from "@/server/files";

const saveSchema = z.object({
  panelUrl: z.string().url().max(300),
  serverId: z.string().trim().min(1).max(120),
  serverIdentifier: z.string().trim().max(120).optional().nullable(),
  nodeId: z.string().trim().max(120).optional().nullable(),
  clientApiKey: z.string().trim().min(8).max(500).optional(),
  applicationApiKey: z.string().trim().max(500).optional().nullable(),
});

export const GET = api(async () => {
  await requirePermission("server.view");
  const config = await getPterodactylConfig();
  const sftp = await getSftpConfig();
  const backend = await describeFileBackend();

  if (!config) {
    return json({
      configured: false,
      backend,
      config: null,
      sftp: sftp
        ? { configured: true, host: sftp.host, port: sftp.port, username: sftp.username, authType: sftp.authType }
        : { configured: false },
    });
  }

  const summary = {
    id: config.id,
    name: config.name,
    panelUrl: config.panelUrl,
    serverId: config.serverId,
    serverIdentifier: config.serverIdentifier,
    nodeId: config.nodeId,
    hasClientKey: Boolean(config.clientApiKeyEnc),
    hasApplicationKey: Boolean(config.applicationApiKeyEnc),
    lastCheckedAt: config.lastCheckedAt?.toISOString() ?? null,
    lastError: config.lastError,
  };

  let live: {
    ok: boolean;
    error?: string;
    server?: { name: string; status: string | null; suspended: boolean; node: string };
    resources?: { state: string; cpu: number; memoryBytes: number; memoryLimitBytes: number; diskBytes: number; diskLimitBytes: number; uptimeMs: number; networkRx: number; networkTx: number };
    account?: string;
    sftpDetails?: { ip: string; port: number; username: string };
  };

  try {
    const { client } = await resolvePterodactyl();
    const [account, server, resources] = await Promise.all([
      client.getAccount(),
      client.getServer(),
      client.getResources(),
    ]);
    live = {
      ok: true,
      account: account.username,
      server: { name: server.name, status: server.status, suspended: server.is_suspended, node: server.node },
      sftpDetails: server.sftp_details,
      resources: {
        state: resources.current_state,
        cpu: resources.resources.cpu_absolute,
        memoryBytes: resources.resources.memory_bytes,
        memoryLimitBytes: server.limits.memory * 1024 * 1024,
        diskBytes: resources.resources.disk_bytes,
        diskLimitBytes: server.limits.disk * 1024 * 1024,
        uptimeMs: resources.resources.uptime,
        networkRx: resources.resources.network_rx_bytes,
        networkTx: resources.resources.network_tx_bytes,
      },
    };
    await import("@/lib/prisma").then(({ prisma }) =>
      prisma.pterodactylConfig.update({
        where: { id: config.id },
        data: { statusCache: live as object, lastCheckedAt: new Date(), lastError: null },
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    live = { ok: false, error: message };
    await import("@/lib/prisma").then(({ prisma }) =>
      prisma.pterodactylConfig.update({
        where: { id: config.id },
        data: { lastError: message.slice(0, 500), lastCheckedAt: new Date() },
      }),
    );
  }

  return json({
    configured: true,
    backend,
    config: summary,
    live,
    sftp: sftp
      ? {
          configured: true,
          host: sftp.host,
          port: sftp.port,
          username: sftp.username,
          authType: sftp.authType,
          remoteRoot: sftp.remoteRoot,
          lastCheckAt: sftp.lastCheckAt?.toISOString() ?? null,
          lastError: sftp.lastError,
        }
      : { configured: false },
  });
});

export const PUT = api(async (request) => {
  const actor = await requirePermission("integrations.manage");
  const body = await parseJson(request, saveSchema);

  if (!body.clientApiKey) {
    const existing = await getPterodactylConfig();
    if (!existing) {
      return json({ error: "La cle API Client est requise", code: "client_key_required" }, { status: 400 });
    }
  }

  const saved = await savePterodactylConfig({
    panelUrl: body.panelUrl,
    serverId: body.serverId,
    serverIdentifier: body.serverIdentifier,
    nodeId: body.nodeId,
    clientApiKey: body.clientApiKey,
    applicationApiKey: body.applicationApiKey,
  });

  await audit({
    actorId: actor.id,
    actorLabel: actor.displayName,
    action: "integration.pterodactyl.save",
    targetType: "pterodactyl_config",
    targetId: saved.id,
    metadata: { panelUrl: body.panelUrl, serverId: body.serverId },
  });

  return json({ ok: true, id: saved.id });
});
