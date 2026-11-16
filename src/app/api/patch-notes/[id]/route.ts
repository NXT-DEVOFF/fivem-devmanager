import { z } from "zod";
import { api } from "@/server/api";
import { forbidden, json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";

const schema = z.object({
  title: z.string().trim().min(5).max(200).optional(),
  subtitle: z.string().max(500).nullable().optional(),
  version: z
    .string()
    .trim()
    .regex(/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/i)
    .optional(),
  publicBody: z.string().min(1).max(20_000).optional(),
  internalBody: z.string().max(20_000).optional(),
});

export const GET = api(async (_request, context) => {
  await requirePermission("patchnotes.view");
  const { id } = await context.params;
  const note = await prisma.patchNote.findUnique({
    where: { id },
    include: {
      author: { select: { displayName: true } },
      approvedBy: { select: { displayName: true } },
      session: { select: { id: true, number: true } },
      deliveries: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!note) throw notFound("Patch notes introuvables");
  return json({ patchNote: note });
});

export const PATCH = api(async (request, context) => {
  const user = await requirePermission("patchnotes.create");
  const { id } = await context.params;
  const body = await parseJson(request, schema);

  const note = await prisma.patchNote.findUnique({ where: { id } });
  if (!note) throw notFound("Patch notes introuvables");
  if (note.authorId !== user.id && !hasPermission(user, "patchnotes.approve")) {
    throw forbidden("Vous ne pouvez modifier que vos propres patch notes");
  }
  if (note.status === "PUBLISHED") {
    return json(
      { error: "Une publication ne peut plus etre modifiee ; creez une nouvelle version", code: "published" },
      { status: 409 },
    );
  }

  const updated = await prisma.patchNote.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.subtitle !== undefined ? { subtitle: body.subtitle } : {}),
      ...(body.version !== undefined ? { version: body.version } : {}),
      ...(body.publicBody !== undefined ? { publicBody: body.publicBody } : {}),
      ...(body.internalBody !== undefined ? { internalBody: body.internalBody } : {}),
    },
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "patchnote.update",
    targetType: "patch_note",
    targetId: id,
    metadata: { fields: Object.keys(body) },
  });

  return json({ patchNote: updated });
});

export const DELETE = api(async (_request, context) => {
  const user = await requirePermission("patchnotes.create");
  const { id } = await context.params;
  const note = await prisma.patchNote.findUnique({ where: { id } });
  if (!note) throw notFound("Patch notes introuvables");
  if (note.status === "PUBLISHED") {
    return json({ error: "Impossible de supprimer une publication", code: "published" }, { status: 409 });
  }
  if (note.authorId !== user.id && !hasPermission(user, "patchnotes.approve")) {
    throw forbidden("Suppression non autorisee");
  }

  await prisma.patchNote.delete({ where: { id } });
  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "patchnote.delete",
    targetType: "patch_note",
    targetId: id,
    metadata: { version: note.version },
  });
  return json({ ok: true });
});
