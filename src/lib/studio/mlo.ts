import {
  escapeXml,
  file,
  formatNumber,
  luaString,
  parseTable,
  result,
  safeSlug,
  stat,
  str,
  timestamp,
} from "./helpers";
import type { StudioDiagnostic, StudioFile, StudioInput, StudioResult } from "./types";

export interface MloRoom {
  name: string;
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export interface MloPortal {
  name: string;
  fromRoom: string;
  toRoom: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  direction: number;
}

export interface MloEntity {
  model: string;
  x: number;
  y: number;
  z: number;
  heading: number;
}

export function parseRooms(csv: string): MloRoom[] {
  return parseTable(csv, ["name", "minX", "minY", "minZ", "maxX", "maxY", "maxZ"]).map((row) => ({
    name: row.name || "room",
    minX: Number(row.minX) || 0,
    minY: Number(row.minY) || 0,
    minZ: Number(row.minZ) || 0,
    maxX: Number(row.maxX) || 0,
    maxY: Number(row.maxY) || 0,
    maxZ: Number(row.maxZ) || 0,
  }));
}

export function parsePortals(csv: string): MloPortal[] {
  return parseTable(csv, [
    "name",
    "fromRoom",
    "toRoom",
    "x",
    "y",
    "z",
    "width",
    "height",
    "direction",
  ]).map((row) => ({
    name: row.name || "portal",
    fromRoom: row.fromRoom || "room_a",
    toRoom: row.toRoom || "room_b",
    x: Number(row.x) || 0,
    y: Number(row.y) || 0,
    z: Number(row.z) || 0,
    width: Number(row.width) || 2,
    height: Number(row.height) || 2.5,
    direction: Number(row.direction) || 0,
  }));
}

export function parseEntities(csv: string): MloEntity[] {
  return parseTable(csv, ["model", "x", "y", "z", "heading"]).map((row) => ({
    model: row.model || "prop_bench_01a",
    x: Number(row.x) || 0,
    y: Number(row.y) || 0,
    z: Number(row.z) || 0,
    heading: Number(row.heading) || 0,
  }));
}

export function generateMloYmap(input: {
  name: string;
  entities: MloEntity[];
  coords: { x: number; y: number; z: number };
  exportedBy: string;
}): string {
  const entities = input.entities
    .map(
      (entity, index) => `    <Item type="CEntityDef">
      <archetypeName>${escapeXml(entity.model)}</archetypeName>
      <flags value="32" />
      <guid value="${index + 1}" />
      <position x="${entity.x.toFixed(3)}" y="${entity.y.toFixed(3)}" z="${entity.z.toFixed(3)}" />
      <rotation x="0.000" y="0.000" z="${entity.heading.toFixed(3)}" w="1.000" />
      <scaleXY value="1.000" />
      <scaleZ value="1.000" />
      <parentIndex value="-1" />
      <lodDist value="120.000" />
      <childLodDist value="0.000" />
      <lodLevel>LODTYPES_DEPTH_ORPHANHD</lodLevel>
      <numChildren value="0" />
      <priorityLevel>0</priorityLevel>
      <extensions value="0" />
      <ambientOcclusionMultiplier value="255" />
      <artificialAmbientOcclusion value="0" />
      <tintValue value="0" />
    </Item>`,
    )
    .join("\n");
  const minX = input.coords.x - 50;
  const minY = input.coords.y - 50;
  const minZ = input.coords.z - 20;
  const maxX = input.coords.x + 50;
  const maxY = input.coords.y + 50;
  const maxZ = input.coords.z + 40;
  return `<?xml version="1.0" encoding="UTF-8"?>
<CMapData>
  <name>${escapeXml(input.name)}</name>
  <parent />
  <flags value="0" />
  <contentFlags value="0" />
  <streamingExtentsMin x="${minX.toFixed(3)}" y="${minY.toFixed(3)}" z="${minZ.toFixed(3)}" />
  <streamingExtentsMax x="${maxX.toFixed(3)}" y="${maxY.toFixed(3)}" z="${maxZ.toFixed(3)}" />
  <entities>
${entities}
  </entities>
  <containerLods />
  <boxOccluders />
  <occludeModels />
  <physicsDictionaries />
  <timeCycleModifiers />
  <carGenerators />
  <LODLightsSOA />
  <DistantLODLightsSOA />
  <block>
    <version value="0" />
    <flags value="0" />
    <name>${escapeXml(input.name)}</name>
    <exportedBy>${escapeXml(input.exportedBy)}</exportedBy>
    <owner>${escapeXml(input.exportedBy)}</owner>
    <time>${timestamp()}</time>
  </block>
</CMapData>
`;
}

export function generateInteriorProxyTemplate(input: {
  mloName: string;
  interiorId: string;
  coords: string;
}): string {
  const [x = "0", y = "0", z = "0"] = input.coords.split(",").map((part) => part.trim());
  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Modele de interiorproxies.meta.
  Ce fichier doit etre genere/verifie par CodeWalker (MLO -> Export).
  Les valeurs ci-dessous sont un point de depart, pas un fichier binaire valide.
-->
<InteriorProxyFile>
  <interiorProxies>
    <Item>
      <name>${escapeXml(input.mloName)}</name>
      <interiorId>${escapeXml(input.interiorId)}</interiorId>
      <position x="${escapeXml(x)}" y="${escapeXml(y)}" z="${escapeXml(z)}" />
      <groupId>0</groupId>
      <hourMask>0xFFFFFFFF</hourMask>
    </Item>
  </interiorProxies>
</InteriorProxyFile>
`;
}

export function generateMloFxmanifest(input: {
  resourceName: string;
  mloName: string;
  author: string;
  description: string;
  includeClient: boolean;
  includeProxies: boolean;
}): string {
  const lines = [
    "fx_version 'cerulean'",
    "game 'gta5'",
    "",
    `author ${luaString(input.author)}`,
    `description ${luaString(input.description)}`,
    "version '1.0.0'",
    "",
    "this_is_a_map 'yes'",
  ];
  if (input.includeClient) {
    lines.push("", "client_script 'client.lua'");
  }
  if (input.includeProxies) {
    lines.push(
      "",
      "-- A activer uniquement lorsque CodeWalker a exporte un interiorproxies.meta valide.",
      "data_file 'INTERIOR_PROXY_ORDER_FILE' 'interiorproxies.meta'",
    );
  }
  return `${lines.join("\n")}\n`;
}

export function generateMloReadme(input: {
  resourceName: string;
  mloName: string;
  author: string;
  rooms: MloRoom[];
  portals: MloPortal[];
  entities: MloEntity[];
  includeProxies: boolean;
}): string {
  return `# ${input.mloName} (${input.resourceName})

Projet MLO genere par FiveM DevManager.

## Contenu

- \`fxmanifest.lua\` : manifeste de la ressource (map).
- \`source/*.ymap.xml\` : source editable pour CodeWalker, **non streamee**.
- \`source/rooms.json\` : ${input.rooms.length} piece(s).
- \`source/portals.json\` : ${input.portals.length} portail(s).
- \`source/entities.json\` : ${input.entities.length} entite(s).
- \`mlo.config.json\` : configuration complete pour regenerer le projet.
${input.includeProxies ? "- `interiorproxies.meta` : modele a remplacer par l'export CodeWalker.\n" : ""}${input.includeProxies ? "" : ""}
## Etapes CodeWalker

1. Ouvrir CodeWalker, charger le projet ou importer le \`.ymap.xml\` depuis \`source/\`.
2. Creer un MLO et definir les pieces (rooms) avec les volumes de \`rooms.json\`.
3. Placer les portails avec les valeurs de \`portals.json\`.
4. Verifier les entites et les LODs, puis exporter le \`.ymap\` et le \`manifest.ymf\`.
5. Placer les fichiers binaires dans \`stream/\`, puis **supprimer** le dossier \`source/\` du stream.
6. Exporter \`interiorproxies.meta\` depuis CodeWalker si votre MLO utilise des interieurs.
7. Tester en jeu avec \`/mlo\` (si \`client.lua\` est inclus) et verifier les collisions.

## Avertissements

- Le fichier \`manifest.ymf\` est binaire : il ne peut pas etre genere par un simple template.
- Ne streamez jamais les fichiers \`.ymap.xml\` : FiveM attend des \`.ymap\` binaires.
- Les coordonnees de test sont indicatives. Adaptez-les a votre map.
`;
}

export function generateMloClient(input: {
  iplName: string;
  coords: string;
}): string {
  const [x = "0", y = "0", z = "0"] = input.coords.split(",").map((part) => part.trim());
  return `-- Chargement et test du MLO
local iplName = ${luaString(input.iplName)}
local testCoords = vector3(${Number(x) || 0}, ${Number(y) || 0}, ${Number(z) || 0})

CreateThread(function()
  RequestIpl(iplName)
  while not IsIplActive(iplName) do
    Wait(50)
    RequestIpl(iplName)
  end
  if not IsInteriorReady(GetInteriorAtCoords(testCoords.x, testCoords.y, testCoords.z)) then
    LoadInterior(GetInteriorAtCoords(testCoords.x, testCoords.y, testCoords.z))
  end
end)

RegisterCommand("mlo", function()
  local ped = PlayerPedId()
  SetEntityCoords(ped, testCoords.x, testCoords.y, testCoords.z, false, false, false, true)
  print("[mlo] teleportation vers " .. iplName)
end, false)

TriggerEvent("chat:addSuggestion", "/mlo", "Tester le MLO ${input.iplName}")
`;
}

function parseCoords(value: string): { x: number; y: number; z: number } {
  const [x = 0, y = 0, z = 0] = value.split(",").map((part) => Number(part.trim()));
  return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0, z: Number.isFinite(z) ? z : 0 };
}

export function buildMloScaffold(input: StudioInput): StudioResult {
  const resourceName = safeSlug(str(input, "resourceName", "chicago_mlo"), "chicago_mlo");
  const mloName = str(input, "mloName", "Nouveau MLO") || "Nouveau MLO";
  const author = str(input, "author", "FiveM DevManager") || "FiveM DevManager";
  const description = str(input, "description", "Projet MLO genere depuis FiveM DevManager");
  const coordsText = str(input, "coords", "0, 0, 0");
  const coords = parseCoords(coordsText);
  const interiorId = str(input, "interiorId", "0");
  const rooms = parseRooms(str(input, "roomsCsv", ""));
  const portals = parsePortals(str(input, "portalsCsv", ""));
  const entities = parseEntities(str(input, "entitiesCsv", ""));
  const includeClient = str(input, "includeClient", "true") !== "false";
  const includeProxies = str(input, "includeProxies", "false") === "true";
  const includeReadme = str(input, "includeReadme", "true") !== "false";
  const iplName = str(input, "iplName", `${resourceName}_mlo`);
  const files: StudioFile[] = [
    file(
      "fxmanifest.lua",
      generateMloFxmanifest({ resourceName, mloName, author, description, includeClient, includeProxies }),
      "lua",
    ),
    file(
      "source/project.ymap.xml",
      generateMloYmap({ name: resourceName, entities, coords, exportedBy: author }),
      "xml",
    ),
    file("source/rooms.json", JSON.stringify(rooms, null, 2), "json"),
    file("source/portals.json", JSON.stringify(portals, null, 2), "json"),
    file("source/entities.json", JSON.stringify(entities, null, 2), "json"),
    file(
      "mlo.config.json",
      JSON.stringify(
        {
          resourceName,
          mloName,
          author,
          description,
          coords,
          interiorId,
          iplName,
          rooms,
          portals,
          entities,
          includeClient,
          includeProxies,
        },
        null,
        2,
      ),
      "json",
    ),
    file(
      "stream/README.txt",
      "Placez ici les fichiers .ymap et .ymf exportes par CodeWalker.\nLes sources .ymap.xml ne doivent pas etre diffusees.\n",
      "text",
    ),
  ];
  if (includeClient) files.push(file("client.lua", generateMloClient({ iplName, coords: coordsText }), "lua"));
  if (includeProxies) {
    files.push(
      file(
        "interiorproxies.meta",
        generateInteriorProxyTemplate({ mloName, interiorId, coords: coordsText }),
        "xml",
      ),
    );
  }
  if (includeReadme) {
    files.push(
      file(
        "README.md",
        generateMloReadme({ resourceName, mloName, author, rooms, portals, entities, includeProxies }),
        "markdown",
      ),
    );
  }
  const diagnostics: StudioDiagnostic[] = [];
  if (rooms.length === 0) {
    diagnostics.push({ level: "warning", message: "Aucune piece definie : ajoutez au moins un volume dans roomsCsv." });
  }
  if (portals.length === 0) {
    diagnostics.push({ level: "warning", message: "Aucun portail defini : les pieces ne seront pas reliees." });
  }
  if (entities.length === 0) {
    diagnostics.push({ level: "info", message: "Aucune entite de depart : le ymap sera vide, ce qui est normal pour un MLO interieur." });
  }
  if (includeProxies) {
    diagnostics.push({
      level: "warning",
      message: "interiorproxies.meta est un modele : remplacez-le par l'export CodeWalker avant activation.",
    });
  }
  diagnostics.push({
    level: "info",
    message: "Le manifest.ymf binaire doit etre exporte par CodeWalker ; ce scaffold prepare la structure et les sources.",
  });
  return result(
    `Projet MLO ${resourceName} pret : ${rooms.length} piece(s), ${portals.length} portail(s), ${entities.length} entite(s), ${files.length} fichier(s).`,
    files,
    {
      diagnostics,
      stats: [
        stat("Pieces", String(rooms.length), rooms.length > 0 ? "success" : "warning"),
        stat("Portails", String(portals.length), portals.length > 0 ? "success" : "warning"),
        stat("Entites", String(entities.length), entities.length > 0 ? "info" : "default"),
        stat("Fichiers", String(files.length), "info"),
      ],
      warnings: [
        "Les fichiers .ymap.xml sont des sources CodeWalker, pas des fichiers streamables.",
        "Exportez .ymap et manifest.ymf avec CodeWalker avant de tester en jeu.",
        "Sauvegardez votre ressource actuelle : ce generateur ne modifie aucun fichier distant.",
      ],
      notes: [
        "La configuration complete est dans mlo.config.json pour regenerer le projet.",
        `Coordonnees de test : ${formatNumber(coords.x, 2)}, ${formatNumber(coords.y, 2)}, ${formatNumber(coords.z, 2)}.`,
      ],
      meta: { resourceName, rooms: rooms.length, portals: portals.length, entities: entities.length },
    },
  );
}

export function buildMloRooms(input: StudioInput): StudioResult {
  const rooms = parseRooms(str(input, "roomsCsv", ""));
  const portals = parsePortals(str(input, "portalsCsv", ""));
  return result(
    `${rooms.length} piece(s) et ${portals.length} portail(s) structures.`,
    [
      file("rooms.json", JSON.stringify(rooms, null, 2), "json"),
      file("portals.json", JSON.stringify(portals, null, 2), "json"),
      file(
        "rooms.lua",
        `Config = {}\nConfig.Rooms = {\n${rooms
          .map(
            (room) =>
              `  { name = ${luaString(room.name)}, min = vector3(${room.minX}, ${room.minY}, ${room.minZ}), max = vector3(${room.maxX}, ${room.maxY}, ${room.maxZ}) },`,
          )
          .join("\n")}\n}\n`,
        "lua",
      ),
    ],
    {
      diagnostics:
        rooms.length === 0
          ? [{ level: "error", message: "Aucune piece detectee dans le CSV." }]
          : [{ level: "info", message: "Verifiez chaque volume dans CodeWalker avant l'export." }],
      stats: [stat("Pieces", String(rooms.length)), stat("Portails", String(portals.length))],
    },
  );
}

export function buildMloEntities(input: StudioInput): StudioResult {
  const entities = parseEntities(str(input, "entitiesCsv", ""));
  const name = safeSlug(str(input, "mapName", "mlo_entities"), "mlo_entities");
  const coords = parseCoords(str(input, "coords", "0, 0, 0"));
  return result(
    `${entities.length} entite(s) converties en ymap XML.`,
    [
      file(`${name}.ymap.xml`, generateMloYmap({ name, entities, coords, exportedBy: "FiveM DevManager" }), "xml"),
      file("entities.json", JSON.stringify(entities, null, 2), "json"),
    ],
    {
      diagnostics:
        entities.length === 0
          ? [{ level: "error", message: "Aucune entite detectee : format attendu model,x,y,z,heading." }]
          : [{ level: "info", message: "Importez le ymap XML dans CodeWalker puis exportez le binaire." }],
      stats: [stat("Entites", String(entities.length), entities.length > 0 ? "success" : "warning")],
    },
  );
}

export function validateYmap(xml: string): StudioResult {
  const entityCount = (xml.match(/<Item type="CEntityDef">/g) ?? []).length;
  const hasMapData = /<CMapData>/.test(xml);
  const hasExtents = /<streamingExtentsMin/.test(xml) && /<streamingExtentsMax/.test(xml);
  const duplicateModels = new Map<string, number>();
  for (const match of xml.matchAll(/<archetypeName>([^<]+)<\/archetypeName>/g)) {
    const model = match[1]!;
    duplicateModels.set(model, (duplicateModels.get(model) ?? 0) + 1);
  }
  const duplicates = [...duplicateModels.entries()].filter(([, count]) => count > 1);
  const diagnostics: StudioDiagnostic[] = [];
  if (!hasMapData) diagnostics.push({ level: "error", message: "Balise CMapData absente : ce n'est pas un ymap valide." });
  if (!hasExtents) diagnostics.push({ level: "warning", message: "streamingExtentsMin/Max absents : le ymap risque de ne pas se charger." });
  if (entityCount === 0) diagnostics.push({ level: "info", message: "Aucune entite CEntityDef detectee." });
  if (duplicates.length > 0) diagnostics.push({ level: "info", message: `${duplicates.length} modele(s) utilise(s) plusieurs fois.` });
  const report = {
    valid: hasMapData,
    entities: entityCount,
    duplicateModels: duplicates.map(([model, count]) => ({ model, count })),
    checkedAt: timestamp(),
  };
  return result(
    hasMapData ? `ymap structure valide : ${entityCount} entite(s).` : "ymap invalide : CMapData manquant.",
    [
      file("ymap-report.json", JSON.stringify(report, null, 2), "json"),
      file(
        "ymap-report.md",
        `# Rapport ymap\n\n- CMapData : ${hasMapData ? "oui" : "non"}\n- Entites : ${entityCount}\n- Extents : ${hasExtents ? "oui" : "non"}\n- Modeles dupliques : ${duplicates.length}\n`,
        "markdown",
      ),
    ],
    {
      diagnostics,
      stats: [
        stat("Entites", String(entityCount)),
        stat("CMapData", hasMapData ? "OK" : "Absent", hasMapData ? "success" : "danger"),
        stat("Extents", hasExtents ? "OK" : "Absents", hasExtents ? "success" : "warning"),
      ],
    },
  );
}
