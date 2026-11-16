import { z } from "zod";
import { api } from "@/server/api";
import { json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ body: z.string().trim().min(1).max(5000) });

export const POST = api(async (request, context) => {
  const user = await requirePermission("bugs.view");
  const { id } = await context.params;
  const body = await parseJson(request, schema);

  const bug = await prisma.bug.findUnique({ where: { id } });
  if (!bug) throw notFound("Bug introuvable");

  const comment = await prisma.bugComment.create({
    data: { bugId: id, authorId: user.id, body: body.body },
    include: { author: { select: { id: true, displayName: true, avatarColor: true } } },
  });

  return json({ comment: { ...comment, createdAt: comment.createdAt.toISOString() } }, 201);
});
