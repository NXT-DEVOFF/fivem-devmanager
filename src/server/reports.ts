/**
 * Rapports de fin de session : donnees reelles uniquement.
 * Aucune valeur n'est inventee : tout provient des evenements, modifications,
 * taches et bugs enregistres pendant la session.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { computeActiveSeconds, computeDurationSeconds, formatDuration } from "@/server/session-time";
import { createDraftFromSession } from "@/server/patchnotes";
import { generateReportSummary, isAiConfigured } from "@/server/ai";
import { notifyMany } from "@/server/notifications";
import { buildReportPdf } from "@/server/pdf";
import { notFound } from "@/server/http";

export interface SessionReportData {
  sessionId: string;
  number: number;
  developer: { id: string; name: string; email: string };
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  activeSeconds: number;
  idleSeconds: number;
  status: string;
  tasks: Array<{ id: string; code: string; title: string; status: string; timeSpentSeconds: number }>;
  tasksCompleted: Array<{ code: string; title: string }>;
  tasksRemaining: Array<{ code: string; title: string; status: string }>;
  bugsFixed: Array<{ code: string; title: string; severity: string }>;
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
  resources: string[];
  changes: Array<{
    id: string;
    path: string;
    type: string;
    additions: number;
    deletions: number;
    taskCode: string | null;
    at: string;
  }>;
  tests: Array<{ name: string; result: string }>;
  deployments: Array<{ resource: string; status: string; at: string | null }>;
  pendingChanges: number;
  notes: string[];
  comments: string[];
  events: Array<{ type: string; message: string; at: string; taskCode: string | null }>;
  commands: Array<{ command: string; at: string; result: string }>;
  summary: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: "a faire",
  TODO: "a faire",
  IN_PROGRESS: "en cours",
  TESTING: "en test",
  BLOCKED: "bloquee",
  DONE: "terminee",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export async function collectSessionData(sessionId: string): Promise<SessionReportData> {
  const session = await prisma.devSession.findUnique({
    where: { id: sessionId },
    include: {
      user: { select: { id: true, displayName: true, email: true } },
      tasks: { include: { fileChanges: { where: { sessionId } } } },
      events: { orderBy: { createdAt: "asc" } },
      fileChanges: { orderBy: { createdAt: "asc" }, include: { task: { select: { code: true } } } },
    },
  });
  if (!session) throw notFound("Session introuvable");

  const endedAt = session.endedAt ?? new Date();
  const durationSeconds = computeDurationSeconds({ ...session, endedAt }, endedAt);
  const activeSeconds = computeActiveSeconds({ ...session, status: "PAUSED" }, endedAt);
  const idleSeconds = Math.max(0, durationSeconds - activeSeconds);

  const created = new Set<string>();
  const modified = new Set<string>();
  const deleted = new Set<string>();
  const resources = new Set<string>();

  for (const change of session.fileChanges) {
    if (change.changeType === "FILE_CREATED") created.add(change.path);
    else if (change.changeType === "FILE_DELETED") deleted.add(change.path);
    else if (change.changeType === "FILE_MODIFIED") modified.add(change.path);
    if (change.resource) resources.add(change.resource);
  }

  const completedTasks = session.tasks.filter(
    (task) =>
      task.status === "DONE" &&
      task.completedAt &&
      task.completedAt.getTime() >= session.startedAt.getTime() &&
      task.completedAt.getTime() <= endedAt.getTime(),
  );

  const remainingTasks = session.tasks.filter((task) => task.status !== "DONE");

  // Bugs dont une correction a ete produite pendant la session.
  const bugIds = Array.from(
    new Set(session.fileChanges.map((change) => change.bugId).filter((id): id is string => Boolean(id))),
  );
  const bugs = bugIds.length
    ? await prisma.bug.findMany({
        where: { id: { in: bugIds } },
        select: { code: true, title: true, severity: true, status: true },
      })
    : [];

  const deployments = resources.size
    ? await prisma.deployment.findMany({
        where: {
          resource: { in: Array.from(resources) },
          deployedAt: { gte: session.startedAt, lte: endedAt },
        },
        select: { resource: true, status: true, deployedAt: true, logs: true },
      })
    : [];

  const tests: Array<{ name: string; result: string }> = [];
  for (const deployment of deployments) {
    if (deployment.logs) {
      tests.push({
        name: `Deploiement ${deployment.resource}`,
        result: deployment.status === "DEPLOYED" ? "Succes" : deployment.status,
      });
    }
  }

  const notes = session.events
    .filter((event) => event.type === "NOTE" && event.message)
    .map((event) => `${event.createdAt.toISOString()} - ${event.message}`);

  const comments: string[] = [];
  if (session.summary) comments.push(session.summary);
  if (session.notes) comments.push(session.notes);

  const taskCodeById = new Map(session.tasks.map((task) => [task.id, task.code]));

  // Commandes console envoyees pendant la session : trace reelle du travail.
  const commands = await prisma.auditLog.findMany({
    where: {
      actorId: session.user.id,
      action: "server.command",
      createdAt: { gte: session.startedAt, lte: endedAt },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { createdAt: true, metadata: true, result: true },
  });

  return {
    sessionId: session.id,
    number: session.number,
    developer: { id: session.user.id, name: session.user.displayName, email: session.user.email },
    startedAt: session.startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationSeconds,
    activeSeconds,
    idleSeconds,
    status: session.status,
    tasks: session.tasks.map((task) => ({
      id: task.id,
      code: task.code,
      title: task.title,
      status: task.status,
      timeSpentSeconds: task.timeSpentSeconds,
    })),
    tasksCompleted: completedTasks.map((task) => ({ code: task.code, title: task.title })),
    tasksRemaining: remainingTasks.map((task) => ({
      code: task.code,
      title: task.title,
      status: task.status,
    })),
    bugsFixed: bugs
      .filter((bug) => bug.status === "FIXED" || bug.status === "CLOSED")
      .map((bug) => ({ code: bug.code, title: bug.title, severity: bug.severity })),
    filesCreated: Array.from(created),
    filesModified: Array.from(modified),
    filesDeleted: Array.from(deleted),
    resources: Array.from(resources),
    changes: session.fileChanges.map((change) => ({
      id: change.id,
      path: change.path,
      type: change.changeType,
      additions: countLines(change.newContent),
      deletions: countLines(change.oldContent),
      taskCode: change.task?.code ?? null,
      at: change.createdAt.toISOString(),
    })),
    tests,
    deployments: deployments.map((deployment) => ({
      resource: deployment.resource,
      status: deployment.status,
      at: deployment.deployedAt?.toISOString() ?? null,
    })),
    pendingChanges: session.fileChanges.filter((change) => !change.validated).length,
    notes,
    comments,
    events: session.events.map((event) => ({
      type: event.type,
      message: event.message ?? "",
      at: event.createdAt.toISOString(),
      taskCode: event.taskId ? (taskCodeById.get(event.taskId) ?? null) : null,
    })),
    commands: commands.map((entry) => ({
      command: (entry.metadata as { command?: string } | null)?.command ?? "",
      at: entry.createdAt.toISOString(),
      result: entry.result,
    })),
    summary: session.summary,
  };
}

function countLines(content: string | null | undefined): number {
  if (!content) return 0;
  return content.split("\n").length;
}

export function renderReportMarkdown(data: SessionReportData): string {
  const lines: string[] = [];
  lines.push(`SESSION DE DEVELOPPEMENT #DEV-${String(data.number).padStart(4, "0")}`);
  lines.push("");
  lines.push(`Developpeur : ${data.developer.name}`);
  lines.push(`Date : ${new Date(data.startedAt).toLocaleDateString("fr-FR")}`);
  lines.push(`Debut : ${new Date(data.startedAt).toLocaleTimeString("fr-FR")}`);
  lines.push(`Fin : ${new Date(data.endedAt).toLocaleTimeString("fr-FR")}`);
  lines.push(`Duree : ${formatDuration(data.durationSeconds)}`);
  lines.push(`Temps actif estime : ${formatDuration(data.activeSeconds)}`);
  lines.push("");

  if (data.summary) {
    lines.push("RESUME DU DEVELOPPEUR :");
    lines.push(data.summary.trim());
    lines.push("");
  }

  lines.push("TRAVAIL EFFECTUE :");
  if (data.tasks.length === 0) lines.push("- Aucune tache associee");
  for (const task of data.tasks) {
    const spent = task.timeSpentSeconds
      ? ` - ${formatDuration(task.timeSpentSeconds)} cumulees`
      : "";
    lines.push(`- ${task.code} - ${task.title} (${statusLabel(task.status)}${spent})`);
  }
  lines.push("");

  if (data.resources.length > 0) {
    lines.push("RESSOURCES TOUCHEES :");
    for (const resource of data.resources) lines.push(`- ${resource}`);
    lines.push("");
  }

  const statsByPath = new Map<string, { additions: number; deletions: number }>();
  for (const change of data.changes) {
    const entry = statsByPath.get(change.path) ?? { additions: 0, deletions: 0 };
    entry.additions += change.additions;
    entry.deletions += change.deletions;
    statsByPath.set(change.path, entry);
  }

  lines.push(
    `FICHIERS (${data.filesCreated.length} crees, ${data.filesModified.length} modifies, ${data.filesDeleted.length} supprimes) :`,
  );
  const allFiles = [...data.filesCreated, ...data.filesModified];
  if (allFiles.length === 0) lines.push("- Aucun fichier");
  for (const file of allFiles) {
    const stat = statsByPath.get(file);
    lines.push(`- ${file}${stat ? ` (+${stat.additions}/-${stat.deletions})` : ""}`);
  }
  if (data.filesDeleted.length > 0) {
    lines.push("");
    lines.push("FICHIERS SUPPRIMES :");
    for (const file of data.filesDeleted) lines.push(`- ${file}`);
  }
  lines.push("");

  lines.push("BUGS CORRIGES :");
  if (data.bugsFixed.length === 0) lines.push("- Aucun bug corrige");
  for (const bug of data.bugsFixed) lines.push(`- ${bug.code} - ${bug.title}`);
  lines.push("");

  lines.push("TACHES TERMINEES :");
  if (data.tasksCompleted.length === 0) lines.push("- Aucune");
  for (const task of data.tasksCompleted) lines.push(`- ${task.code} - ${task.title}`);
  lines.push("");

  lines.push("TACHES RESTANTES :");
  if (data.tasksRemaining.length === 0) lines.push("- Aucune");
  for (const task of data.tasksRemaining) lines.push(`- ${task.code} - ${task.title}`);
  lines.push("");

  if (data.tests.length > 0) {
    lines.push("TESTS EFFECTUES :");
    for (const test of data.tests) lines.push(`- ${test.name} : ${test.result}`);
    lines.push("");
  }

  if (data.notes.length > 0) {
    lines.push("NOTES DU DEVELOPPEUR :");
    for (const note of data.notes) lines.push(`- ${note}`);
    lines.push("");
  }

  if (data.commands.length > 0) {
    lines.push(`COMMANDES CONSOLE ENVOYEES (${data.commands.length}) :`);
    for (const entry of data.commands.slice(0, 40)) {
      const time = new Date(entry.at).toLocaleTimeString("fr-FR");
      lines.push(`- ${time} : ${entry.command}`);
    }
    if (data.commands.length > 40) {
      lines.push(`- ... et ${data.commands.length - 40} autres commandes`);
    }
    lines.push("");
  }

  if (data.events.length > 0) {
    lines.push("CHRONOLOGIE DE LA SESSION :");
    for (const event of data.events) {
      const time = new Date(event.at).toLocaleTimeString("fr-FR");
      const task = event.taskCode ? ` [${event.taskCode}]` : "";
      lines.push(`- ${time} ${event.type}${task} : ${event.message}`);
    }
    lines.push("");
  }

  const totalAdditions = data.changes.reduce((sum, change) => sum + change.additions, 0);
  const totalDeletions = data.changes.reduce((sum, change) => sum + change.deletions, 0);
  lines.push(
    `STATISTIQUES : ${data.changes.length} modification(s), +${totalAdditions}/-${totalDeletions} lignes, ${data.commands.length} commande(s) console.`,
  );
  lines.push(`TEMPS INACTIF : ${formatDuration(data.idleSeconds)}`);
  lines.push(`MODIFICATIONS EN ATTENTE : ${data.pendingChanges}`);
  lines.push(`STATUT : ${data.status === "COMPLETED" ? "Session terminee" : "Session en cours"}`);

  return lines.join("\n");
}

export async function generateSessionReport(sessionId: string) {
  const data = await collectSessionData(sessionId);

  const existing = await prisma.report.findUnique({ where: { sessionId } });
  if (existing) return existing;

  const report = await prisma.report.create({
    data: {
      sessionId,
      userId: data.developer.id,
      startedAt: new Date(data.startedAt),
      endedAt: new Date(data.endedAt),
      durationSeconds: data.durationSeconds,
      activeSeconds: data.activeSeconds,
      data: data as unknown as object,
      summary: renderReportMarkdown(data),
    },
  });

  // Bilan IA en arriere-plan : la fin de session ne depend jamais du
  // fournisseur externe. Si l'IA echoue, le rapport deterministe reste complet.
  void enrichReportWithAi(report.id, data).catch((error) => {
    console.error("[reports] bilan IA impossible:", error);
  });

  // Preparation automatique des patch notes (brouillon pret a l'envoi Discord).
  const draft = await createDraftFromSession(data).catch((error) => {
    console.error("[reports] brouillon de patch notes impossible:", error);
    return null;
  });

  // Aucun contenu reel : on ne notifie pas un brouillon inexistant.
  if (!draft) return report;

  const managers = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN", "LEAD_DEV"] }, isActive: true },
    select: { id: true },
  });
  await notifyMany(
    managers.map((manager) => manager.id),
    {
      type: "patchnotes.ready",
      title: "Patch notes en brouillon",
      body: `Les patch notes de la session #DEV-${String(data.number).padStart(4, "0")} attendent une validation.`,
      link: "/patch-notes",
    },
  );

  return report;
}

export async function getReportPdf(reportId: string): Promise<{ bytes: Uint8Array; filename: string }> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { user: { select: { displayName: true } } },
  });
  if (!report) throw notFound("Rapport introuvable");

  const data = report.data as unknown as SessionReportData;
  const bytes = await buildReportPdf(data);
  return {
    bytes,
    filename: `rapport-DEV-${String(report.number).padStart(4, "0")}.pdf`,
  };
}

/** Ajoute le bilan IA a un rapport, sans jamais bloquer la fin de session. */
export async function enrichReportWithAi(
  reportId: string,
  data?: SessionReportData,
  force = false,
): Promise<boolean> {
  if (!isAiConfigured()) return false;
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report || (report.aiSummary && !force)) return false;

  const payload = data ?? (report.data as unknown as SessionReportData);
  const narrative = await generateReportSummary(payload);
  if (!narrative) return false;

  // Recalcule la partie deterministe : une regeneration ne peut pas empiler
  // deux bilans IA dans le meme rapport.
  const deterministic = renderReportMarkdown(payload);
  await prisma.report.update({
    where: { id: reportId },
    data: { summary: `${narrative}\n\n---\n\n${deterministic}`, aiSummary: true },
  });
  return true;
}

/** Cree automatiquement les rapports des sessions terminees qui n'en ont pas. */
export async function backfillMissingReports(limit = 5): Promise<number> {
  const sessions = await prisma.devSession.findMany({
    where: {
      status: "COMPLETED",
      report: { is: null },
      endedAt: { lt: new Date(Date.now() - 60_000) },
    },
    orderBy: { endedAt: "asc" },
    take: limit,
    select: { id: true },
  });

  let created = 0;
  for (const session of sessions) {
    try {
      await generateSessionReport(session.id);
      created += 1;
    } catch (error) {
      console.error(`[reports] rattrapage ${session.id} impossible:`, error);
    }
  }
  return created;
}

/** Ajoute le bilan IA aux rapports recents qui ne l'ont pas encore. */
export async function enrichPendingReportSummaries(limit = 3): Promise<number> {
  if (!isAiConfigured()) return 0;
  const reports = await prisma.report.findMany({
    where: {
      aiSummary: false,
      createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60_000) },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true },
  });

  let enriched = 0;
  for (const report of reports) {
    try {
      if (await enrichReportWithAi(report.id)) enriched += 1;
    } catch (error) {
      console.error(`[reports] bilan IA ${report.id} impossible:`, error);
    }
  }
  return enriched;
}
