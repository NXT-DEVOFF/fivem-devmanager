/**
 * Acces bas niveau aux sessions d'authentification.
 *
 * Ce module ne depend ni d'argon2 ni de next/headers : il peut etre utilise
 * par la couche temps reel (instrumentation Next) sans embarquer les modules
 * de hachage de mots de passe.
 */
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/server/crypto";

export const SESSION_COOKIE = "fdm_session";

/** Retourne la session valide et son utilisateur, ou null. */
export async function findAuthSession(token: string) {
  const session = await prisma.authSession.findFirst({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (!session.user.isActive) return null;

  return session;
}
