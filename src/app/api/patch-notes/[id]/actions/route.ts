import { z } from "zod";
import { api } from "@/server/api";
import { conflict, forbidden, json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { buildEmbedFromMarkdown, publishPatchNote } from "@/server/discord";
import { notifyMany } from "@/server/notifications";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit") }),
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("schedule"), scheduledAt: z.string().datetime() }),
  z.object({ action: z.literal("publish") }),
  z.object({ action: z.literal("preview") }),
]);

export const POST = api(async (request, context) => {
  const user = await requirePermission("patchnotes.view");
  const { id } = await context.params;
  const body = await parseJson(request, schema);

  const note = await prisma.patchNote.findUnique({ where: { id } });
  if (!note) throw notFound("Patch notes introuvables");

  if (body.action === "preview") {
    return json({
      embed: buildEmbedFromMarkdown({
        title: note.title,
        subtitle: note.subtitle,
        markdown: note.publicBody,
        version: note.version,
        noteId: note.id,
      }),
    });
  }

  if (body.action === "submit") {
    if (note.authorId !== user.id && !hasPermission(user, "patchnotes.approve")) {
      throw forbidden("Non autorise");
    }
    if (note.status !== "DRAFT") throw conflict("Seul un brouillon peut etre soumis");
    const updated = await prisma.patchNote.update({
      where: { id },
      data: { status: "REVIEW" },
    });
    const leads = await prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN", "LEAD_DEV"] }, isActive: true },
      select: { id: true },
    });
    await notifyMany(
      leads.map((lead) => lead.id),
      {
        type: "patchnotes.ready",
        title: `Patch notes a valider : ${note.version}`,
        body: note.title,
        link: "/patch-notes",
      },
    );
    return json({ patchNote: updated });
  }

  if (body.action === "approve") {
    if (!hasPermission(user, "patchnotes.approve")) throw forbidden("Permission patchnotes.approve requise");
    if (!["DRAFT", "REVIEW"].includes(note.status)) {
      throw conflict(`Statut non approuvable : ${note.status}`);
    }
    if (note.authorId === user.id && !hasPermission(user, "patchnotes.publish")) {
      throw forbidden("Un auteur ne peut pas approuver ses propres patch notes");
    }
    const updated = await prisma.patchNote.update({
      where: { id },
      data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date() },
    });
    await audit({
      actorId: user.id,
      actorLabel: user.displayName,
      action: "patchnote.approve",
      targetType: "patch_note",
      targetId: id,
      metadata: { version: note.version },
    });
    return json({ patchNote: updated });
  }

  if (body.action === "reject") {
    if (!hasPermission(user, "patchnotes.approve")) throw forbidden("Permission requise");
    const updated = await prisma.patchNote.update({
      where: { id },
      data: { status: "DRAFT", approvedById: null, approvedAt: null },
    });
    await notifyMany([note.authorId], {
      type: "patchnotes.rejected",
      title: `Patch notes renvoyees en brouillon : ${note.version}`,
      body: body.reason ?? "Corrigez le contenu avant nouvelle soumission.",
      link: "/patch-notes",
    });
    return json({ patchNote: updated });
  }

  if (body.action === "schedule") {
    if (!hasPermission(user, "patchnotes.publish")) throw forbidden("Permission patchnotes.publish requise");
    if (note.status !== "APPROVED") throw conflict("Les patch notes doivent etre approuvees avant planification");
    if (new Date(body.scheduledAt).getTime() <= Date.now()) {
      throw conflict("La date planifiee doit etre dans le futur");
    }
    const updated = await prisma.patchNote.update({
      where: { id },
      data: { status: "SCHEDULED", scheduledAt: new Date(body.scheduledAt) },
    });
    return json({ patchNote: updated });
  }

  // Publication
  if (!hasPermission(user, "patchnotes.publish")) throw forbidden("Permission patchnotes.publish requise");
  if (!["APPROVED", "SCHEDULED"].includes(note.status)) {
    throw conflict("Seules les patch notes approuvees ou planifiees peuvent etre publiees");
  }

  const result = await publishPatchNote(id, user);

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "patchnote.publish",
    targetType: "patch_note",
    targetId: id,
    metadata: { version: note.version, duplicate: result.alreadyPublished },
  });

  return json({ ok: true, ...result });
});
