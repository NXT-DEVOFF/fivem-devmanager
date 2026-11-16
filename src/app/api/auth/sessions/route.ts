import { api } from "@/server/api";
import { json, unauthorized } from "@/server/http";
import { getCurrentUser, revokeAllSessions } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";

export const GET = api(async () => {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();

  const sessions = await prisma.authSession.findMany({
    where: { userId: user.id },
    orderBy: { lastUsedAt: "desc" },
    take: 50,
    select: {
      id: true,
      deviceName: true,
      ip: true,
      userAgent: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  return json({
    currentSessionId: user.sessionId,
    sessions: sessions.map((session) => ({
      ...session,
      isCurrent: session.id === user.sessionId,
      active: !session.revokedAt && session.expiresAt.getTime() > Date.now(),
    })),
  });
});

/** Revoque toutes les autres sessions de l'utilisateur courant. */
export const DELETE = api(async () => {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();

  const count = await revokeAllSessions(user.id, user.sessionId);
  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "auth.session.revoke",
    targetType: "user",
    targetId: user.id,
    metadata: { revoked: count, scope: "all-others" },
  });
  return json({ revoked: count });
});
