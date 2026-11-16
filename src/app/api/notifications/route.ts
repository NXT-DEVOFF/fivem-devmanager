import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api } from "@/server/api";
import { json, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth";

const schema = z.object({
  ids: z.array(z.string()).max(200).optional(),
  all: z.boolean().optional(),
  preferences: z
    .object({
      sessions: z.boolean().optional(),
      tasks: z.boolean().optional(),
      bugs: z.boolean().optional(),
      deployments: z.boolean().optional(),
      reports: z.boolean().optional(),
      security: z.boolean().optional(),
    })
    .optional(),
});

export const GET = api(async (request) => {
  const user = await requireUser();
  const params = new URL(request.url).searchParams;
  const filter = params.get("filter") ?? "all";
  const limit = Math.min(Number(params.get("limit") ?? 50) || 50, 100);

  const notifications = await prisma.notification.findMany({
    where: {
      userId: user.id,
      ...(filter === "unread" ? { readAt: null } : {}),
      ...(filter !== "all" && filter !== "unread" ? { type: { startsWith: filter } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const unread = await prisma.notification.count({ where: { userId: user.id, readAt: null } });
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { notificationPrefs: true },
  });

  return json({
    notifications: notifications.map((notification) => ({
      ...notification,
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt?.toISOString() ?? null,
    })),
    unread,
    preferences: record?.notificationPrefs ?? {},
  });
});

export const PATCH = api(async (request) => {
  const user = await requireUser();
  const body = await parseJson(request, schema);

  if (body.preferences) {
    await prisma.user.update({
      where: { id: user.id },
      data: { notificationPrefs: body.preferences },
    });
    return json({ ok: true, preferences: body.preferences });
  }

  const result = await prisma.notification.updateMany({
    where: {
      userId: user.id,
      readAt: null,
      ...(body.all ? {} : body.ids?.length ? { id: { in: body.ids } } : { id: "__none__" }),
    },
    data: { readAt: new Date() },
  });

  return json({ updated: result.count });
});
