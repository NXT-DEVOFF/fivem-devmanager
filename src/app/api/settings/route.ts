import { z } from "zod";
import { api } from "@/server/api";
import { json, parseJson } from "@/server/http";
import { requirePermission, requireUser } from "@/server/auth";
import { getSettings, updateSettings } from "@/server/settings";
import { audit } from "@/server/audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  serverName: z.string().trim().min(2).max(80).optional(),
  gameVersion: z.string().trim().max(80).optional(),
  currentVersion: z.string().trim().max(40).optional(),
  defaultIdleMinutes: z.number().int().min(1).max(180).optional(),
  autoValidationEnabled: z.boolean().optional(),
  timezone: z.string().trim().max(60).optional(),
});

export const GET = api(async () => {
  await requireUser();
  const settings = await getSettings();
  const counts = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.fileChange.count(),
    prisma.devSession.count(),
  ]);
  return json({
    settings,
    stats: { users: counts[0], changes: counts[1], sessions: counts[2] },
    runtime: {
      nodeVersion: process.version,
      demoMode: process.env.DEMO_MODE === "true",
      aiConfigured: Boolean(process.env.AI_API_KEY),
    },
  });
});

export const PUT = api(async (request) => {
  const actor = await requirePermission("settings.manage");
  const body = await parseJson(request, schema);
  const settings = await updateSettings(body, actor.id);

  await audit({
    actorId: actor.id,
    actorLabel: actor.displayName,
    action: "settings.update",
    targetType: "settings",
    metadata: body,
  });

  return json({ settings });
});
