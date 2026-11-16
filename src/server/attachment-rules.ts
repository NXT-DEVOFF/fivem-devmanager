/** Regles pures de validation des pieces jointes (testables sans base ni disque). */
import path from "node:path";

export const DEFAULT_MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

/** Types acceptes : captures d'ecran, logs et documents. Aucun executable/script. */
export const ATTACHMENT_MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
  ".log": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
};

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

export function attachmentMimeType(name: string): string | null {
  return ATTACHMENT_MIME_BY_EXTENSION[path.extname(name).toLowerCase()] ?? null;
}

/**
 * Nettoie un nom de fichier utilisateur :
 * - supprime tout chemin (navigation),
 * - retire les caracteres de controle et reserves,
 * - conserve l'extension et limite la longueur.
 */
export function sanitizeAttachmentName(input: string): string {
  const base = String(input ?? "")
    .split(/[/\\]/)
    .pop()!
    .replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");

  const extension = path.extname(base).slice(0, 15);
  const rawStem = base.slice(0, base.length - extension.length).replace(/[. ]+$/, "");
  let stem = rawStem.slice(0, 100) || "fichier";
  if (WINDOWS_RESERVED.test(stem)) stem = `fichier-${stem}`;
  return `${stem}${extension}`;
}

/** Retourne un message d'erreur, ou null si la piece jointe est acceptable. */
export function validateAttachment(
  name: string,
  size: number,
  maxBytes = DEFAULT_MAX_ATTACHMENT_BYTES,
): string | null {
  if (!Number.isFinite(size) || size <= 0) return "Le fichier est vide.";
  if (size > maxBytes) {
    return `Fichier trop volumineux (limite ${Math.floor(maxBytes / (1024 * 1024))} Mo).`;
  }
  if (!attachmentMimeType(name)) {
    return "Type de fichier non autorise (images, .txt, .log, .md, .json ou .pdf uniquement).";
  }
  return null;
}
