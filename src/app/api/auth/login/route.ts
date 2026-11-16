import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { toStringArray } from "@/lib/json-array";
import { api } from "@/server/api";
import { json, parseJson, getClientIp, getUserAgent, unauthorized, forbidden } from "@/server/http";
import {
  assertLoginAllowed,
  createAuthSession,
  isLocked,
  recordLoginEvent,
  setSessionCookie,
  verifyPassword,
  verifyTwoFactorCode,
} from "@/server/auth";
import { sha256 } from "@/server/crypto";
import { resolvePermissions } from "@/server/permissions";
import { audit } from "@/server/audit";

const schema = z.object({
  email: z.string().trim().toLowerCase().min(3).max(320),
  password: z.string().min(1).max(200),
  totp: z.string().trim().max(32).optional(),
});

export const POST = api(async (request) => {
  const body = await parseJson(request, schema);
  const ip = getClientIp(request);
  const userAgent = getUserAgent(request);

  await assertLoginAllowed(body.email, ip);

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  const genericError = "Identifiants invalides";

  if (!user || !user.isActive) {
    await recordLoginEvent({ email: body.email, success: false, reason: "inconnu", ip, userAgent });
    throw unauthorized(genericError);
  }

  if (isLocked(user)) {
    await recordLoginEvent({
      userId: user.id,
      email: body.email,
      success: false,
      reason: "verrouille",
      ip,
      userAgent,
    });
    throw forbidden(
      "Compte temporairement verrouille apres plusieurs echecs. Reessayez dans quelques minutes.",
    );
  }

  const passwordOk = await verifyPassword(user.passwordHash, body.password);
  if (!passwordOk) {
    const attempts = user.failedLoginCount + 1;
    const maxAttempts = Number(process.env.LOGIN_MAX_ATTEMPTS ?? 8) || 8;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: attempts,
        lockedUntil:
          attempts >= maxAttempts
            ? new Date(Date.now() + (Number(process.env.LOGIN_LOCK_MINUTES ?? 15) || 15) * 60_000)
            : null,
      },
    });
    await recordLoginEvent({
      userId: user.id,
      email: body.email,
      success: false,
      reason: "mot de passe invalide",
      ip,
      userAgent,
    });
    throw unauthorized(genericError);
  }

  // Verification de la double authentification.
  if (user.twoFactorEnabled) {
    if (!body.totp) {
      return json({ error: "Code de double authentification requis", code: "totp_required" }, { status: 401 });
    }
    const secret = user.twoFactorSecret;
    const isRecoveryCode = body.totp.includes("-");
    let valid = false;

    if (isRecoveryCode) {
      const hash = sha256(body.totp.toUpperCase());
      const recoveryCodes = toStringArray(user.twoFactorRecoveryCodes);
      if (recoveryCodes.includes(hash)) {
        valid = true;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            twoFactorRecoveryCodes: recoveryCodes.filter((code) => code !== hash),
          },
        });
      }
    } else if (secret) {
      const { decryptTwoFactorSecretOrThrow } = await import("@/server/auth");
      valid = verifyTwoFactorCode(decryptTwoFactorSecretOrThrow(secret), body.totp);
    }

    if (!valid) {
      // Un code 2FA invalide est une tentative de connexion ratee : sans ce
      // compteur, un mot de passe vole pouvait etre combine a une force brute
      // du code a 6 chiffres sans jamais verrouiller le compte.
      const attempts = user.failedLoginCount + 1;
      const maxAttempts = Number(process.env.LOGIN_MAX_ATTEMPTS ?? 8) || 8;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: attempts,
          lockedUntil:
            attempts >= maxAttempts
              ? new Date(Date.now() + (Number(process.env.LOGIN_LOCK_MINUTES ?? 15) || 15) * 60_000)
              : null,
        },
      });
      await recordLoginEvent({
        userId: user.id,
        email: body.email,
        success: false,
        reason: "2FA invalide",
        ip,
        userAgent,
      });
      throw unauthorized("Code de double authentification invalide");
    }
  }

  const { token, expiresAt } = await createAuthSession(user.id, { ip, userAgent });
  await setSessionCookie(token, expiresAt);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date(), lastSeenAt: new Date() },
  });

  await recordLoginEvent({ userId: user.id, email: body.email, success: true, ip, userAgent });
  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "auth.login",
    ip,
    userAgent,
    metadata: { twoFactor: user.twoFactorEnabled },
  });

  return json({
    user: {
      id: updated.id,
      email: updated.email,
      username: updated.username,
      displayName: updated.displayName,
      role: updated.role,
      avatarColor: updated.avatarColor,
      mustChangePassword: updated.mustChangePassword,
      permissions: resolvePermissions(updated),
    },
  });
});
