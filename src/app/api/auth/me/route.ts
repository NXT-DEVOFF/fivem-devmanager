import { api } from "@/server/api";
import { json } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { effectivePermissionList } from "@/server/permissions";
import { prisma } from "@/lib/prisma";

export const GET = api(async () => {
  const user = await getCurrentUser();
  if (!user) return json({ user: null }, { status: 200 });

  const [unreadNotifications, activeSession] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.devSession.findFirst({
      where: { userId: user.id, status: { in: ["ACTIVE", "PAUSED"] } },
      select: { id: true, status: true, startedAt: true, number: true },
    }),
  ]);

  return json({
    user: {
      ...user,
      permissions: effectivePermissionList(user),
    },
    unreadNotifications,
    activeSession,
  });
});
