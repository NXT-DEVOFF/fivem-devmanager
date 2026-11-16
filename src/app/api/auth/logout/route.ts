import { api } from "@/server/api";
import { json, getClientIp, getUserAgent } from "@/server/http";
import { clearSessionCookie, getCurrentUser, revokeAuthSession } from "@/server/auth";
import { audit } from "@/server/audit";

export const POST = api(async (request) => {
  const user = await getCurrentUser();
  if (user) {
    await revokeAuthSession(user.sessionId, user.id);
    await audit({
      actorId: user.id,
      actorLabel: user.displayName,
      action: "auth.logout",
      ip: getClientIp(request),
      userAgent: getUserAgent(request),
    });
  }
  await clearSessionCookie();
  return json({ ok: true });
});
