/**
 * Modele de scene du builder MLO.
 *
 * Toutes les coordonnees sont en coordonnees GTA (x, y au sol, z en hauteur),
 * pas en coordonnees Three.js. Le rendu 3D convertit x/y/z vers x/z/-y.
 */
import type { MloEntity, MloPortal, MloRoom } from "./mlo";
import type { StudioInput } from "./types";

export interface SceneRoom extends MloRoom {
  id: string;
}

export interface ScenePortal extends MloPortal {
  id: string;
}

export interface SceneEntity extends MloEntity {
  id: string;
}

export interface SceneAnchor {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface MloSceneProject {
  version: 1;
  resourceName: string;
  mloName: string;
  author: string;
  description: string;
  coords: { x: number; y: number; z: number };
  interiorId: string;
  iplName: string;
  includeClient: boolean;
  includeProxies: boolean;
  includeReadme: boolean;
  rooms: SceneRoom[];
  portals: ScenePortal[];
  entities: SceneEntity[];
  anchor: SceneAnchor | null;
}

export type SceneObjectKind = "room" | "portal" | "entity" | "anchor";

export interface SceneSelection {
  kind: SceneObjectKind;
  id: string;
}

export interface SceneBounds {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export interface SceneIssue {
  level: "error" | "warning";
  message: string;
}

export interface MloConfigFile {
  resourceName: string;
  mloName: string;
  author: string;
  description: string;
  coords: { x: number; y: number; z: number };
  interiorId: string;
  iplName: string;
  includeClient: boolean;
  includeProxies: boolean;
  includeReadme: boolean;
  rooms: MloRoom[];
  portals: MloPortal[];
  entities: MloEntity[];
  anchor?: { x: number; y: number; z: number };
}

export const MLO_BUILDER_STORAGE_KEY = "fdm:mlo-builder:v1";

const MAX_ROOMS = 250;
const MAX_PORTALS = 500;
const MAX_ENTITIES = 1000;

let idSequence = 0;

export function createSceneId(prefix: string): string {
  idSequence += 1;
  return `${prefix}_${Date.now().toString(36)}_${idSequence.toString(36)}`;
}

const sceneId = createSceneId;

function finite(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function boolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readCoordinate(value: unknown): { x: number; y: number; z: number } | null {
  if (Array.isArray(value) && value.length >= 2) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    const z = Number(value[2] ?? 0);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x, y, z: Number.isFinite(z) ? z : 0 };
    }
  }
  if (typeof value === "string") {
    const parts = value.split(/[,;\s]+/).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const x = Number(parts[0]);
      const y = Number(parts[1]);
      const z = Number(parts[2] ?? 0);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        return { x, y, z: Number.isFinite(z) ? z : 0 };
      }
    }
  }
  const record = asRecord(value);
  const x = Number(record.x);
  const y = Number(record.y);
  const z = Number(record.z ?? 0);
  if (Number.isFinite(x) && Number.isFinite(y)) {
    return { x, y, z: Number.isFinite(z) ? z : 0 };
  }
  return null;
}

function readVector(record: Record<string, unknown>, prefix: "min" | "max"): { x: number; y: number; z: number } {
  const nested = readCoordinate(record[prefix]);
  if (nested) return nested;
  return {
    x: finite(record[`${prefix}X`], 0),
    y: finite(record[`${prefix}Y`], 0),
    z: finite(record[`${prefix}Z`], 0),
  };
}

function uniqueId(candidate: string, kind: string, fallbackIndex: number, used: Set<string>): string {
  let id = candidate || `${kind}_${fallbackIndex + 1}`;
  let suffix = 2;
  while (used.has(id)) {
    id = `${kind}_${fallbackIndex + 1}_${suffix}`;
    suffix += 1;
  }
  used.add(id);
  return id;
}

export function defaultSceneProject(): MloSceneProject {
  return {
    version: 1,
    resourceName: "chicago_mlo_villa",
    mloName: "Villa Chicago",
    author: "ChicagoRP",
    description: "MLO genere avec FiveM DevManager",
    coords: { x: 9, y: 8, z: 0 },
    interiorId: "0",
    iplName: "chicago_mlo_villa",
    includeClient: true,
    includeProxies: false,
    includeReadme: true,
    rooms: [
      { id: sceneId("room"), name: "salon", minX: 0, minY: 0, minZ: 0, maxX: 10, maxY: 8, maxZ: 3 },
      { id: sceneId("room"), name: "cuisine", minX: 10, minY: 0, minZ: 0, maxX: 18, maxY: 8, maxZ: 3 },
      { id: sceneId("room"), name: "chambre", minX: 0, minY: 8, minZ: 0, maxX: 10, maxY: 16, maxZ: 3 },
    ],
    portals: [
      {
        id: sceneId("portal"),
        name: "porte_salon_cuisine",
        fromRoom: "salon",
        toRoom: "cuisine",
        x: 9.8,
        y: 4,
        z: 0,
        width: 2,
        height: 2.2,
        direction: 0,
      },
      {
        id: sceneId("portal"),
        name: "porte_salon_chambre",
        fromRoom: "salon",
        toRoom: "chambre",
        x: 4,
        y: 7.8,
        z: 0,
        width: 2,
        height: 2.2,
        direction: 90,
      },
    ],
    entities: [
      { id: sceneId("entity"), model: "prop_table_01a", x: -2, y: 4, z: 1, heading: 0 },
      { id: sceneId("entity"), model: "prop_bench_01a", x: 13, y: 4, z: 1, heading: 90 },
      { id: sceneId("entity"), model: "v_ilev_mp_bed_low", x: 4, y: 12, z: 1, heading: 180 },
    ],
    anchor: null,
  };
}

/** Charge un mlo.config.json existant, sans supposer que tous les champs sont presents. */
export function normalizeSceneProject(input: unknown): MloSceneProject {
  const raw = asRecord(input);
  const fallback = defaultSceneProject();
  const coords = readCoordinate(raw.coords) ?? fallback.coords;
  const roomsRaw = Array.isArray(raw.rooms) ? raw.rooms : [];
  const portalsRaw = Array.isArray(raw.portals) ? raw.portals : [];
  const entitiesRaw = Array.isArray(raw.entities) ? raw.entities : [];
  const usedRoomIds = new Set<string>();
  const usedPortalIds = new Set<string>();
  const usedEntityIds = new Set<string>();

  const rooms: SceneRoom[] = roomsRaw.slice(0, MAX_ROOMS).map((item, index) => {
    const record = asRecord(item);
    const min = readVector(record, "min");
    const max = readVector(record, "max");
    return {
      id: uniqueId(text(record.id), "room", index, usedRoomIds),
      name: text(record.name, `piece_${index + 1}`),
      minX: Math.min(min.x, max.x),
      minY: Math.min(min.y, max.y),
      minZ: Math.min(min.z, max.z),
      maxX: Math.max(min.x, max.x),
      maxY: Math.max(min.y, max.y),
      maxZ: Math.max(min.z, max.z),
    };
  });

  const portals: ScenePortal[] = portalsRaw.slice(0, MAX_PORTALS).map((item, index) => {
    const record = asRecord(item);
    const room = rooms.find((candidate) => candidate.name === record.fromRoom) ?? rooms[0];
    const to = rooms.find((candidate) => candidate.name === record.toRoom) ?? rooms[1] ?? room;
    return {
      id: uniqueId(text(record.id), "portal", index, usedPortalIds),
      name: text(record.name, `portail_${index + 1}`),
      fromRoom: text(record.fromRoom, room?.name ?? "room_a"),
      toRoom: text(record.toRoom, to?.name ?? "room_b"),
      x: finite(record.x, room ? (room.minX + room.maxX) / 2 : 0),
      y: finite(record.y, room ? room.maxY : 0),
      z: finite(record.z, room?.minZ ?? 0),
      width: Math.max(0.1, finite(record.width, 2)),
      height: Math.max(0.1, finite(record.height, 2.2)),
      direction: finite(record.direction, 0),
    };
  });

  const entities: SceneEntity[] = entitiesRaw.slice(0, MAX_ENTITIES).map((item, index) => {
    const record = asRecord(item);
    return {
      id: uniqueId(text(record.id), "entity", index, usedEntityIds),
      model: text(record.model, text(record.archetypeName, "prop_bench_01a")),
      x: finite(record.x, 0),
      y: finite(record.y, 0),
      z: finite(record.z, 0),
      heading: finite(record.heading, 0),
    };
  });

  const anchorValue = readCoordinate(raw.anchor);
  const anchor: SceneAnchor | null = anchorValue
    ? { id: uniqueId(text(asRecord(raw.anchor).id), "anchor", 0, new Set<string>()), ...anchorValue }
    : null;

  return {
    version: 1,
    resourceName: text(raw.resourceName, fallback.resourceName),
    mloName: text(raw.mloName, fallback.mloName),
    author: text(raw.author, fallback.author),
    description: text(raw.description, fallback.description),
    coords,
    interiorId: text(raw.interiorId, fallback.interiorId),
    iplName: text(raw.iplName, fallback.iplName),
    includeClient: boolean(raw.includeClient, fallback.includeClient),
    includeProxies: boolean(raw.includeProxies, fallback.includeProxies),
    includeReadme: boolean(raw.includeReadme, fallback.includeReadme),
    rooms,
    portals,
    entities,
    anchor,
  };
}

/** Retire les identifiants UI pour produire un mlo.config.json propre. */
export function sceneToMloConfig(project: MloSceneProject): MloConfigFile {
  return {
    resourceName: project.resourceName,
    mloName: project.mloName,
    author: project.author,
    description: project.description,
    coords: { ...project.coords },
    interiorId: project.interiorId,
    iplName: project.iplName,
    includeClient: project.includeClient,
    includeProxies: project.includeProxies,
    includeReadme: project.includeReadme,
    rooms: project.rooms.map(({ id: _id, ...room }) => room),
    portals: project.portals.map(({ id: _id, ...portal }) => portal),
    entities: project.entities.map(({ id: _id, ...entity }) => entity),
    ...(project.anchor
      ? { anchor: { x: project.anchor.x, y: project.anchor.y, z: project.anchor.z } }
      : {}),
  };
}

function csvCell(value: string | number): string {
  const raw = String(value);
  return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function csvLine(values: Array<string | number>): string {
  return values.map(csvCell).join(",");
}

export function sceneToCsv(project: MloSceneProject): {
  roomsCsv: string;
  portalsCsv: string;
  entitiesCsv: string;
} {
  return {
    roomsCsv: project.rooms
      .map((room) =>
        csvLine([room.name, room.minX, room.minY, room.minZ, room.maxX, room.maxY, room.maxZ]),
      )
      .join("\n"),
    portalsCsv: project.portals
      .map((portal) =>
        csvLine([
          portal.name,
          portal.fromRoom,
          portal.toRoom,
          portal.x,
          portal.y,
          portal.z,
          portal.width,
          portal.height,
          portal.direction,
        ]),
      )
      .join("\n"),
    entitiesCsv: project.entities
      .map((entity) => csvLine([entity.model, entity.x, entity.y, entity.z, entity.heading]))
      .join("\n"),
  };
}

/** Entree compatible avec l'outil mlo-scaffold existant. */
export function sceneToStudioInput(project: MloSceneProject): StudioInput {
  const csv = sceneToCsv(project);
  return {
    resourceName: project.resourceName,
    mloName: project.mloName,
    author: project.author,
    description: project.description,
    coords: `${project.coords.x.toFixed(3)}, ${project.coords.y.toFixed(3)}, ${project.coords.z.toFixed(3)}`,
    interiorId: project.interiorId,
    iplName: project.iplName,
    roomsCsv: csv.roomsCsv,
    portalsCsv: csv.portalsCsv,
    entitiesCsv: csv.entitiesCsv,
    includeClient: project.includeClient,
    includeProxies: project.includeProxies,
    includeReadme: project.includeReadme,
  };
}

export function sceneBounds(project: MloSceneProject): SceneBounds {
  const points: Array<{ x: number; y: number; z: number }> = [
    ...project.rooms.flatMap((room) => [
      { x: room.minX, y: room.minY, z: room.minZ },
      { x: room.maxX, y: room.maxY, z: room.maxZ },
    ]),
    ...project.portals.map((portal) => ({ x: portal.x, y: portal.y, z: portal.z })),
    ...project.entities.map((entity) => ({ x: entity.x, y: entity.y, z: entity.z })),
    ...(project.anchor ? [{ x: project.anchor.x, y: project.anchor.y, z: project.anchor.z }] : []),
  ];

  if (points.length === 0) {
    return {
      minX: project.coords.x - 8,
      minY: project.coords.y - 8,
      minZ: project.coords.z,
      maxX: project.coords.x + 8,
      maxY: project.coords.y + 8,
      maxZ: project.coords.z + 4,
    };
  }

  return points.reduce<SceneBounds>(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      minZ: Math.min(bounds.minZ, point.z),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
      maxZ: Math.max(bounds.maxZ, point.z),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      minZ: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
      maxZ: Number.NEGATIVE_INFINITY,
    },
  );
}

/** Deplace un objet depuis le viewport (coordonnees GTA). */
export function moveSceneObject(
  project: MloSceneProject,
  selection: SceneSelection,
  x: number,
  y: number,
): MloSceneProject {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return project;
  if (selection.kind === "room") {
    const room = project.rooms.find((candidate) => candidate.id === selection.id);
    if (!room) return project;
    const dx = x - (room.minX + room.maxX) / 2;
    const dy = y - (room.minY + room.maxY) / 2;
    return {
      ...project,
      rooms: project.rooms.map((candidate) =>
        candidate.id === selection.id
          ? {
              ...candidate,
              minX: candidate.minX + dx,
              minY: candidate.minY + dy,
              maxX: candidate.maxX + dx,
              maxY: candidate.maxY + dy,
            }
          : candidate,
      ),
    };
  }
  if (selection.kind === "portal") {
    return {
      ...project,
      portals: project.portals.map((portal) =>
        portal.id === selection.id ? { ...portal, x, y } : portal,
      ),
    };
  }
  if (selection.kind === "entity") {
    return {
      ...project,
      entities: project.entities.map((entity) =>
        entity.id === selection.id ? { ...entity, x, y } : entity,
      ),
    };
  }
  return project.anchor?.id === selection.id
    ? { ...project, anchor: { ...project.anchor, x, y } }
    : project;
}

export function sceneStats(project: MloSceneProject): {
  rooms: number;
  portals: number;
  entities: number;
} {
  return {
    rooms: project.rooms.length,
    portals: project.portals.length,
    entities: project.entities.length,
  };
}

export function validateSceneProject(project: MloSceneProject): SceneIssue[] {
  const issues: SceneIssue[] = [];
  if (project.rooms.length === 0) {
    issues.push({ level: "warning", message: "Aucune piece : ajoutez au moins un volume." });
  }
  const roomNames = new Set<string>();
  for (const room of project.rooms) {
    if (!room.name.trim()) {
      issues.push({ level: "error", message: "Une piece n'a pas de nom." });
    } else if (roomNames.has(room.name)) {
      issues.push({ level: "warning", message: `Nom de piece duplique : ${room.name}.` });
    }
    roomNames.add(room.name);
    if (room.maxX <= room.minX || room.maxY <= room.minY || room.maxZ <= room.minZ) {
      issues.push({ level: "error", message: `Volume invalide pour la piece ${room.name}.` });
    }
  }
  for (const portal of project.portals) {
    if (!roomNames.has(portal.fromRoom) || !roomNames.has(portal.toRoom)) {
      issues.push({
        level: "error",
        message: `Portail ${portal.name} : piece source ou cible introuvable.`,
      });
    }
    if (portal.fromRoom === portal.toRoom) {
      issues.push({ level: "warning", message: `Portail ${portal.name} relie une piece a elle-meme.` });
    }
  }
  for (const entity of project.entities) {
    if (!entity.model.trim()) {
      issues.push({ level: "error", message: "Une entite n'a pas de modele." });
    }
  }
  return issues;
}
