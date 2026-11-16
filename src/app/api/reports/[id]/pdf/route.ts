import { api } from "@/server/api";
import { forbidden, notFound } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { prisma } from "@/lib/prisma";
import { getReportPdf } from "@/server/reports";

export const GET = api(async (_request, context) => {
  const user = await requirePermission("reports.view.own");
  const { id } = await context.params;

  const report = await prisma.report.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!report) throw notFound("Rapport introuvable");
  if (report.userId !== user.id && !hasPermission(user, "reports.view.all")) {
    throw forbidden("Acces au rapport non autorise");
  }

  const { bytes, filename } = await getReportPdf(id);

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
