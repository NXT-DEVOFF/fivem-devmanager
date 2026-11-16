/**
 * Service de fichiers distant.
 *
 * Backend prefere : API Files de Pterodactyl (respecte les permissions du panel).
 * Fallback : SFTP (ssh2) pour les operations que l'API ne couvre pas
 * (recherche de contenu recursive, acces direct).
 *
 * Toutes les operations sont journalisees et protegees contre les traversées.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { resolvePterodactyl, resolveSftpOrNull, getPterodactylConfig, type ResolvedSftp } from "@/server/integrations";
import { HttpError, badRequest, notFound } from "@/server/http";
import {
  baseName,
  extensionOf,
  isBinaryContent,
  isEditable,
  normalizeRemotePath,
  parentPath,
} from "@/server/path-safety";
import {
  sftpList,
  sftpReadFile,
  sftpWriteFile,
  sftpStat,
  sftpDeleteFile,
  sftpMkdir,
} from "@/server/sftp";
import { PterodactylClient } from "@/server/pterodactyl";
import type { PterodactylFileEntry } from "@/server/pterodactyl";
import { hashContent, recordFileChange } from "@/server/changes";
import { createSnapshot } from "@/server/snapshots";
import { audit } from "@/server/audit";
import type { AuthUser } from "@/server/auth";
import { hasPermission } from "@/server/permissions";

export interface RemoteEntry {
  name: string;
  path: string;
  isFile: boolean;
  isSymlink: boolean;
  size: number;
  modifiedAt: Date;
  mimetype: string;
  editable: boolean;
}

interface FileBackend {
  kind: "pterodactyl" | "sftp";
  list(path: string): Promise<RemoteEntry[]>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  remove(root: string, names: string[]): Promise<void>;
  mkdir(root: string, name: string): Promise<void>;
  rename(root: string, from: string, to: string): Promise<void>;
  upload(dir: string, name: string, data: Buffer): Promise<void>;
  downloadUrl?(path: string): Promise<string>;
}

function mapPterodactylEntry(entry: PterodactylFileEntry, directory: string): RemoteEntry {
  const path = normalizeRemotePath(`${directory}/${entry.name}`);
  return {
    name: entry.name,
    path,
    isFile: entry.is_file,
    isSymlink: entry.is_symlink,
    size: entry.size,
    modifiedAt: new Date(entry.modified_at),
    mimetype: entry.mimetype,
    editable: Boolean(entry.is_file) && isEditable(path),
  };
}

function pterodactylBackend(client: PterodactylClient): FileBackend {
  return {
    kind: "pterodactyl",
    async list(path) {
      const entries = await client.listFiles(normalizeRemotePath(path));
      return entries
        .map((entry) => mapPterodactylEntry(entry, path))
        .sort((a, b) => Number(b.isFile) - Number(a.isFile) || a.name.localeCompare(b.name));
    },
    read: (path) => client.readFile(normalizeRemotePath(path)),
    write: (path, content) => client.writeFile(normalizeRemotePath(path), content),
    async remove(root, names) {
      if (names.length === 0) return;
      await client.deleteFiles(normalizeRemotePath(root), names);
    },
    async mkdir(root, name) {
      await client.createFolder(normalizeRemotePath(root), name);
    },
    async rename(root, from, to) {
      await client.renameFiles(normalizeRemotePath(root), [{ from, to }]);
    },
    async upload(dir, name, data) {
      await client.uploadFile(normalizeRemotePath(dir), { name, data });
    },
    downloadUrl: (path) => client.getDownloadUrl(normalizeRemotePath(path)),
  };
}

function sftpBackend(_config: ResolvedSftp): FileBackend {
  return {
    kind: "sftp",
    async list(path) {
      const entries = await sftpList(path);
      return entries.map((entry) => ({
        name: entry.name,
        path: entry.path,
        isFile: entry.isFile,
        isSymlink: false,
        size: entry.size,
        modifiedAt: entry.modifiedAt,
        mimetype: entry.isFile ? "text/plain" : "inode/directory",
        editable: entry.isFile && isEditable(entry.path),
      }));
    },
    read: (path) => sftpReadFile(path),
    write: (path, content) => sftpWriteFile(path, content),
    async remove(root, names) {
      for (const name of names) {
        await sftpDeleteFile(`${normalizeRemotePath(root)}/${name}`);
      }
    },
    async mkdir(root, name) {
      await sftpMkdir(`${normalizeRemotePath(root)}/${name}`);
    },
    async rename(root, from, to) {
      // ssh2 ne fournit pas de rename via notre wrapper : on refait un couple
      // lecture/ecriture pour les fichiers, et on refuse les dossiers.
      const source = `${normalizeRemotePath(root)}/${from}`;
      const target = `${normalizeRemotePath(root)}/${to}`;
      const content = await sftpReadFile(source);
      await sftpWriteFile(target, content);
      await sftpDeleteFile(source);
    },
    async upload(dir, name, data) {
      const target = `${normalizeRemotePath(dir)}/${name}`;
      await sftpWriteFile(target, data.toString("utf8"));
    },
  };
}

export async function getFileBackend(): Promise<FileBackend> {
  const config = await getPterodactylConfig();
  if (config) {
    const resolved = await resolvePterodactyl();
    return pterodactylBackend(resolved.client);
  }
  const sftp = await resolveSftpOrNull();
  if (sftp) return sftpBackend(sftp);
  throw new HttpError(
    412,
    "Aucune connexion aux fichiers configuree (Pterodactyl ou SFTP)",
    "files_not_configured",
  );
}

export async function describeFileBackend(): Promise<"pterodactyl" | "sftp" | "none"> {
  const config = await getPterodactylConfig();
  if (config) return "pterodactyl";
  const sftp = await resolveSftpOrNull();
  return sftp ? "sftp" : "none";
}

export async function listDirectory(path: string): Promise<{
  path: string;
  backend: string;
  entries: RemoteEntry[];
}> {
  const backend = await getFileBackend();
  const normalized = normalizeRemotePath(path || "/");
  const entries = await backend.list(normalized);
  return { path: normalized, backend: backend.kind, entries };
}

function assertTextContent(content: string, maxBytes: number): void {
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > maxBytes) {
    throw new HttpError(413, `Fichier trop volumineux (${Math.round(bytes / 1024)} Ko)`, "file_too_large");
  }
  if (content.includes("\0")) {
    throw badRequest("Le contenu binaire n'est pas supporte par l'editeur");
  }
}

export async function readRemoteFile(path: string): Promise<{
  path: string;
  content: string;
  hash: string;
  size: number;
  version: number;
  lock: { userId: string; userName: string; expiresAt: string } | null;
}> {
  const backend = await getFileBackend();
  const normalized = normalizeRemotePath(path);

  let content: string;
  try {
    content = await backend.read(normalized);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw notFound(`Impossible de lire ${normalized}`);
  }

  const maxBytes = (Number(process.env.MAX_FILE_SIZE_KB ?? 2048) || 2048) * 1024;
  assertTextContent(content, maxBytes);

  const hash = hashContent(content);
  const tracked = await prisma.trackedFile.findUnique({ where: { path: normalized } });

  // Detection de modification externe (hors application).
  if (tracked && tracked.hash && tracked.hash !== hash) {
    await prisma.trackedFile.update({
      where: { id: tracked.id },
      data: { hash, size: Buffer.byteLength(content, "utf8"), lastCheckedAt: new Date() },
    });
    await recordFileChange({
      path: normalized,
      changeType: "FILE_MODIFIED",
      source: "SYNC",
      before: null,
      after: content,
      userId: null,
      sessionId: null,
    });
  } else if (!tracked) {
    await prisma.trackedFile.create({
      data: {
        path: normalized,
        resource: await resourceOfPath(normalized),
        hash,
        size: Buffer.byteLength(content, "utf8"),
      },
    });
  }

  const lock = await getActiveLock(normalized);

  return {
    path: normalized,
    content,
    hash,
    size: Buffer.byteLength(content, "utf8"),
    version: tracked?.version ?? 1,
    lock: lock
      ? { userId: lock.lockedById!, userName: lock.userName, expiresAt: lock.lockExpiresAt!.toISOString() }
      : null,
  };
}

async function resourceOfPath(path: string): Promise<string | null> {
  const { detectResource } = await import("@/server/path-safety");
  return detectResource(path);
}

async function getActiveLock(
  path: string,
): Promise<{ lockedById: string | null; userName: string; lockExpiresAt: Date | null } | null> {
  const tracked = await prisma.trackedFile.findUnique({
    where: { path },
    include: { lockedBy: { select: { displayName: true } } },
  });
  if (!tracked) return null;
  if (!tracked.lockedById || !tracked.lockExpiresAt) return null;
  if (tracked.lockExpiresAt.getTime() <= Date.now()) {
    await prisma.trackedFile.update({
      where: { id: tracked.id },
      data: { lockedById: null, lockedAt: null, lockExpiresAt: null },
    });
    return null;
  }
  return {
    lockedById: tracked.lockedById,
    userName: tracked.lockedBy?.displayName ?? "Inconnu",
    lockExpiresAt: tracked.lockExpiresAt,
  };
}

export interface SaveFileInput {
  user: AuthUser;
  path: string;
  content: string;
  baseHash?: string | null;
  sessionId?: string | null;
  source?: "EDITOR" | "API" | "UPLOAD";
}

export async function saveRemoteFile(input: SaveFileInput): Promise<{
  path: string;
  hash: string;
  size: number;
  version: number;
  changeId: string;
  matchedTaskId: string | null;
  sessionId: string | null;
}> {
  const normalized = normalizeRemotePath(input.path);
  const maxBytes = (Number(process.env.MAX_FILE_SIZE_KB ?? 2048) || 2048) * 1024;

  if (!isEditable(normalized)) {
    throw badRequest(`Extension non prise en charge pour l'edition : ${extensionOf(normalized) || "(aucune)"}`);
  }
  assertTextContent(input.content, maxBytes);

  const backend = await getFileBackend();

  // Verrou applicatif : empeche l'ecrasement du travail d'un autre developpeur.
  const lock = await getActiveLock(normalized);
  if (lock && lock.lockedById && lock.lockedById !== input.user.id) {
    throw new HttpError(
      423,
      `Fichier verrouille par ${lock.userName} jusqu'a ${lock.lockExpiresAt?.toLocaleTimeString("fr-FR")}`,
      "file_locked",
    );
  }

  let before: string | null = null;
  try {
    before = await backend.read(normalized);
  } catch {
    before = null;
  }

  // Detection des modifications concurrentes.
  if (input.baseHash && before !== null) {
    const currentHash = hashContent(before);
    if (currentHash !== input.baseHash) {
      throw new HttpError(
        409,
        "Le fichier a ete modifie entre-temps par un autre utilisateur. Rechargez-le avant de sauvegarder.",
        "concurrent_modification",
        { currentHash },
      );
    }
  }

  // Sauvegarde avant modification importante.
  if (before !== null && before !== input.content) {
    await createSnapshot({
      label: `Avant modification de ${baseName(normalized)}`,
      kind: "PRE_WRITE",
      resource: (await resourceOfPath(normalized)) ?? "inconnu",
      path: normalized,
      files: [{ path: normalized, content: before, size: Buffer.byteLength(before, "utf8") }],
      createdById: input.user.id,
    }).catch((error) => {
      console.error("[files] snapshot impossible:", error);
    });
  }

  await backend.write(normalized, input.content);

  const afterHash = hashContent(input.content);
  const size = Buffer.byteLength(input.content, "utf8");

  const updated = await prisma.trackedFile.upsert({
    where: { path: normalized },
    create: {
      path: normalized,
      resource: (await resourceOfPath(normalized)) ?? null,
      hash: afterHash,
      size,
      version: 1,
      lastCheckedAt: new Date(),
      lockedById: input.user.id,
      lockedAt: new Date(),
      lockExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
    update: {
      hash: afterHash,
      size,
      version: { increment: 1 },
      lastCheckedAt: new Date(),
      lockedById: input.user.id,
      lockedAt: new Date(),
      lockExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  // Politique produit : le travail doit etre rattache a une session.
  let sessionId = input.sessionId ?? null;
  if (sessionId) {
    const owned = await prisma.devSession.findFirst({
      where: { id: sessionId, userId: input.user.id, status: { in: ["ACTIVE", "PAUSED"] } },
      select: { id: true },
    });
    if (!owned) sessionId = null;
  }
  if (!sessionId) sessionId = await activeSessionId(input.user.id);
  if (!sessionId && !hasPermission(input.user, "sessions.manage")) {
    throw new HttpError(
      409,
      "Demarrez une session de developpement avant de modifier des fichiers.",
      "session_required",
    );
  }

  const change = await recordFileChange({
    path: normalized,
    changeType: before === null ? "FILE_CREATED" : "FILE_MODIFIED",
    source: input.source ?? "EDITOR",
    before,
    after: input.content,
    userId: input.user.id,
    sessionId,
  });

  await audit({
    actorId: input.user.id,
    actorLabel: input.user.displayName,
    action: before === null ? "file.create" : "file.write",
    targetType: "file",
    targetId: normalized,
    metadata: { source: input.source ?? "EDITOR", size, changeId: change.changeId },
  });

  return {
    path: normalized,
    hash: afterHash,
    size,
    version: updated.version,
    changeId: change.changeId,
    matchedTaskId: change.matchedTask?.taskId ?? null,
    sessionId,
  };
}

async function activeSessionId(userId: string): Promise<string | null> {
  const session = await prisma.devSession.findFirst({
    where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  return session?.id ?? null;
}

export async function createRemoteFile(input: {
  user: AuthUser;
  path: string;
  content?: string;
}): Promise<{ path: string }> {
  const backend = await getFileBackend();
  const normalized = normalizeRemotePath(input.path);
  if (!isEditable(normalized)) throw badRequest("Extension de fichier non prise en charge");
  assertTextContent(input.content ?? "", 1024 * 1024);

  const existing = await prisma.trackedFile.findUnique({ where: { path: normalized } });
  if (existing) throw new HttpError(409, "Ce fichier existe deja", "file_exists");

  await backend.write(normalized, input.content ?? "");
  await prisma.trackedFile.create({
    data: {
      path: normalized,
      resource: await resourceOfPath(normalized),
      hash: hashContent(input.content ?? ""),
      size: Buffer.byteLength(input.content ?? "", "utf8"),
    },
  });

  await recordFileChange({
    path: normalized,
    changeType: "FILE_CREATED",
    source: "API",
    before: null,
    after: input.content ?? "",
    userId: input.user.id,
    sessionId: await activeSessionId(input.user.id),
  });

  await audit({
    actorId: input.user.id,
    actorLabel: input.user.displayName,
    action: "file.create",
    targetType: "file",
    targetId: normalized,
  });

  return { path: normalized };
}

export async function createRemoteFolder(input: { user: AuthUser; root: string; name: string }): Promise<void> {
  const backend = await getFileBackend();
  const root = normalizeRemotePath(input.root);
  if (!/^[^/\\\0]+$/.test(input.name) || input.name === "." || input.name === "..") {
    throw badRequest("Nom de dossier invalide");
  }
  await backend.mkdir(root, input.name);
  const target = normalizeRemotePath(`${root}/${input.name}`);
  await recordFileChange({
    path: target,
    changeType: "FOLDER_CREATED",
    source: "API",
    before: null,
    after: null,
    userId: input.user.id,
    sessionId: await activeSessionId(input.user.id),
    skipMatching: true,
  });
  await audit({
    actorId: input.user.id,
    actorLabel: input.user.displayName,
    action: "file.create",
    targetType: "folder",
    targetId: target,
  });
}

export async function renameRemotePath(input: {
  user: AuthUser;
  path: string;
  newName: string;
}): Promise<{ path: string }> {
  const backend = await getFileBackend();
  const normalized = normalizeRemotePath(input.path);
  if (!/^[^/\\\0]+$/.test(input.newName) || input.newName === "." || input.newName === "..") {
    throw badRequest("Nouveau nom invalide");
  }
  const root = parentPath(normalized);
  const from = baseName(normalized);
  await backend.rename(root, from, input.newName);
  const target = normalizeRemotePath(`${root}/${input.newName}`);

  await prisma.trackedFile
    .update({ where: { path: normalized }, data: { path: target } })
    .catch(() => undefined);

  await recordFileChange({
    path: target,
    changeType: "FILE_RENAMED",
    source: "API",
    before: normalized,
    after: target,
    userId: input.user.id,
    sessionId: await activeSessionId(input.user.id),
    skipMatching: true,
  });
  await audit({
    actorId: input.user.id,
    actorLabel: input.user.displayName,
    action: "file.rename",
    targetType: "file",
    targetId: target,
    metadata: { from: normalized },
  });

  return { path: target };
}

export async function deleteRemotePaths(input: {
  user: AuthUser;
  paths: string[];
  confirmation: string;
}): Promise<{ deleted: number }> {
  if (input.confirmation !== "SUPPRIMER") {
    throw badRequest("Confirmation invalide : saisissez SUPPRIMER");
  }
  if (!input.paths.length) throw badRequest("Aucun element selectionne");
  if (input.paths.length > 100) throw badRequest("Trop d'elements dans une seule operation");

  const backend = await getFileBackend();
  let deleted = 0;

  for (const raw of input.paths) {
    const normalized = normalizeRemotePath(raw);
    if (normalized === "/" || normalized === "/resources") {
      throw badRequest("Suppression d'un dossier racine protege refusee");
    }
    const root = parentPath(normalized);
    const name = baseName(normalized);
    await backend.remove(root, [name]);
    await prisma.trackedFile.deleteMany({ where: { path: normalized } });
    await recordFileChange({
      path: normalized,
      changeType: "FILE_DELETED",
      source: "API",
      before: null,
      after: null,
      userId: input.user.id,
      sessionId: await activeSessionId(input.user.id),
      skipMatching: true,
    });
    deleted += 1;
  }

  await audit({
    actorId: input.user.id,
    actorLabel: input.user.displayName,
    action: "file.delete",
    targetType: "file",
    metadata: { paths: input.paths.slice(0, 20) },
  });

  return { deleted };
}

export async function uploadRemoteFile(input: {
  user: AuthUser;
  directory: string;
  name: string;
  data: Buffer;
}): Promise<{ path: string }> {
  const maxBytes = (Number(process.env.MAX_ATTACHMENT_SIZE_KB ?? 8192) || 8192) * 1024;
  if (input.data.length > maxBytes) throw new HttpError(413, "Fichier trop volumineux", "file_too_large");
  if (!/^[^/\\\0]+$/.test(input.name)) throw badRequest("Nom de fichier invalide");

  const backend = await getFileBackend();
  const directory = normalizeRemotePath(input.directory);
  await backend.upload(directory, input.name, input.data);

  const target = normalizeRemotePath(`${directory}/${input.name}`);
  const isText = !isBinaryContent(input.data);
  const content = isText ? input.data.toString("utf8") : null;

  await prisma.trackedFile.upsert({
    where: { path: target },
    create: {
      path: target,
      resource: await resourceOfPath(target),
      hash: content ? hashContent(content) : null,
      size: input.data.length,
    },
    update: { hash: content ? hashContent(content) : null, size: input.data.length },
  });

  await recordFileChange({
    path: target,
    changeType: "FILE_CREATED",
    source: "UPLOAD",
    before: null,
    after: content,
    userId: input.user.id,
    sessionId: await activeSessionId(input.user.id),
  });

  await audit({
    actorId: input.user.id,
    actorLabel: input.user.displayName,
    action: "file.upload",
    targetType: "file",
    targetId: target,
    metadata: { size: input.data.length },
  });

  return { path: target };
}

export async function getDownloadUrl(path: string): Promise<string> {
  const backend = await getFileBackend();
  if (!backend.downloadUrl) {
    throw new HttpError(501, "Le telechargement n'est disponible qu'avec Pterodactyl", "not_supported");
  }
  return backend.downloadUrl(normalizeRemotePath(path));
}

// ---------------------------------------------------------------------------
// Recherche
// ---------------------------------------------------------------------------

export async function searchFiles(input: {
  query: string;
  root?: string;
  mode: "name" | "content";
  maxResults?: number;
}): Promise<Array<{ path: string; name: string; size: number; modifiedAt: string; snippet?: string }>> {
  const query = input.query.trim();
  if (query.length < 2) throw badRequest("La recherche doit contenir au moins 2 caracteres");
  const limit = Math.min(input.maxResults ?? 50, 200);
  const root = normalizeRemotePath(input.root ?? "/resources");

  if (input.mode === "content") {
    const sftp = await resolveSftpOrNull();
    if (!sftp) {
      throw new HttpError(
        412,
        "La recherche dans le contenu necessite une connexion SFTP configuree",
        "sftp_required",
      );
    }
    return searchContentViaSftp(root, query, limit);
  }

  // Recherche par nom : parcours BFS biaise par l'API (profondeur limitee).
  const backend = await getFileBackend();
  const results: Array<{ path: string; name: string; size: number; modifiedAt: string }> = [];
  const queue: Array<{ path: string; depth: number }> = [{ path: root, depth: 0 }];
  const visited = new Set<string>();
  const lowerQuery = query.toLowerCase();

  while (queue.length > 0 && results.length < limit) {
    const current = queue.shift()!;
    if (visited.has(current.path) || current.depth > 5) continue;
    visited.add(current.path);

    let entries: RemoteEntry[];
    try {
      entries = await backend.list(current.path);
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.name.toLowerCase().includes(lowerQuery) && entry.isFile) {
        results.push({
          path: entry.path,
          name: entry.name,
          size: entry.size,
          modifiedAt: entry.modifiedAt.toISOString(),
        });
        if (results.length >= limit) break;
      }
      if (!entry.isFile && !entry.isSymlink) {
        queue.push({ path: entry.path, depth: current.depth + 1 });
      }
    }
  }

  return results;
}

async function searchContentViaSftp(
  root: string,
  query: string,
  limit: number,
): Promise<Array<{ path: string; name: string; size: number; modifiedAt: string; snippet: string }>> {
  const results: Array<{ path: string; name: string; size: number; modifiedAt: string; snippet: string }> = [];
  const queue: string[] = [root];
  const visited = new Set<string>();
  const lowerQuery = query.toLowerCase();

  while (queue.length > 0 && results.length < limit) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    let entries;
    try {
      entries = await sftpList(current);
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (results.length >= limit) break;
      if (!entry.isFile) {
        queue.push(entry.path);
        continue;
      }
      if (!isEditable(entry.path) || entry.size > 512 * 1024) continue;
      const stat = await sftpStat(entry.path).catch(() => null);
      if (!stat || !stat.isFile) continue;
      const content = await sftpReadFile(entry.path, 512 * 1024).catch(() => null);
      if (!content) continue;
      const index = content.toLowerCase().indexOf(lowerQuery);
      if (index === -1) continue;
      const start = Math.max(0, index - 60);
      const snippet = content.slice(start, index + query.length + 120).replace(/\s+/g, " ").trim();
      results.push({
        path: entry.path,
        name: entry.name,
        size: entry.size,
        modifiedAt: entry.modifiedAt.toISOString(),
        snippet,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Verrous applicatifs (edition concurrente)
// ---------------------------------------------------------------------------

export async function acquireFileLock(
  path: string,
  user: AuthUser,
  ttlMinutes = 10,
): Promise<{ ok: true; expiresAt: string } | { ok: false; lockedBy: string }> {
  const normalized = normalizeRemotePath(path);
  const existing = await prisma.trackedFile.findUnique({
    where: { path: normalized },
    include: { lockedBy: { select: { displayName: true } } },
  });

  if (!existing) {
    await prisma.trackedFile.create({
      data: {
        path: normalized,
        resource: await resourceOfPath(normalized),
        lockedById: user.id,
        lockedAt: new Date(),
        lockExpiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
      },
    });
    return { ok: true, expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString() };
  }

  const activeLock =
    existing.lockedById && existing.lockExpiresAt && existing.lockExpiresAt.getTime() > Date.now();
  if (activeLock && existing.lockedById !== user.id) {
    return { ok: false, lockedBy: existing.lockedBy?.displayName ?? "un autre utilisateur" };
  }

  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  await prisma.trackedFile.update({
    where: { id: existing.id },
    data: { lockedById: user.id, lockedAt: new Date(), lockExpiresAt: expiresAt },
  });
  return { ok: true, expiresAt: expiresAt.toISOString() };
}

export async function releaseFileLock(path: string, user: AuthUser): Promise<void> {
  const normalized = normalizeRemotePath(path);
  const existing = await prisma.trackedFile.findUnique({ where: { path: normalized } });
  if (!existing) return;
  if (existing.lockedById !== user.id && !hasPermission(user, "files.restore")) return;
  await prisma.trackedFile.update({
    where: { id: existing.id },
    data: { lockedById: null, lockedAt: null, lockExpiresAt: null },
  });
}
