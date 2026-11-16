import { z } from "zod";
import { api } from "@/server/api";
import { json, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { serializeKnowledgeArticle } from "@/lib/knowledge";

const tagsSchema = z.array(z.string().trim().min(1).max(30)).max(12).default([]);

const createSchema = z.object({
  title: z.string().trim().min(3).max(160),
  category: z.string().trim().min(1).max(80).default("Général"),
  summary: z.string().trim().max(2000).nullable().optional(),
  content: z.string().min(1).max(100_000),
  tags: tagsSchema,
  pinned: z.boolean().default(false),
});

const include = {
  author: { select: { id: true, displayName: true, avatarColor: true } },
  updatedBy: { select: { id: true, displayName: true, avatarColor: true } },
} as const;

export const GET = api(async (request) => {
  await requirePermission("knowledge.view");
  const params = new URL(request.url).searchParams;
  const search = params.get("q")?.trim();
  const category = params.get("category")?.trim();

  const articles = await prisma.knowledgeArticle.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search } },
              { summary: { contains: search } },
              { content: { contains: search } },
              { category: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: 200,
    include,
  });

  return json({ articles: articles.map(serializeKnowledgeArticle) });
});

export const POST = api(async (request) => {
  const user = await requirePermission("knowledge.manage");
  const body = await parseJson(request, createSchema);

  const article = await prisma.knowledgeArticle.create({
    data: {
      title: body.title,
      category: body.category,
      summary: body.summary ?? null,
      content: body.content,
      tags: body.tags,
      pinned: body.pinned,
      authorId: user.id,
      updatedById: user.id,
    },
    include,
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "knowledge.create",
    targetType: "knowledge",
    targetId: article.id,
    metadata: { title: article.title, category: article.category },
  });

  return json({ article: serializeKnowledgeArticle(article) }, 201);
});
