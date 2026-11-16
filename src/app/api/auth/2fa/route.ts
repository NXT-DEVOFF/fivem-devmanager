import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api } from "@/server/api";
import { badRequest, json, parseJson, unauthorized } from "@/server/http";
import {
  buildTwoFactorUri,
  decryptTwoFactorSecretOrThrow,
  generateRecoveryCodes,
  generateTwoFactorSecret,
  getCurrentUser,
  storeTwoFactorSecret,
  verifyPassword,
  verifyTwoFactorCode,
} from "@/server/auth";
import { sha256 } from "@/server/crypto";
import { audit } from "@/server/audit";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("setup") }),
  z.object({ action: z.literal("enable"), code: z.string().trim().min(6).max(10) }),
  z.object({ action: z.literal("disable"), password: z.string().min(1).max(200) }),
]);

export const POST = api(async (request) => {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  const body = await parseJson(request, schema);
  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) throw unauthorized();

  if (body.action === "setup") {
    if (record.twoFactorEnabled) throw badRequest("La double authentification est deja active");
    const secret = generateTwoFactorSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: storeTwoFactorSecret(secret) },
    });
    return json({
      secret,
      uri: buildTwoFactorUri(record.email, secret),
      issuer: "FiveM DevManager",
    });
  }

  if (body.action === "enable") {
    if (!record.twoFactorSecret) throw badRequest("Demarrez d'abord la configuration 2FA");
    const secret = decryptTwoFactorSecretOrThrow(record.twoFactorSecret);
    if (!verifyTwoFactorCode(secret, body.code)) {
      throw badRequest("Code invalide. Verifiez l'heure de votre appareil.");
    }
    const recoveryCodes = generateRecoveryCodes();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorRecoveryCodes: recoveryCodes.map((code) => sha256(code.toUpperCase())),
      },
    });
    await audit({
      actorId: user.id,
      actorLabel: user.displayName,
      action: "auth.2fa.enable",
      targetType: "user",
      targetId: user.id,
    });
    return json({ enabled: true, recoveryCodes });
  }

  if (!(await verifyPassword(record.passwordHash, body.password))) {
    throw badRequest("Mot de passe incorrect");
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecoveryCodes: [] },
  });
  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "auth.2fa.disable",
    targetType: "user",
    targetId: user.id,
  });
  return json({ enabled: false });
});
