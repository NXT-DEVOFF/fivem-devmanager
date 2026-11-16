import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api } from "@/server/api";
import { badRequest, json, notFound, parseJson } from "@/server/http";
import {
  generateTemporaryPassword,
  hashPassword,
  requirePermission,
  revokeAllSessions,
  validatePasswordStrength,
} from "@/server/auth";
import { audit } from "@/server/audit";
import { notify } from "@/server/notifications";

const schema = z.object({
  newPassword: z.string().min(12).max(200).optional(),
});

/** Reinitialisation du mot de passe par un administrateur. */
export const POST = api(async (request, context) => {
  const actor = await requirePermission("users.manage");
  const { id } = await context.params;
  const body = await parseJson(request, schema).catch(() => ({} as z.infer<typeof schema>));

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw notFound("Utilisateur introuvable");
  if (target.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") {
    throw badRequest("Seul un super administrateur peut reinitialiser ce compte");
  }

  let password = body.newPassword;
  if (password) {
    const strengthError = validatePasswordStrength(password);
    if (strengthError) throw badRequest(strengthError);
  } else {
    password = generateTemporaryPassword();
  }

  await prisma.user.update({
    where: { id },
    data: {
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  const revoked = await revokeAllSessions(id);

  await audit({
    actorId: actor.id,
    actorLabel: actor.displayName,
    action: "auth.password.reset",
    targetType: "user",
    targetId: id,
    metadata: { sessionsRevoked: revoked, generated: !body.newPassword },
  });

  await notify(id, {
    type: "security",
    title: "Mot de passe reinitialise",
    body: `${actor.displayName} a reinitialise votre mot de passe. Toutes vos sessions ont ete deconnectees.`,
    link: "/change-password",
  });

  return json({
    ok: true,
    temporaryPassword: body.newPassword ? undefined : password,
    sessionsRevoked: revoked,
  });
});
