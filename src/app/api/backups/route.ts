import { z } from "zod";
import { api } from "@/server/api";
import { json, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { resolvePterodactyl } from "@/server/integrations";
import { audit } from "@/server/audit";
import { emitActivity } from "@/server/realtime";

const createSchema = z.object({
  name: z.string().trim().max(120).optional(),
  ignored: z.string().trim().max(4000).optional(),
});

export const GET = api(async () => {
  await requirePermission("backups.view");
  const { client } = await resolvePterodactyl();
  const backups = await client.listBackups();
  return json({ backups });
});

export const POST = api(async (request) => {
  const user = await requirePermission("backups.manage");
  const body = await parseJson(request, createSchema);

  const { client } = await resolvePterodactyl();
  const backup = await client.createBackup({
    name: body.name || undefined,
    ignored: body.ignored || undefined,
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "backup.create",
    targetType: "pterodactyl_backup",
    targetId: backup.uuid,
    metadata: { name: backup.name, ignored: body.ignored ?? null },
  });

  emitActivity({
    type: "server.status",
    title: "Sauvegarde lancee",
    detail: backup.name,
    actor: { id: user.id, name: user.displayName },
    timestamp: new Date().toISOString(),
  });

  return json({ backup }, 201);
});
