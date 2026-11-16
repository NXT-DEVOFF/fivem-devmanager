import { api } from "@/server/api";
import { json, forbidden, notFound } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { prisma } from "@/lib/prisma";

export const GET = api(async (_request, context) => {
  const user = await requirePermission("files.view");
  const { id } = await context.params;

  const change = await prisma.fileChange.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, displayName: true } },
      task: { select: { id: true, code: true, title: true } },
      session: { select: { id: true, number: true } },
      bug: { select: { id: true, code: true, title: true } },
    },
  });
  if (!change) throw notFound("Modification introuvable");
  if (!hasPermission(user, "sessions.view.all") && change.userId !== user.id) {
    throw forbidden("Acces non autorise");
  }

  return json({
    change: {
      ...change,
      createdAt: change.createdAt.toISOString(),
    },
  });
});
