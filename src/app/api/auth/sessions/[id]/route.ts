import { api } from "@/server/api";
import { json, notFound, unauthorized } from "@/server/http";
import { getCurrentUser, revokeAuthSession } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";

export const DELETE = api(async (_request, context) => {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  const { id } = await context.params;

  const session = await prisma.authSession.findFirst({ where: { id, userId: user.id } });
  if (!session) throw notFound("Session introuvable");
  if (session.id === user.sessionId) {
    return json({ error: "Utilisez la deconnexion pour la session courante", code: "current_session" }, { status: 400 });
  }

  await revokeAuthSession(session.id, user.id);
  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "auth.session.revoke",
    targetType: "auth_session",
    targetId: session.id,
  });
  return json({ ok: true });
});
