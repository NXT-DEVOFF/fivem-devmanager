/** Protection contre les traversées de repertoire et validation de chemins distants. */

export const EDITABLE_EXTENSIONS = new Set([
  ".lua",
  ".json",
  ".cfg",
  ".js",
  ".ts",
  ".html",
  ".css",
  ".sql",
  ".xml",
  ".md",
  ".yml",
  ".yaml",
  ".txt",
  ".fxmanifest",
  ".ini",
  ".env",
  ".csv",
  ".tsx",
  ".jsx",
  ".scss",
  ".toml",
]);

export const BLOCKED_SEGMENTS = new Set(["..", "."]);

export class InvalidPathError extends Error {}

/** Normalise un chemin distant: doit commencer par "/" et rester absolu. */
export function normalizeRemotePath(input: string): string {
  if (typeof input !== "string" || input.length === 0) {
    throw new InvalidPathError("Chemin vide");
  }
  if (input.length > 1024) throw new InvalidPathError("Chemin trop long");
  if (input.includes("\0")) throw new InvalidPathError("Chemin invalide");
  if (input.includes("\\")) throw new InvalidPathError("Les antislashs ne sont pas autorises");

  const withRoot = input.startsWith("/") ? input : `/${input}`;
  const segments = withRoot.split("/").filter((s) => s.length > 0);
  const normalized: string[] = [];
  for (const segment of segments) {
    if (segment === ".") continue;
    if (segment === "..") {
      // Refus strict de toute traversee, meme resolvable.
      throw new InvalidPathError("Traversee de repertoire refusee");
    }
    if (segment.length > 255) throw new InvalidPathError("Segment de chemin trop long");
    normalized.push(segment);
  }
  return `/${normalized.join("/")}`;
}

export function parentPath(path: string): string {
  const normalized = normalizeRemotePath(path);
  const index = normalized.lastIndexOf("/");
  return index <= 0 ? "/" : normalized.slice(0, index);
}

export function baseName(path: string): string {
  const normalized = normalizeRemotePath(path);
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

export function joinRemotePath(base: string, name: string): string {
  if (!/^[^/\\\0]+$/.test(name) || name === "." || name === "..") {
    throw new InvalidPathError("Nom de fichier invalide");
  }
  return normalizeRemotePath(`${normalizeRemotePath(base)}/${name}`);
}

export function extensionOf(path: string): string {
  const name = baseName(path);
  if (name.toLowerCase() === "fxmanifest.lua") return ".lua";
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot).toLowerCase();
}

export function isEditable(path: string): boolean {
  if (baseName(path).toLowerCase() === "fxmanifest.lua") return true;
  return EDITABLE_EXTENSIONS.has(extensionOf(path));
}

/**
 * Detecte la ressource FiveM concernee.
 * /resources/[vehicles]/garage/client.lua -> "[vehicles]/garage"
 * /resources/fivem-devmgr/server/main.lua -> "fivem-devmgr"
 */
export function detectResource(path: string): string | null {
  const normalized = normalizeRemotePath(path);
  const parts = normalized.split("/").filter(Boolean);
  const index = parts.indexOf("resources");
  if (index === -1 || index + 1 >= parts.length) return null;
  const first = parts[index + 1]!;
  if (first.startsWith("[") && index + 2 < parts.length) {
    return `${first}/${parts[index + 2]!}`;
  }
  return first;
}

/** Verifie qu'un chemin appartient bien a la racine autorisee. */
export function assertWithinRoot(path: string, root: string): string {
  const normalizedRoot = normalizeRemotePath(root);
  const normalized = normalizeRemotePath(path);
  if (normalizedRoot === "/") return normalized;
  if (normalized === normalizedRoot) return normalized;
  if (!normalized.startsWith(`${normalizedRoot}/`)) {
    throw new InvalidPathError("Chemin hors de la racine autorisee");
  }
  return normalized;
}

export function isBinaryContent(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 512);
  for (const byte of sample) {
    if (byte === 0) return true;
  }
  return false;
}
