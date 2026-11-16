import { z } from "zod";
import { api } from "@/server/api";
import { json, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/server/crypto";
import { validateWebhookInput } from "@/server/discord";
import { audit } from "@/server/audit";

const kindSchema = z.enum([
  "PATCH_NOTES",
  "REPORTS",
  "ERRORS",
  "SESSIONS",
  "NOTIFICATIONS",
  "DEPLOYMENTS",
]);

export const GET = api(async () => {
  await requirePermission("discord.manage");
  const webhooks = await prisma.discordWebhook.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { deliveries: true } },
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, createdAt: true, error: true },
      },
    },
  });

  return json({
    // L'URL chiffree n'est JAMAIS renvoyee au navigateur.
    webhooks: webhooks.map((webhook) => ({
      id: webhook.id,
      name: webhook.name,
      kind: webhook.kind,
      enabled: webhook.enabled,
      username: webhook.username,
      avatarUrl: webhook.avatarUrl,
      lastUsedAt: webhook.lastUsedAt?.toISOString() ?? null,
      lastError: webhook.lastError,
      createdAt: webhook.createdAt.toISOString(),
      deliveryCount: webhook._count.deliveries,
      lastDelivery: webhook.deliveries[0]
        ? {
            status: webhook.deliveries[0].status,
            createdAt: webhook.deliveries[0].createdAt.toISOString(),
            error: webhook.deliveries[0].error,
          }
        : null,
    })),
  });
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  kind: kindSchema,
  url: z.string().url().max(500),
  username: z.string().trim().max(80).optional(),
  avatarUrl: z.string().url().max(500).optional(),
  enabled: z.boolean().default(true),
});

export const POST = api(async (request) => {
  const user = await requirePermission("discord.manage");
  const body = await parseJson(request, createSchema);
  validateWebhookInput(body.url);

  const webhook = await prisma.discordWebhook.create({
    data: {
      name: body.name,
      kind: body.kind,
      urlEnc: encryptSecret(body.url),
      username: body.username ?? null,
      avatarUrl: body.avatarUrl ?? null,
      enabled: body.enabled,
    },
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "discord.webhook.save",
    targetType: "discord_webhook",
    targetId: webhook.id,
    metadata: { name: body.name, kind: body.kind },
  });

  return json(
    {
      webhook: {
        id: webhook.id,
        name: webhook.name,
        kind: webhook.kind,
        enabled: webhook.enabled,
      },
    },
    201,
  );
});
