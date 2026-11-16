/**
 * Scanner de mappings FiveM en lecture seule.
 *
 * Sources analysees :
 * - .ymap.xml (positions exactes des entites / MLO)
 * - mlo.config.json (projets MLO du Studio)
 * - interiorproxies.meta (positions des proxies)
 *
 * Les .ymap binaires (RSC7) sont signales mais ne sont jamais interpretes
 * approximativement : sans source XML, leurs coordonnees ne sont pas fiables.
 */
import "server-only";
import { getFileBackend } from "@/server/files";
import { normalizeRemotePath } from "@/server/path-safety";
import { HttpError } from "@/server/http";
import {
  boundsOfPoints,
  centerOfPoints,
  parseMloConfig,
  parseYmapXml,
  looksLikeMappingXml,
  type MappingBounds,
  type MappingRecord,
  type MappingScan,
  type MappingSource,
} from "@/lib/mappings";

const RESOURCE_ROOT = "/resources";
const MAX_RESOURCES = 180;
const MAX_FILES_PER_RESOURCE = 120;
const MAX_TOTAL_FILES = 1800;
const MAX_DIRECTORIES_PER_RESOURCE = 48;
const MAX_DEPTH = 4;
const MAX_XML_BYTES = 2_000_000;
const MAX_JSON_BYTES = 512_000;
const MAX_TOTAL_POINTS = 5000;
const CACHE_TTL_MS = 120_000;

const IGNORED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "backups",
  "backup",
  "logs",
  "log",
  "cache",
  "dumps",
  "screenshots",
  "web",
  "dist",
  "build",
]);

type CandidateKind = "ymap_xml" | "xml" | "ymap_binary" | "mlo_config" | "meta";
type FileBackend = Awaited<ReturnType<typeof getFileBackend>>;

interface CandidateFile {
  name: string;
  path: string;
  kind: CandidateKind;
  size: number;
  modifiedAt: Date;
}

interface ResourceDirectory {
  resource: string;
  folder: string;
}

interface CacheEntry {
  at: number;
  data: MappingScan;
}

const globalForMappings = globalThis as typeof globalThis & {
  __fdmMappingsCache?: CacheEntry;
};

function candidateKind(name: string): CandidateKind | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".ymap.xml")) return "ymap_xml";
  if (lower.endsWith(".xml")) return "xml";
  if (lower.endsWith(".ymap")) return "ymap_binary";
  if (lower === "mlo.config.json" || lower === "mlo.json") return "mlo_config";
  if (lower === "interiorproxies.meta") return "meta";
  return null;
}

function sourceBase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.ymap\.xml$/i, "")
    .replace(/\.xml$/i, "")
    .replace(/\.ymap$/i, "")
    .replace(/\.meta$/i, "");
}

function displayName(path: string): string {
  const name = path.split("/").pop() ?? path;
  return name
    .replace(/\.ymap\.xml$/i, "")
    .replace(/\.xml$/i, "")
    .replace(/\.ymap$/i, "")
    .replace(/\.json$/i, "")
    .replace(/^mlo(?:\.config)?$/i, "Projet MLO")
    .replace(/^interiorproxies$/i, "Interior proxies");
}

/** Descend recursivement dans les categories [maps]/[custom]/... sans les traiter comme des ressources. */
async function collectResourceFolders(
  backend: FileBackend,
  folder: string,
  label: string,
  depth: number,
  resources: ResourceDirectory[],
  warnings: string[],
): Promise<void> {
  let entries: Awaited<ReturnType<typeof backend.list>>;
  try {
    entries = await backend.list(folder);
  } catch (error) {
    warnings.push(`Impossible de lire ${folder} (${error instanceof Error ? error.message : "erreur"}).`);
    return;
  }
  for (const entry of entries) {
    if (entry.isFile || entry.isSymlink) continue;
    if (entry.name.startsWith("[")) {
      if (depth >= 3) {
        warnings.push(`${label}/${entry.name} ignore : categorie trop profonde.`);
        continue;
      }
      await collectResourceFolders(backend, entry.path, `${label}/${entry.name}`, depth + 1, resources, warnings);
      continue;
    }
    if (entry.name.startsWith(".") || IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
    resources.push({ resource: `${label}/${entry.name}`, folder: entry.path });
  }
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]!, index);
    }
  });
  await Promise.all(runners);
  return results;
}

async function listResources(
  backend: FileBackend,
): Promise<{ resources: ResourceDirectory[]; warnings: string[]; truncated: boolean }> {
  const warnings: string[] = [];
  let top: Awaited<ReturnType<typeof backend.list>>;
  try {
    top = await backend.list(RESOURCE_ROOT);
  } catch (error) {
    throw new HttpError(
      502,
      `Impossible de lister ${RESOURCE_ROOT} : ${error instanceof Error ? error.message : "erreur inconnue"}`,
      "mappings_scan_failed",
    );
  }

  const resources: ResourceDirectory[] = [];
  for (const entry of top) {
    if (entry.isFile || entry.isSymlink) continue;
    if (entry.name.startsWith("[")) {
      await collectResourceFolders(backend, entry.path, entry.name, 1, resources, warnings);
    } else {
      resources.push({ resource: entry.name, folder: entry.path });
    }
  }

  const truncated = resources.length > MAX_RESOURCES;
  if (truncated) {
    warnings.push(`Scan limite aux ${MAX_RESOURCES} premieres ressources sur ${resources.length}.`);
  }
  return { resources: resources.slice(0, MAX_RESOURCES), warnings, truncated };
}

async function walkResource(
  backend: FileBackend,
  resource: ResourceDirectory,
): Promise<{ files: CandidateFile[]; warnings: string[]; scannedDirectories: number }> {
  const warnings: string[] = [];
  const files: CandidateFile[] = [];
  const queue: Array<{ path: string; depth: number }> = [{ path: resource.folder, depth: 0 }];
  let scannedDirectories = 0;

  while (queue.length > 0 && files.length < MAX_FILES_PER_RESOURCE) {
    if (scannedDirectories >= MAX_DIRECTORIES_PER_RESOURCE) {
      warnings.push(`${resource.resource} : limite de dossiers atteinte.`);
      break;
    }
    const current = queue.shift()!;
    scannedDirectories += 1;

    let entries: Awaited<ReturnType<typeof backend.list>>;
    try {
      entries = await backend.list(current.path);
    } catch (error) {
      warnings.push(
        `${resource.resource} : lecture impossible de ${current.path} (${error instanceof Error ? error.message : "erreur"}).`,
      );
      continue;
    }

    for (const entry of entries) {
      if (files.length >= MAX_FILES_PER_RESOURCE) break;
      if (entry.isFile) {
        const kind = candidateKind(entry.name);
        if (!kind) continue;
        files.push({
          name: entry.name,
          path: normalizeRemotePath(entry.path),
          kind,
          size: entry.size,
          modifiedAt: entry.modifiedAt,
        });
      } else if (!entry.isSymlink && current.depth < MAX_DEPTH) {
        if (entry.name.startsWith(".") || IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
        queue.push({ path: entry.path, depth: current.depth + 1 });
      }
    }
  }

  if (files.length >= MAX_FILES_PER_RESOURCE) {
    warnings.push(`${resource.resource} : limite de ${MAX_FILES_PER_RESOURCE} fichiers cartographiques atteinte.`);
  }
  return { files, warnings, scannedDirectories };
}

function recordFor(input: {
  id: string;
  title: string;
  resource: string;
  file: string;
  source: MappingSource;
  points: MappingRecord["points"];
  totalPoints: number;
  truncated: boolean;
  bounds: MappingBounds | null;
  sizeBytes: number;
  modifiedAt: Date;
  binaryPath?: string | null;
  warnings: string[];
}): MappingRecord {
  const center =
    centerOfPoints(input.points) ??
    (input.bounds
      ? {
          x: (input.bounds.minX + input.bounds.maxX) / 2,
          y: (input.bounds.minY + input.bounds.maxY) / 2,
          z: 0,
        }
      : null);
  return {
    id: input.id,
    name: input.title || displayName(input.file),
    resource: input.resource,
    file: input.file,
    source: input.source,
    points: input.points,
    totalPoints: input.totalPoints,
    truncated: input.truncated,
    bounds: input.bounds ?? boundsOfPoints(input.points),
    center,
    sizeBytes: input.sizeBytes,
    modifiedAt: Number.isNaN(input.modifiedAt.getTime()) ? null : input.modifiedAt.toISOString(),
    binaryPath: input.binaryPath ?? null,
    warnings: input.warnings,
  };
}

export async function scanMappings(options: { refresh?: boolean } = {}): Promise<MappingScan> {
  const cached = globalForMappings.__fdmMappingsCache;
  if (!options.refresh && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  const backend = await getFileBackend();
  const { resources, warnings: rootWarnings, truncated: resourceTruncated } = await listResources(backend);
  const perResource = await mapLimit(resources, 4, async (resource) => {
    const walked = await walkResource(backend, resource);
    return { resource, ...walked };
  });

  const mappings: MappingRecord[] = [];
  const warnings = [...rootWarnings];
  let fileCount = 0;
  let resourceCount = 0;
  let unreadableCount = 0;
  let globalPointBudget = MAX_TOTAL_POINTS;
  let remainingFiles = MAX_TOTAL_FILES;
  let truncated = resourceTruncated;

  for (const item of perResource) {
    if (item.files.length === 0) continue;
    if (remainingFiles <= 0) {
      warnings.push(`Scan limite aux ${MAX_TOTAL_FILES} premiers fichiers cartographiques.`);
      truncated = true;
      break;
    }

    const files = item.files.slice(0, remainingFiles);
    if (files.length < item.files.length) {
      warnings.push(
        `${item.resource.resource} : limite globale de ${MAX_TOTAL_FILES} fichiers atteinte.`,
      );
      truncated = true;
    }
    remainingFiles -= files.length;
    if (files.length === 0) continue;

    resourceCount += 1;
    warnings.push(...item.warnings);
    fileCount += files.length;

    const sourceBases = new Set(
      files.filter((file) => file.kind === "ymap_xml" || file.kind === "xml").map((file) => sourceBase(file.name)),
    );
    const binaryByBase = new Map(
      files
        .filter((file) => file.kind === "ymap_binary")
        .map((file) => [sourceBase(file.name), file]),
    );

    for (const file of files.sort((a, b) => a.path.localeCompare(b.path))) {
      if (file.kind === "ymap_binary") {
        const base = sourceBase(file.name);
        if (sourceBases.has(base)) continue;
        unreadableCount += 1;
        mappings.push(
          recordFor({
            id: file.path,
            title: displayName(file.path),
            resource: item.resource.resource,
            file: file.path,
            source: "ymap_binary",
            points: [],
            totalPoints: 0,
            truncated: false,
            bounds: null,
            sizeBytes: file.size,
            modifiedAt: file.modifiedAt,
            warnings: [
              "Fichier .ymap binaire (RSC7) : les positions ne peuvent pas etre extraites de facon fiable sans source .ymap.xml ou CodeWalker.",
            ],
          }),
        );
        continue;
      }

      if (file.size > (file.kind === "mlo_config" ? MAX_JSON_BYTES : MAX_XML_BYTES)) {
        warnings.push(
          `${file.path} ignore : fichier trop volumineux (${Math.round(file.size / 1024)} Ko).`,
        );
        continue;
      }

      let content: string;
      try {
        content = await backend.read(file.path);
      } catch (error) {
        warnings.push(
          `${file.path} ignore : lecture impossible (${error instanceof Error ? error.message : "erreur"}).`,
        );
        continue;
      }

      // Tout .xml n'est pas une carte : on ignore les fichiers de donnees
      // generiques qui ne contiennent ni CMapData, ni groupes, ni proxies.
      if (file.kind === "xml" && !looksLikeMappingXml(content)) continue;

      const parsed =
        file.kind === "mlo_config" ? parseMloConfig(content) : parseYmapXml(content);
      const binary = file.kind === "ymap_xml" || file.kind === "xml" ? binaryByBase.get(sourceBase(file.name)) : undefined;
      const available = Math.min(parsed.points.length, Math.max(0, globalPointBudget));
      const points = parsed.points.slice(0, available);
      const pointTruncated = parsed.truncated || available < parsed.points.length;
      globalPointBudget -= points.length;
      if (pointTruncated) {
        truncated = true;
      }

      const localWarnings = [...parsed.warnings];
      if (available < parsed.points.length) {
        localWarnings.push(
          `Budget global de ${MAX_TOTAL_POINTS} positions atteint ; ${parsed.points.length - available} position(s) non envoyee(s).`,
        );
      }
      if ((file.kind === "ymap_xml" || file.kind === "xml") && binary) {
        localWarnings.push(`Fichier stream associe : ${binary.path}`);
      }

      const source: MappingSource =
        file.kind === "mlo_config" ? "mlo_config" : file.kind === "meta" ? "meta" : "ymap_xml";

      mappings.push(
        recordFor({
          id: file.path,
          title: parsed.title || displayName(file.path),
          resource: item.resource.resource,
          file: file.path,
          source,
          points,
          totalPoints: parsed.totalPoints,
          truncated: pointTruncated,
          bounds: parsed.bounds ?? boundsOfPoints(points),
          sizeBytes: file.size,
          modifiedAt: file.modifiedAt,
          binaryPath: binary?.path ?? null,
          warnings: localWarnings,
        }),
      );
    }
  }

  if (mappings.length === 0) {
    warnings.push(
      "Aucun mapping lisible detecte. Les ressources contenant uniquement des .ymap binaires ne peuvent pas etre positionnees sans source XML.",
    );
  }
  if (unreadableCount > 0) {
    warnings.push(
      `${unreadableCount} fichier(s) .ymap binaire(s) sans source lisible : positions non disponibles.`,
    );
  }
  if (truncated) {
    warnings.push("Le scan a atteint une limite de securite ; relancez-le apres avoir cible les ressources utiles.");
  }

  const data: MappingScan = {
    scannedAt: new Date().toISOString(),
    backend: backend.kind,
    resourceCount,
    fileCount,
    mappingCount: mappings.length,
    pointCount: mappings.reduce((sum, mapping) => sum + mapping.totalPoints, 0),
    unreadableCount,
    mappings: mappings.sort((a, b) => {
      if (Boolean(a.center) !== Boolean(b.center)) return a.center ? -1 : 1;
      return a.resource.localeCompare(b.resource) || a.name.localeCompare(b.name);
    }),
    warnings: Array.from(new Set(warnings)).slice(0, 14),
    truncated,
  };

  globalForMappings.__fdmMappingsCache = { at: Date.now(), data };
  return data;
}

export type { MappingScan };
