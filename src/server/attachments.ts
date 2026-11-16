/**
 * Stockage local des pieces jointes de taches.
 *
 * Les fichiers sont ecrits hors du repertoire public, avec un nom aleatoire.
 * Le nom d'origine est conserve en base pour l'affichage/telechargement.
 */
import "server-only";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { badRequest } from "@/server/http";
import {
  DEFAULT_MAX_ATTACHMENT_BYTES,
  attachmentMimeType,
  sanitizeAttachmentName,
  validateAttachment,
} from "@/server/attachment-rules";

const BASE_DIR = path.resolve(process.env.ATTACHMENT_DIR ?? "var/attachments");

export const MAX_ATTACHMENT_BYTES =
  (Number(process.env.MAX_ATTACHMENT_SIZE_KB ?? 0) || 0) > 0
    ? Number(process.env.MAX_ATTACHMENT_SIZE_KB) * 1024
    : DEFAULT_MAX_ATTACHMENT_BYTES;

function resolveStoragePath(storageKey: string): string {
  const absolute = path.resolve(BASE_DIR, storageKey);
  if (!absolute.startsWith(`${BASE_DIR}${path.sep}`)) {
    throw new Error("Cle de stockage invalide");
  }
  return absolute;
}

export interface SaveAttachmentInput {
  taskId: string;
  userId: string;
  file: File;
}

export async function saveTaskAttachment({ taskId, userId, file }: SaveAttachmentInput) {
  const name = sanitizeAttachmentName(file.name);
  const error = validateAttachment(name, file.size, MAX_ATTACHMENT_BYTES);
  if (error) throw badRequest(error);

  const mimeType = attachmentMimeType(name);
  if (!mimeType) throw badRequest("Type de fichier non autorise.");

  const buffer = Buffer.from(await file.arrayBuffer());
  // Verification apres lecture (le Content-Length peut etre absent ou trompeur).
  const bufferError = validateAttachment(name, buffer.length, MAX_ATTACHMENT_BYTES);
  if (bufferError) throw badRequest(bufferError);

  const extension = path.extname(name).toLowerCase();
  const storageKey = `${taskId}/${randomUUID()}${extension}`;
  const absolute = resolveStoragePath(storageKey);

  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, buffer, { mode: 0o600 });

  try {
    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId,
        name,
        mimeType,
        size: buffer.length,
        storageKey,
        uploadedById: userId,
      },
      include: { uploadedBy: { select: { id: true, displayName: true, avatarColor: true } } },
    });
    return { attachment, sha256: createHash("sha256").update(buffer).digest("hex") };
  } catch (error) {
    await unlink(absolute).catch(() => undefined);
    throw error;
  }
}

export async function readTaskAttachment(storageKey: string): Promise<Buffer> {
  return readFile(resolveStoragePath(storageKey));
}

export async function removeTaskAttachmentFile(storageKey: string): Promise<void> {
  await unlink(resolveStoragePath(storageKey)).catch(() => undefined);
}

