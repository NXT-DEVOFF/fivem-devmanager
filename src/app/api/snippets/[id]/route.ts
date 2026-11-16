import { z } from "zod";
import { api } from "@/server/api";
import { json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { toStringArray } from "@/lib/json-array";
import { audit } from "@/server/audit";

const updateSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  language: z.string().trim().min(1).max(40).optional(),
  code: z.string().min(1).max(100_000).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).optional(),
});

const include = { author: { select: { id: true, displayName: true, avatarColor: true } } };

export const GET = api(async (_request, context) => {
  await requirePermission("snippets.view");
  const { id } = await context.params;

  const snippet = await prisma.snippet.findUnique({ where: { id }, include });
  if (!snippet) throw notFound("Snippet introuvable");

  return json({
    snippet: {
      ...snippet,
      tags: toStringArray(snippet.tags),
      createdAt: snippet.createdAt.toISOString(),
      updatedAt: snippet.updatedAt.toISOString(),
    },
  });
});

export const PATCH = api(async (request, context) => {
  const user = await requirePermission("snippets.manage");
  const { id } = await context.params;
  const body = await parseJson(request, updateSchema);

  const existing = await prisma.snippet.findUnique({ where: { id } });
  if (!existing) throw notFound("Snippet introuvable");

  const snippet = await prisma.snippet.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.language !== undefined ? { language: body.language } : {}),
      ...(body.code !== undefined ? { code: body.code } : {}),
      ...(body.tags !== undefined ? { tags: body.tags } : {}),
    },
    include,
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "snippet.update",
    targetType: "snippet",
    targetId: snippet.id,
    metadata: { fields: Object.keys(body) },
  });

  return json({
    snippet: {
      ...snippet,
      tags: toStringArray(snippet.tags),
      createdAt: snippet.createdAt.toISOString(),
      updatedAt: snippet.updatedAt.toISOString(),
    },
  });
});

export const DELETE = api(async (_request, context) => {
  const user = await requirePermission("snippets.manage");
  const { id } = await context.params;

  const existing = await prisma.snippet.findUnique({ where: { id } });
  if (!existing) throw notFound("Snippet introuvable");

  await prisma.snippet.delete({ where: { id } });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "snippet.delete",
    targetType: "snippet",
    targetId: id,
    metadata: { title: existing.title },
  });

  return json({ ok: true });
});
