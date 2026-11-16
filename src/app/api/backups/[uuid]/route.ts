import { z } from "zod";
import { api } from "@/server/api";
import { badRequest, json, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { resolvePterodactyl } from "@/server/integrations";
import { audit } from "@/server/audit";
import { emitActivity } from "@/server/realtime";

const uuidSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F-]{8,64}$/, "Identifiant de sauvegarde invalide");

const actionSchema = z.object({ action: z.literal("restore") });

async function readUuid(context: { params: Promise<Record<string, string>> }): Promise<string> {
  const { uuid } = await context.params;
  const parsed = uuidSchema.safeParse(uuid);
  if (!parsed.success) throw badRequest("Identifiant de sauvegarde invalide");
  return parsed.data;
}

/** URL de telechargement signee, generee par le panel (valable temporairement). */
export const GET = api(async (_request, context) => {
  const user = await requirePermission("backups.manage");
  const uuid = await readUuid(context);

  const { client } = await resolvePterodactyl();
  const url = await client.backupDownloadUrl(uuid);

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "backup.download",
    targetType: "pterodactyl_backup",
    targetId: uuid,
  });

  return json({ url });
});

export const POST = api(async (request, context) => {
  const user = await requirePermission("backups.manage");
  const uuid = await readUuid(context);
  await parseJson(request, actionSchema);

  const { client } = await resolvePterodactyl();
  await client.restoreBackup(uuid);

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "backup.restore",
    targetType: "pterodactyl_backup",
    targetId: uuid,
  });

  emitActivity({
    type: "server.status",
    title: "Restauration de sauvegarde lancee",
    detail: uuid,
    actor: { id: user.id, name: user.displayName },
    timestamp: new Date().toISOString(),
  });

  return json({ ok: true });
});

export const DELETE = api(async (_request, context) => {
  const user = await requirePermission("backups.manage");
  const uuid = await readUuid(context);

  const { client } = await resolvePterodactyl();
  await client.deleteBackup(uuid);

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "backup.delete",
    targetType: "pterodactyl_backup",
    targetId: uuid,
  });

  emitActivity({
    type: "server.status",
    title: "Sauvegarde supprimee",
    detail: uuid,
    actor: { id: user.id, name: user.displayName },
    timestamp: new Date().toISOString(),
  });

  return json({ ok: true });
});
