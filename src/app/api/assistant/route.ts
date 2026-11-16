import { z } from "zod";
import { api } from "@/server/api";
import { badRequest, forbidden, json, notFound, parseJson } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { collectSessionData, enrichReportWithAi, generateSessionReport } from "@/server/reports";
import { createDraftFromSession } from "@/server/patchnotes";
import { isAiConfigured } from "@/server/ai";
import { audit } from "@/server/audit";

export const GET = api(async () => {
  const user = await requirePermission("reports.view.own");
  const canViewAll = hasPermission(user, "reports.view.all");

  const sessions = await prisma.devSession.findMany({
    where: { status: "COMPLETED", ...(canViewAll ? {} : { userId: user.id }) },
    orderBy: { endedAt: "desc" },
    take: 20,
    select: {
      id: true,
      number: true,
      endedAt: true,
      accumulatedActiveSeconds: true,
      user: { select: { displayName: true } },
      report: { select: { id: true, aiSummary: true } },
      patchNotes: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, version: true, status: true },
      },
    },
  });

  return json({
    aiConfigured: isAiConfigured(),
    canCreatePatchNotes: hasPermission(user, "patchnotes.create"),
    sessions: sessions.map((session) => ({
      id: session.id,
      number: session.number,
      developer: session.user.displayName,
      endedAt: session.endedAt?.toISOString() ?? null,
      activeSeconds: session.accumulatedActiveSeconds,
      report: session.report
        ? { id: session.report.id, aiSummary: session.report.aiSummary }
        : null,
      patchNote: session.patchNotes[0] ?? null,
    })),
  });
});

const schema = z.object({
  action: z.enum(["report", "patchnote"]),
  sessionId: z.string().min(1),
  force: z.boolean().optional(),
});

export const POST = api(async (request) => {
  const user = await requirePermission("reports.view.own");
  const body = await parseJson(request, schema);

  const session = await prisma.devSession.findUnique({
    where: { id: body.sessionId },
    select: { id: true, number: true, userId: true, status: true },
  });
  if (!session) throw notFound("Session introuvable");
  if (session.userId !== user.id && !hasPermission(user, "reports.view.all")) {
    throw forbidden("Acces a cette session non autorise");
  }
  if (session.status !== "COMPLETED") {
    throw badRequest("La session doit etre terminee pour generer un bilan");
  }
  const data = await collectSessionData(session.id);

  if (body.action === "report") {
    if (!isAiConfigured()) {
      return json(
        {
          error: "IA non configuree : renseignez AI_API_KEY (et AI_MODEL) dans le panel ou le .env.",
          code: "ai_not_configured",
        },
        { status: 412 },
      );
    }
    let report = await prisma.report.findUnique({
      where: { sessionId: session.id },
      select: { id: true },
    });
    if (!report) {
      // Filet de securite : une session terminee sans rapport en recoit un.
      const created = await generateSessionReport(session.id);
      report = { id: created.id };
    }

    const regenerated = await enrichReportWithAi(report.id, data, body.force ?? false);
    const updated = await prisma.report.findUnique({
      where: { id: report.id },
      select: { id: true, summary: true, aiSummary: true },
    });

    await audit({
      actorId: user.id,
      actorLabel: user.displayName,
      action: "report.generate",
      targetType: "report",
      targetId: report.id,
      metadata: { assistant: true, session: session.number, regenerated },
    });

    return json({
      ok: true,
      reportId: report.id,
      aiSummary: updated?.aiSummary ?? false,
      regenerated,
      summary: updated?.summary ?? null,
    });
  }

  if (!hasPermission(user, "patchnotes.create")) {
    throw forbidden("Permission patchnotes.create requise");
  }

  const existing = await prisma.patchNote.findFirst({
    where: { sessionId: session.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, version: true, status: true, publicBody: true, internalBody: true },
  });
  if (existing && !body.force) {
    return json({ ok: true, alreadyExists: true, patchNote: existing });
  }

  const draft = await createDraftFromSession(data);
  if (!draft) {
    return json(
      { error: "Aucune modification publiable dans cette session", code: "nothing_to_publish" },
      { status: 422 },
    );
  }

  await audit({
    actorId: user.id,
    actorLabel: user.displayName,
    action: "patchnote.create",
    targetType: "patch_note",
    targetId: draft.id,
    metadata: { assistant: true, session: session.number, version: draft.version },
  });

  return json(
    {
      ok: true,
      alreadyExists: false,
      patchNote: {
        id: draft.id,
        version: draft.version,
        status: draft.status,
        publicBody: draft.publicBody,
        internalBody: draft.internalBody,
      },
    },
    201,
  );
});
