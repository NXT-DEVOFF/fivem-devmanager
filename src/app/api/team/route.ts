import { api } from "@/server/api";
import { json } from "@/server/http";
import { requireUser } from "@/server/auth";
import { prisma } from "@/lib/prisma";

/**
 * Annuaire minimal de l'equipe, accessible a tout utilisateur authentifie.
 * Aucune donnee sensible (email, permissions, historique) n'est exposee.
 */
export const GET = api(async () => {
  await requireUser();
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true, username: true, role: true, avatarColor: true, jobTitle: true },
  });
  return json({ users });
});
