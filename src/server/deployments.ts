/**
 * Deploiements controles + snapshots + rollback.
 *
 * Un deploiement ne redemarre JAMAIS le serveur automatiquement.
 * Les operations interruptives (restart ressource, ensure) necessitent une
 * demande explicite et les permissions associees.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { HttpError, conflict, forbidden, notFound } from "@/server/http";
import type { AuthUser } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { getFileBackend } from "@/server/files";
import { normalizeRemotePath } from "@/server/path-safety";
import { createSnapshot, readSnapshot } from "@/server/snapshots";
import { audit } from "@/server/audit";
import { emitActivity } from "@/server/realtime";
import { recordFileChange } from "@/server/changes";
import { notifyMany } from "@/server/notifications";
import { sendConsoleCommand } from "@/server/pterodactyl/actions";
import type { Prisma } from "@prisma/client";

const MAX_SNAPSHOT_FILES = 400;
const MAX_SNAPSHOT_BYTES = 30 * 1024 * 1024;

interface SnapshotFileEntry {
  path: string;
  content: string;
  size: number;
}

/** Parcours recursif d'une ressource pour construire un snapshot complet. */
async function collectResourceFiles(
  resource: string,
): Promise<{ files: SnapshotFileEntry[]; truncated: boolean }> {
  const backend = await getFileBackend();
  const root = normalizeRemotePath(`/resources/${resource}`);
  const files: SnapshotFileEntry[] = [];
  let totalBytes = 0;
  let truncated = false;
  const queue: string[] = [root];

  while (queue.length > 0) {
    const directory = queue.shift()!;
    if (files.length >= MAX_SNAPSHOT_FILES || totalBytes >= MAX_SNAPSHOT_BYTES) {
      truncated = true;
      break;
    }
    let entries;
    try {
      entries = await backend.list(directory);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isSymlink) continue;
      if (!entry.isFile) {
        queue.push(entry.path);
        continue;
      }
      if (!entry.editable) continue;
      if (entry.size > 2 * 1024 * 1024) continue;
      if (files.length >= MAX_SNAPSHOT_FILES || totalBytes + entry.size > MAX_SNAPSHOT_BYTES) {
        truncated = true;
        break;
      }
      const content = await backend.read(entry.path).catch(() => null);
      if (content === null) continue;
      files.push({ path: entry.path, content, size: Buffer.byteLength(content, "utf8") });
      totalBytes += entry.size;
    }
  }

  return { files, truncated };
}

export async function requestDeployment(input: {
  user: AuthUser;
  resource: string;
  title: string;
  notes?: string;
}) {
  const resource = input.resource.trim();
  if (!/^[A-Za-z0-9_\-[\]/]{2,120}$/.test(resource)) {
    throw new HttpError(400, "Nom de ressource invalide", "invalid_resource");
  }

  const { files, truncated } = await collectResourceFiles(resource);
  if (files.length === 0) {
    throw conflict("Impossible de sauvegarder la ressource : aucun fichier lisible");
  }

  const snapshot = await createSnapshot({
    label: `Avant deploiement - ${resource}`,
    kind: "PRE_DEPLOYMENT",
    resource,
    files,
    createdById: input.user.id,
  });

  const pendingChanges = await prisma.fileChange.findMany({
    where: { resource, validated: false, createdAt: { gte: new Date(Date.now() - 7 * 864e5) } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, path: true, changeType: true, createdAt: true, userId: true },
  });

  const deployment = await prisma.deployment.create({
    data: {
      resource,
      title: input.title.slice(0, 200),
      requestedById: input.user.id,
      status: "PENDING",
      changes: {
        pendingChanges: pendingChanges.map((change) => ({
          id: change.id,
          path: change.path,
          type: change.changeType,
          at: change.createdAt.toISOString(),
          userId: change.userId,
        })),
        snapshotFileCount: files.length,
        snapshotTruncated: truncated,
      } as unknown as Prisma.InputJsonValue,
      files: files.map((file) => file.path).slice(0, 500),
      snapshotId: snapshot.id,
    },
  });

  await audit({
    actorId: input.user.id,
    actorLabel: input.user.displayName,
    action: "deployment.request",
    targetType: "deployment",
    targetId: deployment.id,
    metadata: { resource, files: files.length },
  });

  emitActivity({
    type: "deployment.done",
    title: "Deploiement propose",
    detail: `${resource} - ${input.title}`,
    actor: { id: input.user.id, name: input.user.displayName },
    link: "/deployments",
    timestamp: new Date().toISOString(),
  });

  return deployment;
}

export async function decideDeployment(input: {
  deploymentId: string;
  user: AuthUser;
  approve: boolean;
  reason?: string;
}) {
  const deployment = await prisma.deployment.findUnique({ where: { id: input.deploymentId } });
  if (!deployment) throw notFound("Deploiement introuvable");
  if (deployment.status !== "PENDING") {
    throw conflict(`Statut non modifiable : ${deployment.status}`);
  }
  if (deployment.requestedById === input.user.id && !hasPermission(input.user, "deployments.rollback")) {
    throw forbidden("Vous ne pouvez pas approuver votre propre deploiement");
  }

  const updated = await prisma.deployment.update({
    where: { id: deployment.id },
    data: input.approve
      ? { status: "APPROVED", approvedById: input.user.id, approvedAt: new Date() }
      : {
          status: "REJECTED",
          approvedById: input.user.id,
          approvedAt: new Date(),
          rejectedReason: input.reason?.slice(0, 500) ?? null,
        },
  });

  await audit({
    actorId: input.user.id,
    actorLabel: input.user.displayName,
    action: "deployment.approve",
    targetType: "deployment",
    targetId: deployment.id,
    metadata: { approve: input.approve, reason: input.reason },
  });

  await notifyMany([deployment.requestedById], {
    type: "deployment.decided",
    title: input.approve ? "Deploiement approuve" : "Deploiement refuse",
    body: `${deployment.resource} - ${deployment.title}${input.reason ? ` : ${input.reason}` : ""}`,
    link: "/deployments",
  });

  return updated;
}

export async function executeDeployment(input: {
  deploymentId: string;
  user: AuthUser;
  restartResource: boolean;
}) {
  const deployment = await prisma.deployment.findUnique({ where: { id: input.deploymentId } });
  if (!deployment) throw notFound("Deploiement introuvable");
  if (deployment.status !== "APPROVED") {
    throw conflict("Le deploiement doit etre approuve avant execution");
  }
  if (input.restartResource && !hasPermission(input.user, "server.console.send")) {
    throw forbidden("Permission requise pour redemarrer une ressource (server.console.send)");
  }

  const logs: string[] = [];
  logs.push(`[${new Date().toISOString()}] Verification de la ressource ${deployment.resource}`);

  const backend = await getFileBackend();
  let entries;
  try {
    entries = await backend.list(normalizeRemotePath(`/resources/${deployment.resource}`));
    logs.push(`[ok] ${entries.length} element(s) detecte(s)`);
  } catch (error) {
    logs.push(`[erreur] Ressource inaccessible : ${error instanceof Error ? error.message : "inconnue"}`);
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: "FAILED", logs: logs.join("\n") },
    });
    throw conflict("Ressource introuvable sur le serveur : deploiement annule");
  }

  const hasManifest = entries.some(
    (entry) => entry.isFile && entry.name.toLowerCase() === "fxmanifest.lua",
  );
  if (!hasManifest) {
    logs.push("[avertissement] fxmanifest.lua absent de la racine de la ressource");
  }

  let consoleResult = "Non execute (redemarrage non demande)";
  if (input.restartResource) {
    try {
      await sendConsoleCommand(`ensure ${deployment.resource}`, {
        actor: input.user.displayName,
        actorId: input.user.id,
      });
      consoleResult = `Commande envoyee : ensure ${deployment.resource}`;
      logs.push(`[console] ${consoleResult}`);
    } catch (error) {
      consoleResult = `Echec : ${error instanceof Error ? error.message : "inconnu"}`;
      logs.push(`[console][erreur] ${consoleResult}`);
    }
  }

  const updated = await prisma.deployment.update({
    where: { id: deployment.id },
    data: {
      status: "DEPLOYED",
      deployedAt: new Date(),
      logs: [...logs, `[${new Date().toISOString()}] Deploiement termine`].join("\n"),
    },
  });

  // Les modifications liees a cette ressource sont marquees traitees.
  await prisma.fileChange.updateMany({
    where: { resource: deployment.resource, validated: false },
    data: { validated: true },
  });

  await prisma.resource
    .update({ where: { name: deployment.resource }, data: { lastDeployAt: new Date() } })
    .catch(() => undefined);

  await audit({
    actorId: input.user.id,
    actorLabel: input.user.displayName,
    action: "deployment.execute",
    targetType: "deployment",
    targetId: deployment.id,
    metadata: { resource: deployment.resource, consoleResult },
  });

  emitActivity({
    type: "deployment.done",
    title: "Deploiement execute",
    detail: `${deployment.resource} - ${deployment.title}`,
    actor: { id: input.user.id, name: input.user.displayName },
    link: "/deployments",
    timestamp: new Date().toISOString(),
  });

  await notifyMany([deployment.requestedById], {
    type: "deployment.done",
    title: "Deploiement termine",
    body: `${deployment.resource} a ete deploye.`,
    link: "/deployments",
  });

  return { deployment: updated, consoleResult, logs };
}

export async function rollbackDeployment(input: {
  deploymentId: string;
  user: AuthUser;
  restartResource: boolean;
}) {
  const deployment = await prisma.deployment.findUnique({ where: { id: input.deploymentId } });
  if (!deployment) throw notFound("Deploiement introuvable");
  if (!deployment.snapshotId) throw conflict("Aucun snapshot associe a ce deploiement");
  if (!["DEPLOYED", "FAILED", "ROLLED_BACK"].includes(deployment.status)) {
    throw conflict("Ce deploiement ne peut pas etre restaure");
  }

  const snapshot = await readSnapshot(deployment.snapshotId);
  const backend = await getFileBackend();
  const logs: string[] = [
    `[${new Date().toISOString()}] Restauration de ${snapshot.files.length} fichier(s)`,
  ];

  for (const file of snapshot.files) {
    const before = await backend.read(file.path).catch(() => null);
    if (before === file.content) continue;
    await backend.write(file.path, file.content);
    await recordFileChange({
      path: file.path,
      changeType: before === null ? "FILE_CREATED" : "FILE_MODIFIED",
      source: "ROLLBACK",
      before,
      after: file.content,
      userId: input.user.id,
      sessionId: null,
      skipMatching: true,
    });
    logs.push(`[restaure] ${file.path}`);
  }

  if (input.restartResource) {
    try {
      await sendConsoleCommand(`ensure ${deployment.resource}`, {
        actor: input.user.displayName,
        actorId: input.user.id,
      });
      logs.push(`[console] ensure ${deployment.resource}`);
    } catch (error) {
      logs.push(`[console][erreur] ${error instanceof Error ? error.message : "inconnue"}`);
    }
  }

  const updated = await prisma.deployment.update({
    where: { id: deployment.id },
    data: {
      status: "ROLLED_BACK",
      logs: `${deployment.logs ?? ""}\n${logs.join("\n")}`.trim(),
    },
  });

  await audit({
    actorId: input.user.id,
    actorLabel: input.user.displayName,
    action: "deployment.rollback",
    targetType: "deployment",
    targetId: deployment.id,
    metadata: { files: snapshot.files.length },
  });

  return { deployment: updated, restoredFiles: snapshot.files.length };
}
