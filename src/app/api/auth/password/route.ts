import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api } from "@/server/api";
import { badRequest, json, parseJson, unauthorized } from "@/server/http";
import {
  getCurrentUser,
  hashPassword,
  revokeAllSessions,
  validatePasswordStrength,
  verifyPassword,
} from "@/server/auth";
import { audit } from "@/server/audit";

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).max(200),
});

export const POST = api(async (request) => {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();

  const body = await parseJson(request, schema);
  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) throw unauthorized();

  if (!(await verifyPassword(record.passwordHash, body.currentPassword))) {
    throw badRequest("Mot de passe actuel incorrect");
  }
  const strengthError = validatePasswordStrength(body.newPassword);
  if (strengthError) throw badRequest(strengthError);
  if (body.currentPassword === body.newPassword) {
    throw badRequest("Le nouveau mot de passe doit etre different de l'ancien");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(body.newPassword),
      mustChangePassword: false,
    },
  });

  // Toutes les autres sessions sont invalidees apres un changement de mot de passe.
  await revokeAllSessions(user.id, user.sessionId);

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "auth.password.change",
    targetType: "user",
    targetId: user.id,
  });

  return json({ ok: true });
});
