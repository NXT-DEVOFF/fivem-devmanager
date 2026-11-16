/** Analyse des ressources FiveM (fxmanifest.lua) et synchronisation. */
import "server-only";
import { prisma } from "@/lib/prisma";
import { toStringArray } from "@/lib/json-array";
import { getFileBackend } from "@/server/files";
import { normalizeRemotePath } from "@/server/path-safety";
import { audit } from "@/server/audit";
import type { AuthUser } from "@/server/auth";
import type { Prisma } from "@prisma/client";
import { isBuiltinResource, normalizeResourceName } from "@/lib/resource-name";

export { normalizeResourceName };

export interface FxManifest {
  fxVersion?: string;
  game?: string;
  author?: string;
  description?: string;
  version?: string;
  dependencies: string[];
  clientScripts: string[];
  serverScripts: string[];
  sharedScripts: string[];
  raw?: string;
}

const RESOURCE_ROOT = "/resources";

/** Parse un fxmanifest.lua sans evaluation de code (regex sure). */
export function parseFxManifest(content: string): FxManifest {
  const manifest: FxManifest = {
    dependencies: [],
    clientScripts: [],
    serverScripts: [],
    sharedScripts: [],
  };

  const single = (key: string): string | undefined => {
    const match = new RegExp(`${key}\\s+['"]([^'"]+)['"]`, "i").exec(content);
    return match?.[1];
  };

  manifest.fxVersion = single("fx_version");
  manifest.game = single("game");
  manifest.author = single("author");
  manifest.description = single("description");
  manifest.version = single("version");

  const depMatches = content.matchAll(/dependenc(?:y|ies)[\s({]+([^)}]*)/gi);
  for (const match of depMatches) {
    for (const item of match[1]!.matchAll(/['"]([^'"]+)['"]/g)) {
      if (item[1]) manifest.dependencies.push(item[1]);
    }
  }

  const collect = (key: string): string[] => {
    const values: string[] = [];
    const block = new RegExp(`${key}\\s*\\{([^}]*)\\}`, "gi");
    for (const match of content.matchAll(block)) {
      for (const item of match[1]!.matchAll(/['"]([^'"]+)['"]/g)) {
        if (item[1]) values.push(item[1]);
      }
    }
    const inline = new RegExp(`${key}\\s+['"]([^'"]+)['"]`, "gi");
    for (const match of content.matchAll(inline)) {
      if (match[1]) values.push(match[1]);
    }
    return Array.from(new Set(values));
  };

  manifest.clientScripts = collect("client_script");
  manifest.serverScripts = collect("server_script");
  manifest.sharedScripts = collect("shared_script");
  manifest.raw = content.slice(0, 20_000);

  return manifest;
}

async function listResourceDirectories(): Promise<Array<{ name: string; folder: string }>> {
  const backend = await getFileBackend();
  const top = await backend.list(RESOURCE_ROOT);
  const result: Array<{ name: string; folder: string }> = [];

  for (const entry of top) {
    if (entry.isFile) continue;
    if (entry.name.startsWith("[")) {
      // Categorie : les ressources sont imbriquees.
      const children = await backend.list(entry.path).catch(() => []);
      for (const child of children) {
        if (child.isFile) continue;
        result.push({ name: `${entry.name}/${child.name}`, folder: child.path });
      }
    } else {
      result.push({ name: entry.name, folder: entry.path });
    }
  }

  return result;
}

export async function syncResources(actor: AuthUser): Promise<{
  scanned: number;
  created: number;
  updated: number;
  missingDependencies: number;
  resources: string[];
}> {
  const backend = await getFileBackend();
  const directories = await listResourceDirectories();
  let created = 0;
  let updated = 0;
  const scannedNames: string[] = [];

  for (const directory of directories.slice(0, 300)) {
    const manifestPath = normalizeRemotePath(`${directory.folder}/fxmanifest.lua`);
    const legacyPath = normalizeRemotePath(`${directory.folder}/__resource.lua`);

    let content = await backend.read(manifestPath).catch(() => null);
    if (content === null) content = await backend.read(legacyPath).catch(() => null);

    const manifest = content ? parseFxManifest(content) : null;
    let fileCount = 0;
    let sizeBytes = 0;
    try {
      const entries = await backend.list(directory.folder);
      fileCount = entries.filter((entry) => entry.isFile).length;
      sizeBytes = entries.filter((entry) => entry.isFile).reduce((sum, entry) => sum + entry.size, 0);
    } catch {
      // dossier illisible
    }

    const data = {
      name: directory.name,
      folder: directory.folder,
      version: manifest?.version ?? null,
      author: manifest?.author ?? null,
      description: manifest?.description ?? null,
      dependencies: manifest?.dependencies ?? [],
      manifest: manifest ? (manifest as unknown as Prisma.InputJsonValue) : undefined,
      fileCount,
      sizeBytes: BigInt(sizeBytes),
      state: content ? "manifest_valide" : "manifest_absent",
      lastModifiedAt: new Date(),
    };

    const exists = await prisma.resource.findUnique({ where: { name: directory.name } });
    if (exists) {
      await prisma.resource.update({ where: { name: directory.name }, data });
      updated += 1;
    } else {
      await prisma.resource.create({ data });
      created += 1;
    }
    scannedNames.push(directory.name);
  }

  // Mise a jour de la liste des dependances manquantes.
  // La comparaison se fait sur le nom court : une dependance `ox_lib` est
  // satisfaite par `[ox]/ox_lib`, et les ressources systeme sont ignorees.
  const present = new Set(directories.map((directory) => normalizeResourceName(directory.name)));
  for (const name of scannedNames) present.add(normalizeResourceName(name));

  const allResources = await prisma.resource.findMany({
    select: { id: true, name: true, dependencies: true },
  });
  const scannedSet = new Set(scannedNames);
  const missingPairs = new Set<string>();

  for (const resource of allResources) {
    if (!scannedSet.has(resource.name)) continue;
    const missingForResource = Array.from(
      new Set(
        toStringArray(resource.dependencies)
          .map((dependency) => dependency.trim())
          .filter((dependency) => dependency.length > 0)
          .filter(
            (dependency) =>
              !isBuiltinResource(dependency) && !present.has(normalizeResourceName(dependency)),
          ),
      ),
    );
    for (const dependency of missingForResource) {
      missingPairs.add(`${resource.name} -> ${dependency}`);
    }
    await prisma.resource.update({
      where: { id: resource.id },
      data: { missingDependencies: missingForResource },
    });
  }

  await audit({
    actorId: actor.id,
    actorLabel: actor.displayName,
    action: "resources.sync",
    targetType: "resource",
    metadata: { scanned: scannedNames.length, created, updated },
  });

  return {
    scanned: scannedNames.length,
    created,
    updated,
    missingDependencies: missingPairs.size,
    resources: scannedNames,
  };
}

export function validateResourceName(name: string): string | null {
  const trimmed = name.trim();
  if (!/^[A-Za-z0-9_\-[\]/]{2,120}$/.test(trimmed)) return null;
  if (trimmed.includes("..")) return null;
  return trimmed;
}
