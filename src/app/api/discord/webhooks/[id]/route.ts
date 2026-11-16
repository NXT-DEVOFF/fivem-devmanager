import { z } from "zod";
import { api } from "@/server/api";
import { json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/server/crypto";
import { validateWebhookInput } from "@/server/discord";
import { audit } from "@/server/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  enabled: z.boolean().optional(),
  username: z.string().trim().max(80).nullable().optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
  url: z.string().url().max(500).optional(),
});

export const PATCH = api(async (request, context) => {
  const user = await requirePermission("discord.manage");
  const { id } = await context.params;
  const body = await parseJson(request, schema);

  const existing = await prisma.discordWebhook.findUnique({ where: { id } });
  if (!existing) throw notFound("Webhook introuvable");
  if (body.url) validateWebhookInput(body.url);

  const updated = await prisma.discordWebhook.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(body.username !== undefined ? { username: body.username } : {}),
      ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
      ...(body.url ? { urlEnc: encryptSecret(body.url), lastError: null } : {}),
    },
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "discord.webhook.save",
    targetType: "discord_webhook",
    targetId: id,
    metadata: { fields: Object.keys(body) },
  });

  return json({
    webhook: {
      id: updated.id,
      name: updated.name,
      kind: updated.kind,
      enabled: updated.enabled,
    },
  });
});

export const DELETE = api(async (_request, context) => {
  const user = await requirePermission("discord.manage");
  const { id } = await context.params;
  const existing = await prisma.discordWebhook.findUnique({ where: { id } });
  if (!existing) throw notFound("Webhook introuvable");

  await prisma.discordWebhook.delete({ where: { id } });
  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "discord.webhook.delete",
    targetType: "discord_webhook",
    targetId: id,
    metadata: { name: existing.name, kind: existing.kind },
  });

  return json({ ok: true });
});
