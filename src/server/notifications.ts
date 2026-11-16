/** Notifications internes (persistees + temps reel). */
import "server-only";
import { prisma } from "@/lib/prisma";
import { emitToUser } from "@/server/realtime";

export interface NotificationInput {
  type: string;
  title: string;
  body?: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export async function notify(userId: string, input: NotificationInput): Promise<void> {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type: input.type,
      title: input.title.slice(0, 200),
      body: input.body?.slice(0, 1000) ?? null,
      link: input.link ?? null,
      metadata: (input.metadata ?? {}) as object,
    },
  });

  emitToUser(userId, "notification:new", {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    createdAt: notification.createdAt.toISOString(),
  });
}

export async function notifyMany(userIds: string[], input: NotificationInput): Promise<void> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  await Promise.all(unique.map((userId) => notify(userId, input).catch(() => undefined)));
}
