import { z } from "zod";
import { api } from "@/server/api";
import { json, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { nextPatchVersion } from "@/server/settings";

export const GET = api(async (request) => {
  await requirePermission("patchnotes.view");
  const params = new URL(request.url).searchParams;
  const status = params.get("status");

  const notes = await prisma.patchNote.findMany({
    where: status ? { status: status as never } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      author: { select: { id: true, displayName: true } },
      approvedBy: { select: { id: true, displayName: true } },
      session: { select: { id: true, number: true } },
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, status: true, createdAt: true, error: true, httpStatus: true },
      },
    },
  });

  return json({
    patchNotes: notes.map((note) => ({
      ...note,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
      approvedAt: note.approvedAt?.toISOString() ?? null,
      scheduledAt: note.scheduledAt?.toISOString() ?? null,
      publishedAt: note.publishedAt?.toISOString() ?? null,
      deliveries: note.deliveries.map((delivery) => ({
        ...delivery,
        createdAt: delivery.createdAt.toISOString(),
      })),
    })),
  });
});

const createSchema = z.object({
  title: z.string().trim().min(5).max(200),
  version: z
    .string()
    .trim()
    .regex(/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/i, "Format semver attendu (ex: 1.4.2)")
    .optional(),
  subtitle: z.string().max(500).optional(),
  publicBody: z.string().min(1).max(20_000),
  internalBody: z.string().max(20_000).default(""),
});

export const POST = api(async (request) => {
  const user = await requirePermission("patchnotes.create");
  const body = await parseJson(request, createSchema);

  const version = body.version ?? (await nextPatchVersion());
  const note = await prisma.patchNote.create({
    data: {
      version,
      title: body.title,
      subtitle: body.subtitle ?? null,
      publicBody: body.publicBody,
      internalBody: body.internalBody ?? "",
      status: "DRAFT",
      authorId: user.id,
    },
  });

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "patchnote.create",
    targetType: "patch_note",
    targetId: note.id,
    metadata: { version: note.version },
  });

  return json({ patchNote: note }, 201);
});
