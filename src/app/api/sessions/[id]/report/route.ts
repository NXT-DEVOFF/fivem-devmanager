import { api } from "@/server/api";
import { json, forbidden, notFound } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { collectSessionData, generateSessionReport, renderReportMarkdown } from "@/server/reports";

export const GET = api(async (_request, context) => {
  const user = await requirePermission("reports.view.own");
  const { id } = await context.params;

  const session = await prisma.devSession.findUnique({
    where: { id },
    include: { report: true },
  });
  if (!session) throw notFound("Session introuvable");
  if (session.userId !== user.id && !hasPermission(user, "reports.view.all")) {
    throw forbidden("Acces au rapport non autorise");
  }

  let report = session.report;
  if (!report && session.status === "COMPLETED" && hasPermission(user, "reports.create")) {
    report = await generateSessionReport(session.id);
  }

  if (!report) {
    return json({ report: null, message: "Le rapport sera genere a la fin de la session." });
  }

  const data = await collectSessionData(session.id);
  return json({
    report: {
      id: report.id,
      number: report.number,
      createdAt: report.createdAt.toISOString(),
      durationSeconds: report.durationSeconds,
      activeSeconds: report.activeSeconds,
      summary: report.summary ?? renderReportMarkdown(data),
      data,
    },
  });
});
