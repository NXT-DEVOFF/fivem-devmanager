/** Snapshots locaux (sauvegardes avant modification / deploiement). */
import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { promisify } from "node:util";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/server/http";

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export function snapshotRoot(): string {
  return path.resolve(process.cwd(), process.env.SNAPSHOT_DIR ?? "var/snapshots");
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export interface SnapshotFile {
  path: string;
  content: string;
  size: number;
}

/**
 * Sauvegarde locale compressee d'un ou plusieurs fichiers.
 * Les donnees restent sur le serveur applicatif (pas de fuite vers le client).
 */
export async function createSnapshot(input: {
  label: string;
  kind: "MANUAL" | "PRE_WRITE" | "PRE_DEPLOYMENT" | "SESSION_END";
  resource: string;
  path?: string | null;
  files: SnapshotFile[];
  createdById: string;
}): Promise<{ id: string; sizeBytes: number; fileCount: number }> {
  if (input.files.length === 0) {
    throw new HttpError(400, "Aucun fichier a sauvegarder", "empty_snapshot");
  }
  const totalRaw = input.files.reduce((sum, file) => sum + Buffer.byteLength(file.content, "utf8"), 0);
  if (totalRaw > 40 * 1024 * 1024) {
    throw new HttpError(413, "Snapshot trop volumineux (limite 40 Mo)", "snapshot_too_large");
  }

  const root = snapshotRoot();
  await ensureDir(root);

  const id = crypto.randomUUID();
  const storageKey = `${id}.json.gz`;
  const payload = JSON.stringify({
    label: input.label,
    resource: input.resource,
    createdAt: new Date().toISOString(),
    files: input.files.map((file) => ({
      path: file.path,
      size: file.size,
      content: file.content,
    })),
  });
  const compressed = await gzip(Buffer.from(payload, "utf8"), { level: 9 });
  await fs.writeFile(path.join(root, storageKey), compressed);

  const checksum = crypto.createHash("sha256").update(payload).digest("hex");

  const snapshot = await prisma.snapshot.create({
    data: {
      label: input.label,
      kind: input.kind,
      resource: input.resource,
      path: input.path ?? null,
      storageKey,
      sizeBytes: BigInt(compressed.length),
      checksum,
      fileCount: input.files.length,
      createdById: input.createdById,
    },
  });

  return { id: snapshot.id, sizeBytes: compressed.length, fileCount: input.files.length };
}

export async function readSnapshot(snapshotId: string): Promise<{
  label: string;
  resource: string;
  files: Array<{ path: string; content: string }>;
}> {
  const snapshot = await prisma.snapshot.findUnique({ where: { id: snapshotId } });
  if (!snapshot) throw new HttpError(404, "Snapshot introuvable", "snapshot_not_found");

  const root = snapshotRoot();
  const filePath = path.join(root, snapshot.storageKey);
  // Defense en profondeur contre une traversee via storageKey.
  if (!filePath.startsWith(root)) throw new HttpError(400, "Chemin de snapshot invalide");

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch {
    throw new HttpError(410, "Le fichier de snapshot n'existe plus sur le disque", "snapshot_missing");
  }

  const json = JSON.parse((await gunzip(buffer)).toString("utf8")) as {
    label: string;
    resource: string;
    files: Array<{ path: string; content: string }>;
  };

  return { label: json.label, resource: json.resource, files: json.files };
}

export async function deleteSnapshot(snapshotId: string): Promise<void> {
  const snapshot = await prisma.snapshot.findUnique({ where: { id: snapshotId } });
  if (!snapshot) return;
  try {
    await fs.unlink(path.join(snapshotRoot(), snapshot.storageKey));
  } catch {
    // deja supprime
  }
  await prisma.snapshot.delete({ where: { id: snapshotId } });
}
