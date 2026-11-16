import { z } from "zod";
import { api } from "@/server/api";
import { json, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { toStringArray } from "@/lib/json-array";
import { audit } from "@/server/audit";

const tagsSchema = z.array(z.string().trim().min(1).max(30)).max(12).default([]);

const snippetSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000).optional(),
  language: z.string().trim().min(1).max(40).default("lua"),
  code: z.string().min(1).max(100_000),
  tags: tagsSchema,
});

function serialize(snippet: {
  id: string;
  title: string;
  description: string | null;
  language: string;
  code: string;
  tags: unknown;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  author?: { id: string; displayName: string; avatarColor: string } | null;
}) {
  return {
    id: snippet.id,
    title: snippet.title,
    description: snippet.description,
    language: snippet.language,
    code: snippet.code,
    tags: toStringArray(snippet.tags),
    authorId: snippet.authorId,
    author: snippet.author ?? null,
    createdAt: snippet.createdAt.toISOString(),
    updatedAt: snippet.updatedAt.toISOString(),
  };
}

export const GET = api(async (request) => {
  await requirePermission("snippets.view");
  const params = new URL(request.url).searchParams;
  const search = params.get("q")?.trim();
  const language = params.get("language")?.trim();

  const snippets = await prisma.snippet.findMany({
    where: {
      ...(language ? { language } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search } },
              { description: { contains: search } },
              { code: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: { author: { select: { id: true, displayName: true, avatarColor: true } } },
  });

  return json({ snippets: snippets.map(serialize) });
});

export const POST = api(async (request) => {
  const user = await requirePermission("snippets.manage");
  const body = await parseJson(request, snippetSchema);

  const snippet = await prisma.snippet.create({
    data: {
      title: body.title,
      description: body.description ?? null,
      language: body.language,
      code: body.code,
      tags: body.tags,
      authorId: user.id,
    },
    include: { author: { select: { id: true, displayName: true, avatarColor: true } } },
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "snippet.create",
    targetType: "snippet",
    targetId: snippet.id,
    metadata: { title: snippet.title, language: snippet.language },
  });

  return json({ snippet: serialize(snippet) }, 201);
});
