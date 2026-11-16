/**
 * Authentification : argon2id, sessions serveur, 2FA TOTP, verrouillage.
 * Aucun mot de passe ni secret n'est expose au client.
 */
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import * as OTPAuth from "otpauth";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toStringArray } from "@/lib/json-array";
import { randomToken, sha256, encryptSecret, decryptSecret, tryDecryptSecret } from "@/server/crypto";
import { SESSION_COOKIE, findAuthSession } from "@/server/session-store";
import {
  hasPermission,
  resolvePermissions,
  type Permission,
  type PermissionMap,
} from "@/server/permissions";
import { forbidden, unauthorized, tooManyRequests, HttpError } from "@/server/http";

export { SESSION_COOKIE };
const PASSWORD_MIN_LENGTH = 12;
// Un cookie Secure n'est envoye qu'en HTTPS. Sur un deploiement HTTP direct,
// il faut le desactiver pour que la session puisse fonctionner.
const secureCookies = (process.env.APP_URL ?? "").startsWith("https://");

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: Role;
  avatarColor: string;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  permissions: PermissionMap;
  permissionsGranted: string[];
  permissionsDenied: string[];
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Mots de passe
// ---------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  // @node-rs/argon2 utilise Argon2id par defaut.
  return argonHash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await argonVerify(passwordHash, password);
  } catch {
    return false;
  }
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (!/[A-Z]/.test(password)) return "Le mot de passe doit contenir une majuscule.";
  if (!/[a-z]/.test(password)) return "Le mot de passe doit contenir une minuscule.";
  if (!/[0-9]/.test(password)) return "Le mot de passe doit contenir un chiffre.";
  return null;
}

export function generateTemporaryPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%*-_+";
  const pick = (alphabet: string) => alphabet[Math.floor(Math.random() * alphabet.length)]!;
  const core = Array.from({ length: 12 }, () => pick(upper + lower + digits)).join("");
  return `${pick(upper)}${pick(lower)}${pick(digits)}${pick(symbols)}${core}`;
}

// ---------------------------------------------------------------------------
// 2FA (TOTP)
// ---------------------------------------------------------------------------

function buildTotp(label: string, secretBase32: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: "FiveM DevManager",
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

export function generateTwoFactorSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function buildTwoFactorUri(email: string, secretBase32: string): string {
  return buildTotp(email, secretBase32).toString();
}

export function verifyTwoFactorCode(secretBase32: string, code: string): boolean {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const totp = buildTotp("verification", secretBase32);
  const delta = totp.validate({ token: normalized, window: 1 });
  return delta !== null;
}

export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomToken(6).replace(/[-_]/g, "").toUpperCase().slice(0, 10);
    return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
  });
}

// ---------------------------------------------------------------------------
// Sessions d'authentification
// ---------------------------------------------------------------------------

export interface SessionContext {
  ip?: string | null;
  userAgent?: string | null;
}

export function describeDevice(userAgent: string | null | undefined): string {
  if (!userAgent) return "Appareil inconnu";
  const ua = userAgent.toLowerCase();
  const os = ua.includes("windows")
    ? "Windows"
    : ua.includes("mac os")
      ? "macOS"
      : ua.includes("android")
        ? "Android"
        : ua.includes("iphone") || ua.includes("ipad")
          ? "iOS"
          : ua.includes("linux")
            ? "Linux"
            : "Inconnu";
  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("chrome")
      ? "Chrome"
      : ua.includes("firefox")
        ? "Firefox"
        : ua.includes("safari")
          ? "Safari"
          : "Navigateur";
  return `${browser} · ${os}`;
}

export async function createAuthSession(
  userId: string,
  context: SessionContext = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const days = Number(process.env.AUTH_SESSION_DAYS ?? 30) || 30;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await prisma.authSession.create({
    data: {
      userId,
      tokenHash: sha256(token),
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null,
      deviceName: describeDevice(context.userAgent),
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: secureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Utilisateur courant, mis en cache pour la duree de la requete.
 * Verifie le hash du token, l'expiration, la revocation et le statut du compte.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await findAuthSession(token);
  if (!session) return null;

  // Mise a jour paresseuse de l'activite (evite une ecriture par requete).
  if (Date.now() - session.lastUsedAt.getTime() > 5 * 60 * 1000) {
    await prisma.authSession
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
    await prisma.user
      .update({ where: { id: session.userId }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  return {
    id: session.user.id,
    email: session.user.email,
    username: session.user.username,
    displayName: session.user.displayName,
    role: session.user.role,
    avatarColor: session.user.avatarColor,
    mustChangePassword: session.user.mustChangePassword,
    twoFactorEnabled: session.user.twoFactorEnabled,
    permissions: resolvePermissions(session.user),
    permissionsGranted: toStringArray(session.user.permissionsGranted),
    permissionsDenied: toStringArray(session.user.permissionsDenied),
    sessionId: session.id,
  };
});

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  if (user.mustChangePassword) {
    throw new HttpError(403, "Changement de mot de passe requis", "password_change_required");
  }
  return user;
}

export async function requirePermission(permission: Permission): Promise<AuthUser> {
  const user = await requireUser();
  // Les overrides granulaires sont pris en compte (grant/deny).
  if (!hasPermission(user, permission)) {
    throw forbidden(`Permission requise : ${permission}`);
  }
  return user;
}

export async function revokeAuthSession(sessionId: string, userId?: string): Promise<void> {
  await prisma.authSession.updateMany({
    where: { id: sessionId, ...(userId ? { userId } : {}) },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const result = await prisma.authSession.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

export async function recordLoginEvent(input: {
  userId?: string | null;
  email: string;
  success: boolean;
  reason?: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await prisma.loginEvent.create({
    data: {
      userId: input.userId ?? null,
      email: input.email.slice(0, 320),
      success: input.success,
      reason: input.reason?.slice(0, 200) ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent?.slice(0, 500) ?? null,
    },
  });
}

/** Rate limit de connexion : en memoire + verrouillage persistant par compte. */
export async function assertLoginAllowed(email: string, ip: string | null): Promise<void> {
  const windowMs = 10 * 60 * 1000;
  const maxAttempts = Number(process.env.LOGIN_MAX_ATTEMPTS ?? 8) || 8;
  const key = `login:${email.toLowerCase()}:${ip ?? "unknown"}`;
  const { rateLimit } = await import("@/server/http");
  const limited = rateLimit(key, maxAttempts, windowMs);
  if (!limited.ok) {
    throw tooManyRequests(
      `Trop de tentatives de connexion. Reessayez dans ${limited.retryAfter} secondes.`,
    );
  }

  const recentFailures = await prisma.loginEvent.count({
    where: {
      email: email.toLowerCase(),
      success: false,
      createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
    },
  });
  if (recentFailures >= maxAttempts * 2) {
    throw tooManyRequests("Compte temporairement verrouille suite a de nombreuses tentatives.");
  }
}

export function isLocked(user: { lockedUntil: Date | null }): boolean {
  return Boolean(user.lockedUntil && user.lockedUntil.getTime() > Date.now());
}

// ---------------------------------------------------------------------------
// Secrets 2FA
// ---------------------------------------------------------------------------

export function readTwoFactorSecret(encrypted: string | null): string | null {
  return tryDecryptSecret(encrypted);
}

export function storeTwoFactorSecret(secretBase32: string): string {
  return encryptSecret(secretBase32);
}

export function decryptTwoFactorSecretOrThrow(encrypted: string | null): string {
  if (!encrypted) throw forbidden("2FA non configuree");
  return decryptSecret(encrypted);
}
