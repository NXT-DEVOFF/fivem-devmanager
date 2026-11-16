/**
 * Mappings FiveM : types, projection GTA V et parseurs purs.
 *
 * Les fichiers .ymap binaires (RSC7) ne sont pas decodables de facon fiable
 * sans CodeWalker. On extrait donc les positions des sources .ymap.xml,
 * des projets MLO JSON et des interiorproxies.meta. Les binaires sans source
 * sont signales explicitement dans l'interface.
 */

export type MappingSource = "ymap_xml" | "mlo_config" | "meta" | "ymap_binary";

export type MappingPointKind = "entity" | "room" | "portal" | "anchor" | "proxy" | "position";

export interface MappingPoint {
  id: string;
  label: string;
  kind: MappingPointKind;
  x: number;
  y: number;
  z: number;
  model?: string;
}

export interface MappingBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface MappingCenter {
  x: number;
  y: number;
  z: number;
}

export interface MappingRecord {
  id: string;
  name: string;
  resource: string;
  file: string;
  source: MappingSource;
  points: MappingPoint[];
  totalPoints: number;
  truncated: boolean;
  bounds: MappingBounds | null;
  center: MappingCenter | null;
  sizeBytes: number;
  modifiedAt: string | null;
  binaryPath?: string | null;
  warnings: string[];
}

export interface MappingScan {
  scannedAt: string;
  backend: "pterodactyl" | "sftp";
  resourceCount: number;
  fileCount: number;
  mappingCount: number;
  pointCount: number;
  unreadableCount: number;
  mappings: MappingRecord[];
  warnings: string[];
  truncated: boolean;
}

export interface ParsedMapping {
  title?: string;
  points: MappingPoint[];
  totalPoints: number;
  truncated: boolean;
  bounds: MappingBounds | null;
  warnings: string[];
}

/**
 * Bounds du monde GTA V utilises par la carte locale (atlas 1024 x 1024).
 * La calibration a ete verifiee sur Paleto Bay, Sandy Shores, Los Santos,
 * l'aeroport LSIA et Fort Zancudo.
 */
export const GTA_MAP = {
  minX: -3750,
  maxX: 4500,
  minY: -4400,
  maxY: 8000,
  imageWidth: 1024,
  imageHeight: 1024,
  imagePath: "/maps/gta-v/atlas.webp",
} as const;

export const MAPPING_SOURCE_LABELS: Record<MappingSource, string> = {
  ymap_xml: "YMAP XML",
  mlo_config: "Projet MLO",
  meta: "Meta interieur",
  ymap_binary: "YMAP binaire",
};

export const MAPPING_POINT_LABELS: Record<MappingPointKind, string> = {
  entity: "Entite",
  room: "Piece",
  portal: "Portail",
  anchor: "Ancrage",
  proxy: "Proxy interieur",
  position: "Position",
};

/** Convertit une position GTA (metres) en pixels sur l'atlas. */
export function projectGtaPoint(x: number, y: number): { x: number; y: number } {
  const width = GTA_MAP.maxX - GTA_MAP.minX;
  const height = GTA_MAP.maxY - GTA_MAP.minY;
  return {
    x: ((x - GTA_MAP.minX) / width) * GTA_MAP.imageWidth,
    y: ((GTA_MAP.maxY - y) / height) * GTA_MAP.imageHeight,
  };
}

export function isInsideGtaMap(x: number, y: number): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= GTA_MAP.minX &&
    x <= GTA_MAP.maxX &&
    y >= GTA_MAP.minY &&
    y <= GTA_MAP.maxY
  );
}

export function formatMappingCoordinate(point: Pick<MappingPoint, "x" | "y" | "z">): string {
  return `${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.z.toFixed(3)}`;
}

export function centerOfPoints(points: MappingPoint[]): MappingCenter | null {
  if (points.length === 0) return null;
  let x = 0;
  let y = 0;
  let z = 0;
  let count = 0;
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    x += point.x;
    y += point.y;
    z += Number.isFinite(point.z) ? point.z : 0;
    count += 1;
  }
  if (count === 0) return null;
  return { x: x / count, y: y / count, z: z / count };
}

export function boundsOfPoints(points: MappingPoint[]): MappingBounds | null {
  if (points.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    });
}

function attributesOf(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of tag.matchAll(/([a-zA-Z_:][\w:.-]*)\s*=\s*["']([^"']*)["']/g)) {
    result[match[1]!.toLowerCase()] = decodeXml(match[2]!);
  }
  return result;
}

function readTag(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}\\b([^>]*)\\/?>`, "i").exec(xml);
  return match ? match[1] ?? "" : null;
}

function readTagText(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml);
  if (!match) return null;
  const value = decodeXml(match[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  return value || null;
}

function readVector(xml: string, tag: string): MappingCenter | null {
  const attrs = readTag(xml, tag);
  if (!attrs) return null;
  const parsed = attributesOf(attrs);
  const x = Number(parsed.x);
  const y = Number(parsed.y);
  const z = Number(parsed.z ?? 0);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y, z: Number.isFinite(z) ? z : 0 };
}

function classifyItem(type: string | null): MappingPointKind {
  const normalized = (type ?? "").toLowerCase();
  if (normalized.includes("room")) return "room";
  if (normalized.includes("portal")) return "portal";
  if (normalized.includes("proxy")) return "proxy";
  return "entity";
}

/** Reconnait un fichier XML qui contient reellement une carte ou des proxies. */
export function looksLikeMappingXml(content: string): boolean {
  return /<CMapData\b|<CMapGroup\b|<CMapEntity\b|<interiorProxies\b|<SInteriorProxies\b/i.test(content);
}

function pointKey(point: Pick<MappingPoint, "x" | "y" | "z" | "kind">): string {
  return `${point.kind}:${point.x.toFixed(3)}:${point.y.toFixed(3)}:${point.z.toFixed(3)}`;
}

function buildBounds(
  points: MappingPoint[],
  extentsMin: MappingCenter | null,
  extentsMax: MappingCenter | null,
): MappingBounds | null {
  const pointBounds = boundsOfPoints(points);
  if (!extentsMin || !extentsMax) return pointBounds;
  const extents: MappingBounds = {
    minX: Math.min(extentsMin.x, extentsMax.x),
    minY: Math.min(extentsMin.y, extentsMax.y),
    maxX: Math.max(extentsMin.x, extentsMax.x),
    maxY: Math.max(extentsMin.y, extentsMax.y),
  };
  if (!pointBounds) return extents;
  return {
    minX: Math.min(pointBounds.minX, extents.minX),
    minY: Math.min(pointBounds.minY, extents.minY),
    maxX: Math.max(pointBounds.maxX, extents.maxX),
    maxY: Math.max(pointBounds.maxY, extents.maxY),
  };
}

/**
 * Parse un fichier XML de type ymap / interiorproxies.meta.
 * Aucun code n'est evalue : uniquement des balises et des nombres.
 */
export function parseYmapXml(content: string, maxPoints = 1000): ParsedMapping {
  const warnings: string[] = [];
  const points: MappingPoint[] = [];
  const seen = new Set<string>();
  let totalPoints = 0;
  let truncated = false;

  const pushPoint = (candidate: Omit<MappingPoint, "id">) => {
    totalPoints += 1;
    if (points.length >= maxPoints) {
      truncated = true;
      return;
    }
    const key = pointKey(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    points.push({ ...candidate, id: `p${points.length + 1}` });
  };

  const interiorProxies = /<interiorProxies\b/i.test(content);
  const items = Array.from(content.matchAll(/<Item\b([^>]*)>([\s\S]*?)<\/Item>/gi));
  if (items.length > 0) {
    for (const item of items) {
      const attrs = attributesOf(item[1] ?? "");
      const body = item[2] ?? "";
      const position = readVector(body, "position");
      if (!position) continue;
      const type = attrs.type ?? readTagText(body, "type");
      const archetype = readTagText(body, "archetypeName");
      const name = readTagText(body, "name") ?? readTagText(body, "roomName") ?? readTagText(body, "modelName");
      const kind = interiorProxies ? "proxy" : classifyItem(type);
      const label = archetype ?? name ?? (type ? `${type}` : "Position");
      pushPoint({
        label: label || "Position",
        kind,
        x: position.x,
        y: position.y,
        z: position.z,
        ...(archetype ? { model: archetype } : {}),
      });
    }
  }

  // Certains exporteurs produisent directement des blocs <CMapEntity> sans
  // conteneur <Item>. On les accepte aussi en plus des <Item> classiques ;
  // les doublons de position sont filtres par pointKey.
  {
    for (const entity of content.matchAll(/<CMapEntity\b([^>]*)>([\s\S]*?)<\/CMapEntity>/gi)) {
      const attrs = attributesOf(entity[1] ?? "");
      const body = entity[2] ?? "";
      const position = readVector(body, "position");
      if (!position) continue;
      const archetype = readTagText(body, "archetypeName");
      const type = attrs.type ?? readTagText(body, "type");
      pushPoint({
        label: archetype ?? type ?? "CMapEntity",
        kind: classifyItem(type),
        x: position.x,
        y: position.y,
        z: position.z,
        ...(archetype ? { model: archetype } : {}),
      });
    }
  }

  if (totalPoints === 0) {
    // Certains fichiers .meta utilisent des positions hors d'un bloc <Item>.
    for (const match of content.matchAll(/<position\b([^>]*)\/?>/gi)) {
      const parsed = attributesOf(match[1] ?? "");
      const x = Number(parsed.x);
      const y = Number(parsed.y);
      const z = Number(parsed.z ?? 0);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const label = readTagText(content, "name") ?? "Position";
      pushPoint({ label, kind: "position", x, y, z: Number.isFinite(z) ? z : 0 });
    }
  }

  const extentsMin = readVector(content, "streamingExtentsMin");
  const extentsMax = readVector(content, "streamingExtentsMax");
  const bounds = buildBounds(points, extentsMin, extentsMax);

  if (points.length === 0 && extentsMin && extentsMax) {
    const anchor: Omit<MappingPoint, "id"> = {
      label: "Centre des extents",
      kind: "anchor",
      x: (extentsMin.x + extentsMax.x) / 2,
      y: (extentsMin.y + extentsMax.y) / 2,
      z: (extentsMin.z + extentsMax.z) / 2,
    };
    pushPoint(anchor);
  }

  if (totalPoints === 0) {
    warnings.push("Aucune position exploitable dans ce fichier XML.");
  }
  if (truncated) {
    warnings.push(`Affichage limite a ${maxPoints} positions sur ${totalPoints}.`);
  }

  return {
    title: readTagText(content, "name") ?? undefined,
    points,
    totalPoints,
    truncated,
    bounds,
    warnings,
  };
}

function numberValue(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function readCoordinate(...values: unknown[]): MappingCenter | null {
  for (const value of values) {
    if (Array.isArray(value) && value.length >= 2) {
      const x = numberValue(value[0]);
      const y = numberValue(value[1]);
      const z = numberValue(value[2] ?? 0);
      if (x !== null && y !== null) return { x, y, z: z ?? 0 };
    }
    if (typeof value === "string") {
      const parts = value.split(/[,;\s]+/).map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const x = numberValue(parts[0]);
        const y = numberValue(parts[1]);
        const z = numberValue(parts[2] ?? 0);
        if (x !== null && y !== null) return { x, y, z: z ?? 0 };
      }
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const x = numberValue(record.x, record.X);
      const y = numberValue(record.y, record.Y);
      const z = numberValue(record.z, record.Z, 0);
      if (x !== null && y !== null) return { x, y, z: z ?? 0 };
    }
  }
  return null;
}

function readBounds(value: unknown): MappingCenter | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const min = record.min ?? record.minimum;
  const max = record.max ?? record.maximum;
  const position = readCoordinate(record.position, record.center, record.coords);
  if (position) return position;
  const minCoord = readCoordinate(min, record.min) ?? readCoordinate(record.minX, record.minY, record.minZ);
  const maxCoord = readCoordinate(max, record.max) ?? readCoordinate(record.maxX, record.maxY, record.maxZ);
  if (minCoord && maxCoord) {
    return {
      x: (minCoord.x + maxCoord.x) / 2,
      y: (minCoord.y + maxCoord.y) / 2,
      z: (minCoord.z + maxCoord.z) / 2,
    };
  }
  const minX = numberValue(record.minX, record.x1);
  const minY = numberValue(record.minY, record.y1);
  const minZ = numberValue(record.minZ, record.z1, 0);
  const maxX = numberValue(record.maxX, record.x2);
  const maxY = numberValue(record.maxY, record.y2);
  const maxZ = numberValue(record.maxZ, record.z2, 0);
  if (minX === null || minY === null || maxX === null || maxY === null) return null;
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    z: ((minZ ?? 0) + (maxZ ?? 0)) / 2,
  };
}

/** Parse un projet MLO genere par le Studio ou un config.json equivalent. */
export function parseMloConfig(content: string, maxPoints = 1000): ParsedMapping {
  const warnings: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return {
      points: [],
      totalPoints: 0,
      truncated: false,
      bounds: null,
      warnings: ["JSON invalide : impossible de lire les coordonnees."],
    };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      points: [],
      totalPoints: 0,
      truncated: false,
      bounds: null,
      warnings: ["Le fichier JSON ne contient pas un objet de projet MLO."],
    };
  }

  const project = parsed as Record<string, unknown>;
  const points: MappingPoint[] = [];
  const seen = new Set<string>();
  let totalPoints = 0;
  let truncated = false;

  const pushPoint = (candidate: Omit<MappingPoint, "id">) => {
    totalPoints += 1;
    if (points.length >= maxPoints) {
      truncated = true;
      return;
    }
    const key = pointKey(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    points.push({ ...candidate, id: `p${points.length + 1}` });
  };

  const projectCoords = readCoordinate(project.coords, project.coordinates, project.position, project.origin);
  if (projectCoords) {
    pushPoint({
      label: "Point d'ancrage du MLO",
      kind: "anchor",
      x: projectCoords.x,
      y: projectCoords.y,
      z: projectCoords.z,
    });
  }

  if (Array.isArray(project.rooms)) {
    project.rooms.forEach((room, index) => {
      if (!room || typeof room !== "object") return;
      const record = room as Record<string, unknown>;
      const center = readBounds(record);
      if (!center) return;
      const label =
        (typeof record.name === "string" && record.name) ||
        (typeof record.label === "string" && record.label) ||
        `Piece ${index + 1}`;
      pushPoint({ label, kind: "room", x: center.x, y: center.y, z: center.z });
    });
  }

  if (Array.isArray(project.portals)) {
    project.portals.forEach((portal, index) => {
      if (!portal || typeof portal !== "object") return;
      const record = portal as Record<string, unknown>;
      const coord = readCoordinate(record);
      if (!coord) return;
      const label =
        (typeof record.name === "string" && record.name) ||
        (typeof record.label === "string" && record.label) ||
        `Portail ${index + 1}`;
      pushPoint({ label, kind: "portal", x: coord.x, y: coord.y, z: coord.z });
    });
  }

  if (Array.isArray(project.entities)) {
    project.entities.forEach((entity, index) => {
      if (!entity || typeof entity !== "object") return;
      const record = entity as Record<string, unknown>;
      const coord = readCoordinate(record, record.position, record.coords);
      if (!coord) return;
      const model =
        (typeof record.model === "string" && record.model) ||
        (typeof record.archetypeName === "string" && record.archetypeName) ||
        undefined;
      const label =
        (typeof record.name === "string" && record.name) ||
        (typeof record.label === "string" && record.label) ||
        model ||
        `Entite ${index + 1}`;
      pushPoint({ label, kind: "entity", x: coord.x, y: coord.y, z: coord.z, ...(model ? { model } : {}) });
    });
  }

  const title =
    (typeof project.mloName === "string" && project.mloName) ||
    (typeof project.name === "string" && project.name) ||
    (typeof project.resourceName === "string" && project.resourceName) ||
    undefined;

  if (totalPoints === 0) warnings.push("Aucune coordonnee exploitable dans le projet MLO.");
  if (truncated) warnings.push(`Affichage limite a ${maxPoints} positions sur ${totalPoints}.`);

  return {
    title: title || undefined,
    points,
    totalPoints,
    truncated,
    bounds: boundsOfPoints(points),
    warnings,
  };
}
