import { z } from "zod";
import { api } from "@/server/api";
import { json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { serializeKnowledgeArticle } from "@/lib/knowledge";

const updateSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  summary: z.string().trim().max(2000).nullable().optional(),
  content: z.string().min(1).max(100_000).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).optional(),
  pinned: z.boolean().optional(),
});

const include = {
  author: { select: { id: true, displayName: true, avatarColor: true } },
  updatedBy: { select: { id: true, displayName: true, avatarColor: true } },
} as const;

export const GET = api(async (_request, context) => {
  await requirePermission("knowledge.view");
  const { id } = await context.params;

  const article = await prisma.knowledgeArticle.findUnique({ where: { id }, include });
  if (!article) throw notFound("Article introuvable");

  return json({ article: serializeKnowledgeArticle(article) });
});

export const PATCH = api(async (request, context) => {
  const user = await requirePermission("knowledge.manage");
  const { id } = await context.params;
  const body = await parseJson(request, updateSchema);

  const existing = await prisma.knowledgeArticle.findUnique({ where: { id } });
  if (!existing) throw notFound("Article introuvable");

  const article = await prisma.knowledgeArticle.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.summary !== undefined ? { summary: body.summary } : {}),
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(body.tags !== undefined ? { tags: body.tags } : {}),
      ...(body.pinned !== undefined ? { pinned: body.pinned } : {}),
      updatedById: user.id,
    },
    include,
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "knowledge.update",
    targetType: "knowledge",
    targetId: article.id,
    metadata: { title: article.title, fields: Object.keys(body) },
  });

  return json({ article: serializeKnowledgeArticle(article) });
});

export const DELETE = api(async (_request, context) => {
  const user = await requirePermission("knowledge.manage");
  const { id } = await context.params;

  const existing = await prisma.knowledgeArticle.findUnique({ where: { id } });
  if (!existing) throw notFound("Article introuvable");

  await prisma.knowledgeArticle.delete({ where: { id } });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "knowledge.delete",
    targetType: "knowledge",
    targetId: id,
    metadata: { title: existing.title, category: existing.category },
  });

  return json({ ok: true });
});
