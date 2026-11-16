/**
 * Journalisation des modifications de fichiers + rapprochement automatique
 * avec les taches en cours.
 *
 * IMPORTANT : une modification detectee ne cloture JAMAIS une tache.
 * Le score sert uniquement a proposer une association ; la validation reste
 * explicite (ou conditionnee aux criteres configures).
 */
import "server-only";
import crypto from "node:crypto";
import type { ChangeSource, FileChangeType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toStringArray } from "@/lib/json-array";
import { buildUnifiedDiff } from "@/server/diff";
import { detectResource } from "@/server/path-safety";
import { emitActivity } from "@/server/realtime";
import { notifyMany } from "@/server/notifications";

export function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

export interface RecordChangeInput {
  path: string;
  changeType: FileChangeType;
  source: ChangeSource;
  before: string | null;
  after: string | null;
  userId: string | null;
  sessionId: string | null;
  taskId?: string | null;
  bugId?: string | null;
  skipMatching?: boolean;
}

export interface TaskMatch {
  taskId: string;
  score: number;
  reason: string;
}

/**
 * Rapproche une modification d'une tache via plusieurs criteres ponderes.
 * Le seuil de 35 evite les faux positifs manifestes.
 */
export async function matchTaskForPath(input: {
  path: string;
  resource: string | null;
  userId: string | null;
  sessionId: string | null;
}): Promise<TaskMatch | null> {
  const candidates = await prisma.task.findMany({
    where: {
      status: { in: ["TODO", "IN_PROGRESS", "TESTING", "REVIEW", "BLOCKED"] },
    },
    include: {
      sessions: { where: { id: input.sessionId ?? "__none__" }, select: { id: true } },
      checklist: { select: { done: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  let best: TaskMatch | null = null;
  const basename = input.path.split("/").pop() ?? input.path;
  const resourceSegments = (input.resource ?? "").split("/").filter(Boolean);

  for (const task of candidates) {
    let score = 0;
    const reasons: string[] = [];
    const taskFiles = toStringArray(task.files);

    if (input.resource && task.resource === input.resource) {
      score += 45;
      reasons.push("ressource identique");
    }
    if (taskFiles.includes(input.path)) {
      score += 40;
      reasons.push("chemin exact liste");
    } else if (taskFiles.some((file) => file.endsWith(`/${basename}`) || file === basename)) {
      score += 28;
      reasons.push("nom de fichier liste");
    }
    if (resourceSegments.length > 0) {
      const haystack = `${task.title} ${task.description ?? ""}`.toLowerCase();
      if (resourceSegments.some((segment) => segment.length > 2 && haystack.includes(segment.toLowerCase()))) {
        score += 12;
        reasons.push("ressource mentionnee dans la tache");
      }
    }
    if (task.sessions.length > 0) {
      score += 20;
      reasons.push("tache selectionnee dans la session");
    }
    if (input.userId && task.assigneeId === input.userId) {
      score += 10;
      reasons.push("tache assignee au developpeur");
    }
    if (task.status === "IN_PROGRESS" || task.status === "TESTING" || task.status === "REVIEW") {
      score += 8;
      reasons.push("tache deja en cours");
    }
    if (task.checklist.length > 0) {
      const done = task.checklist.filter((item) => item.done).length;
      if (done > 0) {
        score += 3;
        reasons.push("checklist entamee");
      }
    }

    if (score >= 35 && (!best || score > best.score)) {
      best = {
        taskId: task.id,
        score: Math.min(score, 100),
        reason: reasons.join(", "),
      };
    }
  }

  return best;
}

export async function recordFileChange(input: RecordChangeInput): Promise<{
  changeId: string;
  matchedTask: TaskMatch | null;
}> {
  const resource = detectResource(input.path);
  const before = input.before ?? "";
  const after = input.after ?? "";
  const diff = input.before !== null || input.after !== null ? buildUnifiedDiff(input.path, before, after) : null;

  let taskId = input.taskId ?? null;
  let bugId = input.bugId ?? null;
  let match: TaskMatch | null = null;

  // Rapprochement automatique avec un bug ouvert sur ce fichier / cette ressource.
  if (!bugId && resource) {
    const candidate = await prisma.bug.findFirst({
      where: {
        status: { notIn: ["CLOSED", "FIXED"] },
        OR: [{ filePath: input.path }, { resource }],
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (candidate) bugId = candidate.id;
  }

  if (!input.skipMatching && !taskId) {
    match = await matchTaskForPath({
      path: input.path,
      resource,
      userId: input.userId,
      sessionId: input.sessionId,
    });
    if (match) taskId = match.taskId;
  }

  const change = await prisma.fileChange.create({
    data: {
      path: input.path,
      resource,
      changeType: input.changeType,
      source: input.source,
      hashBefore: input.before !== null ? hashContent(before) : null,
      hashAfter: input.after !== null ? hashContent(after) : null,
      sizeBefore: input.before !== null ? Buffer.byteLength(before, "utf8") : null,
      sizeAfter: input.after !== null ? Buffer.byteLength(after, "utf8") : null,
      diff: diff ? diff.slice(0, 250_000) : null,
      oldContent: input.before !== null ? input.before.slice(0, 200_000) : null,
      newContent: input.after !== null ? input.after.slice(0, 200_000) : null,
      userId: input.userId,
      sessionId: input.sessionId,
      taskId,
      bugId,
      taskMatchScore: match?.score ?? null,
      taskMatchReason: match?.reason ?? null,
    },
  });

  if (input.sessionId && input.userId) {
    await prisma.devSessionEvent.create({
      data: {
        sessionId: input.sessionId,
        userId: input.userId,
        type: "FILE_CHANGE",
        message: `${input.changeType} - ${input.path}`,
        taskId,
        metadata: { changeId: change.id, source: input.source },
      },
    });
    await prisma.devSession.update({
      where: { id: input.sessionId },
      data: { lastActivityAt: new Date() },
    });
  }

  // Mise a jour de la ressource concernee (compteur / owner).
  if (resource) {
    await prisma.resource
      .update({
        where: { name: resource },
        data: { lastModifiedAt: new Date() },
      })
      .catch(() => undefined);
  }

  const actor = input.userId
    ? await prisma.user.findUnique({ where: { id: input.userId }, select: { displayName: true } })
    : null;

  emitActivity({
    type: "file.changed",
    title: `${input.changeType === "FILE_CREATED" ? "Fichier cree" : input.changeType === "FILE_DELETED" ? "Fichier supprime" : "Fichier modifie"}`,
    detail: input.path,
    actor: actor ? { id: input.userId!, name: actor.displayName } : null,
    link: "/files",
    timestamp: new Date().toISOString(),
    metadata: { changeType: input.changeType, resource, taskId },
  });

  return { changeId: change.id, matchedTask: match };
}

/**
 * Evalue les criteres de validation d'une tache a partir de donnees reelles.
 * Ne modifie rien : renvoie l'etat des criteres.
 */
export async function evaluateTaskReadiness(taskId: string): Promise<{
  taskId: string;
  ready: boolean;
  autoEligible: boolean;
  criteria: Array<{ key: string; label: string; satisfied: boolean; detail?: string }>;
}> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      checklist: true,
      fileChanges: { orderBy: { createdAt: "desc" }, take: 100 },
      sessions: { orderBy: { startedAt: "desc" }, take: 5 },
      dependencies: { include: { dependsOn: { select: { status: true } } } },
    },
  });
  if (!task) throw new Error("Tache introuvable");

  const checklistTotal = task.checklist.length;
  const checklistDone = task.checklist.filter((item) => item.done).length;
  const hasChanges = task.fileChanges.length > 0;
  const changesInActiveSession = task.fileChanges.some((change) => change.sessionId !== null);
  const hasComment = await prisma.taskComment.count({ where: { taskId } });
  const blockingDeps = task.dependencies.filter((dependency) => dependency.dependsOn.status !== "DONE").length;

  const criteria = [
    {
      key: "files",
      label: "Au moins une modification de fichier associee",
      satisfied: hasChanges,
      detail: `${task.fileChanges.length} modification(s)`,
    },
    {
      key: "session",
      label: "Modifications realisees dans une session de developpement",
      satisfied: changesInActiveSession,
    },
    {
      key: "checklist",
      label: "Checklist complete",
      satisfied: checklistTotal === 0 ? true : checklistDone === checklistTotal,
      detail: `${checklistDone}/${checklistTotal}`,
    },
    {
      key: "tests",
      label: "Tests / validation fonctionnelle enregistres",
      satisfied: Boolean(task.validatedAt) || task.status === "REVIEW" || task.status === "TESTING",
      detail: task.validatedAt ? "Validation deja enregistree" : "Aucune validation enregistree",
    },
    {
      key: "comment",
      label: "Commentaire ou confirmation du developpeur",
      satisfied: hasComment > 0,
      detail: `${hasComment} commentaire(s)`,
    },
    {
      key: "dependencies",
      label: "Dependances terminees",
      satisfied: blockingDeps === 0,
      detail: `${blockingDeps} dependance(s) bloquante(s)`,
    },
  ];

  const ready = criteria.every((criterion) => criterion.satisfied);
  const autoEligible = task.autoValidate && !task.requiresReview && ready;

  return { taskId, ready, autoEligible, criteria };
}

/** Notifie les responsables lorsqu'une tache est prete a valider. */
export async function notifyTaskReady(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignee: { select: { displayName: true } } },
  });
  if (!task) return;

  const leads = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN", "LEAD_DEV"] }, isActive: true },
    select: { id: true },
  });
  await notifyMany(
    leads.map((lead) => lead.id),
    {
      type: "task.ready",
      title: `Tache prete a valider : ${task.code}`,
      body: `${task.assignee?.displayName ?? "Un developpeur"} a termine le travail sur "${task.title}".`,
      link: `/tasks/${task.id}`,
    },
  );
}
