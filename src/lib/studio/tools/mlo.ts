import {
  file,
  mdTable,
  num,
  result,
  safeSlug,
  stat,
  str,
} from "../helpers";
import {
  buildMloEntities,
  buildMloRooms,
  buildMloScaffold,
  generateInteriorProxyTemplate,
  generateMloClient,
  generateMloFxmanifest,
  parseEntities,
  parsePortals,
  parseRooms,
  validateYmap,
} from "../mlo";
import type { StudioTool } from "../types";

const defaultRooms = `salon,0,0,0,10,8,3
cuisine,10,0,0,18,8,3
chambre,0,8,0,10,16,3`;
const defaultPortals = `porte_salon_cuisine,salon,cuisine,9.8,4,0,2,2.2,0
porte_salon_chambre,salon,chambre,4,7.8,0,2,2.2,90`;
const defaultEntities = `prop_table_01a,-2,4,1,0
prop_bench_01a,13,4,1,90
v_ilev_mp_bed_low,4,12,1,180`;

export const mloTools: StudioTool[] = [
  {
    slug: "mlo-scaffold",
    name: "Scaffold MLO complet",
    category: "mlo",
    description: "Genere la ressource MLO complete : manifeste, pieces, portails, entites, config et export ZIP.",
    icon: "Building2",
    tags: ["mlo", "mapping", "scaffold"],
    fields: [
      { name: "resourceName", label: "Nom de ressource", type: "text", default: "chicago_mlo_villa", required: true },
      { name: "mloName", label: "Nom du MLO", type: "text", default: "Villa Chicago", required: true },
      { name: "author", label: "Auteur", type: "text", default: "ChicagoRP" },
      { name: "description", label: "Description", type: "text", default: "MLO genere avec FiveM DevManager" },
      { name: "coords", label: "Coordonnees du centre", type: "text", default: "0, 0, 0" },
      { name: "interiorId", label: "Interior ID", type: "text", default: "0" },
      { name: "iplName", label: "Nom IPL", type: "text", default: "chicago_mlo_villa" },
      { name: "roomsCsv", label: "Pieces (name,minX,minY,minZ,maxX,maxY,maxZ)", type: "textarea", rows: 6, default: defaultRooms, required: true },
      { name: "portalsCsv", label: "Portails (name,from,to,x,y,z,width,height,direction)", type: "textarea", rows: 5, default: defaultPortals },
      { name: "entitiesCsv", label: "Entites (model,x,y,z,heading)", type: "textarea", rows: 5, default: defaultEntities },
      { name: "includeClient", label: "Inclure client.lua", type: "switch", default: true },
      { name: "includeProxies", label: "Inclure le modele interiorproxies.meta", type: "switch", default: false },
      { name: "includeReadme", label: "Inclure README.md", type: "switch", default: true },
    ],
    run: buildMloScaffold,
  },
  {
    slug: "mlo-rooms",
    name: "Pieces et volumes MLO",
    category: "mlo",
    description: "Convertit un tableau de pieces et portails en JSON et configuration Lua.",
    icon: "LayoutGrid",
    tags: ["mlo", "rooms", "portails"],
    fields: [
      { name: "roomsCsv", label: "Pieces CSV", type: "textarea", rows: 8, default: defaultRooms, required: true },
      { name: "portalsCsv", label: "Portails CSV", type: "textarea", rows: 5, default: defaultPortals },
    ],
    run: buildMloRooms,
  },
  {
    slug: "mlo-proxies",
    name: "Interior proxies",
    category: "mlo",
    description: "Prepare le modele interiorproxies.meta et sa configuration pour CodeWalker.",
    icon: "DoorOpen",
    tags: ["mlo", "proxies", "interieur"],
    fields: [
      { name: "mloName", label: "Nom du MLO", type: "text", default: "Villa Chicago" },
      { name: "interiorId", label: "Interior ID", type: "text", default: "0" },
      { name: "coords", label: "Coordonnees", type: "text", default: "0, 0, 0" },
      { name: "roomsCsv", label: "Pieces CSV", type: "textarea", rows: 6, default: defaultRooms },
    ],
    run: (input) => {
      const rooms = parseRooms(str(input, "roomsCsv", ""));
      return result("Modele interiorproxies.meta prepare.", [
        file(
          "interiorproxies.meta",
          generateInteriorProxyTemplate({
            mloName: str(input, "mloName", "MLO"),
            interiorId: str(input, "interiorId", "0"),
            coords: str(input, "coords", "0, 0, 0"),
          }),
          "xml",
        ),
        file("interiorproxies.json", JSON.stringify({ mloName: str(input, "mloName", "MLO"), interiorId: str(input, "interiorId", "0"), rooms }, null, 2), "json"),
        file(
          "README.md",
          "# Interior proxies\n\nCe fichier est un **modele**. CodeWalker doit generer le fichier final apres la creation des pieces et portails.\n\n" +
            mdTable(["Piece", "Volume"], rooms.map((room) => [room.name, `${room.minX},${room.minY},${room.minZ} -> ${room.maxX},${room.maxY},${room.maxZ}`])),
          "markdown",
        ),
      ], {
        diagnostics: [{ level: "warning", message: "Ne diffusez pas ce modele tel quel : remplacez-le par l'export CodeWalker." }],
        stats: [stat("Pieces", String(rooms.length))],
      });
    },
  },
  {
    slug: "mlo-entities",
    name: "Entites MLO vers ymap",
    category: "mlo",
    description: "Convertit une liste d'entites en ymap XML compatible CodeWalker.",
    icon: "Boxes",
    tags: ["mlo", "ymap", "entites"],
    fields: [
      { name: "mapName", label: "Nom du ymap", type: "text", default: "mlo_entities" },
      { name: "coords", label: "Centre", type: "text", default: "0, 0, 0" },
      { name: "entitiesCsv", label: "Entites CSV", type: "textarea", rows: 8, default: defaultEntities, required: true },
    ],
    run: buildMloEntities,
  },
  {
    slug: "mlo-portals",
    name: "Portails et liaisons",
    category: "mlo",
    description: "Genere la liste des portails, leur debug visuel et une checklist de raccordement.",
    icon: "GitBranch",
    tags: ["mlo", "portails", "debug"],
    fields: [
      { name: "portalsCsv", label: "Portails CSV", type: "textarea", rows: 8, default: defaultPortals, required: true },
      { name: "roomsCsv", label: "Pieces CSV", type: "textarea", rows: 5, default: defaultRooms },
    ],
    run: (input) => {
      const portals = parsePortals(str(input, "portalsCsv", ""));
      const rooms = parseRooms(str(input, "roomsCsv", ""));
      const roomNames = new Set(rooms.map((room) => room.name));
      const unknown = portals.filter((portal) => !roomNames.has(portal.fromRoom) || !roomNames.has(portal.toRoom));
      const lua = `local portals = ${JSON.stringify(portals, null, 2)}\n\nCreateThread(function()\n  while true do\n    Wait(0)\n    for _, portal in ipairs(portals) do\n      DrawLine(portal.x, portal.y, portal.z, portal.x, portal.y, portal.z + portal.height, 0, 200, 255, 180)\n    end\n  end\nend)\n`;
      return result(`${portals.length} portail(s) exportes.`, [
        file("portals.json", JSON.stringify(portals, null, 2), "json"),
        file("portals-debug.lua", lua, "lua"),
        file("CHECKLIST.md", `# Verification des portails\n\n- [ ] Chaque piece existe\n- [ ] Chaque portail relie deux pieces\n- [ ] Les hauteurs sont coherentes\n- [ ] Test en jeu avec le debug visuel\n\n${unknown.length > 0 ? `Portails avec piece inconnue : ${unknown.map((portal) => portal.name).join(", ")}` : "Toutes les pieces sont connues."}\n`, "markdown"),
      ], {
        diagnostics: unknown.map((portal) => ({ level: "warning" as const, message: `Portail ${portal.name} : piece source/cible inconnue.` })),
        stats: [stat("Portails", String(portals.length)), stat("Pieces", String(rooms.length))],
      });
    },
  },
  {
    slug: "mlo-checklist",
    name: "Checklist MLO",
    category: "mlo",
    description: "Evalue la completude d'un MLO et produit un rapport avec score.",
    icon: "ListChecks",
    tags: ["mlo", "qualite", "checklist"],
    fields: [
      { name: "mloName", label: "Nom du MLO", type: "text", default: "Villa Chicago" },
      { name: "roomCount", label: "Nombre de pieces", type: "number", default: 3, min: 0 },
      { name: "portalCount", label: "Nombre de portails", type: "number", default: 2, min: 0 },
      { name: "hasManifest", label: "manifest.ymf present", type: "switch", default: true },
      { name: "hasProxies", label: "interiorproxies.meta present", type: "switch", default: false },
      { name: "hasLods", label: "LODs configures", type: "switch", default: false },
      { name: "hasOcclusion", label: "Occlusion verifiee", type: "switch", default: false },
    ],
    run: (input) => {
      const name = str(input, "mloName", "MLO");
      const rooms = num(input, "roomCount", 0);
      const portals = num(input, "portalCount", 0);
      const checks = [
        ["Pieces definies", rooms > 0],
        ["Portails definis", portals > 0],
        ["manifest.ymf exporte", str(input, "hasManifest", "true") === "true"],
        ["interiorproxies.meta exporte", str(input, "hasProxies", "false") === "true"],
        ["LODs configures", str(input, "hasLods", "false") === "true"],
        ["Occlusion verifiee", str(input, "hasOcclusion", "false") === "true"],
      ] as const;
      const passed = checks.filter(([, ok]) => ok).length;
      const score = Math.round((passed / checks.length) * 100);
      return result(`Checklist ${name} : ${passed}/${checks.length} points valides (${score}%).`, [
        file("CHECKLIST.md", `# Checklist MLO - ${name}\n\n${mdTable(["Point", "Etat"], checks.map(([label, ok]) => [label, ok ? "OK" : "A completer"]))}\n\nScore : **${score}%**\n`, "markdown"),
        file("checklist.json", JSON.stringify({ name, score, checks: checks.map(([label, ok]) => ({ label, ok })) }, null, 2), "json"),
      ], {
        diagnostics: checks.filter(([, ok]) => !ok).map(([label]) => ({ level: "warning" as const, message: `${label} manquant.` })),
        stats: [stat("Score", `${score}%`, score >= 80 ? "success" : "warning"), stat("Pieces", String(rooms)), stat("Portails", String(portals))],
      });
    },
  },
  {
    slug: "mlo-ipl",
    name: "Chargeur IPL",
    category: "mlo",
    description: "Genere le chargement IPL/interieur et une commande de teleportation de test.",
    icon: "MapPin",
    tags: ["mlo", "ipl", "interieur"],
    fields: [
      { name: "mloName", label: "Nom du MLO", type: "text", default: "Villa Chicago" },
      { name: "iplName", label: "Nom IPL", type: "text", default: "chicago_mlo_villa" },
      { name: "coords", label: "Coordonnees de test", type: "text", default: "0, 0, 0" },
      { name: "enableOnStart", label: "Charger au demarrage", type: "switch", default: true },
    ],
    run: (input) => {
      const iplName = str(input, "iplName", "mlo");
      const client = generateMloClient({ iplName, coords: str(input, "coords", "0, 0, 0") });
      return result(`Chargeur IPL ${iplName} genere.`, [
        file("client.lua", client, "lua"),
        file("fxmanifest.lua", `fx_version 'cerulean'\ngame 'gta5'\n\nthis_is_a_map 'yes'\nclient_script 'client.lua'\n`, "lua"),
      ], {
        notes: ["Verifiez le nom IPL exact dans votre manifest.ymf exporte par CodeWalker."],
      });
    },
  },
  {
    slug: "mlo-lods",
    name: "Plan de LODs",
    category: "mlo",
    description: "Prepare un plan de LODs et d'occlusion pour un MLO ou un mapping.",
    icon: "Layers",
    tags: ["mlo", "lod", "performance"],
    fields: [
      { name: "mloName", label: "Nom du MLO", type: "text", default: "Villa Chicago" },
      { name: "streamingDistance", label: "Distance de streaming", type: "number", default: 300, min: 50 },
      { name: "sizeX", label: "Taille X", type: "number", default: 40, min: 1 },
      { name: "sizeY", label: "Taille Y", type: "number", default: 30, min: 1 },
      { name: "sizeZ", label: "Taille Z", type: "number", default: 12, min: 1 },
      { name: "entitiesCsv", label: "Entites CSV", type: "textarea", rows: 5, default: defaultEntities },
    ],
    run: (input) => {
      const entities = parseEntities(str(input, "entitiesCsv", ""));
      const plan = {
        mloName: str(input, "mloName", "MLO"),
        streamingDistance: num(input, "streamingDistance", 300),
        extents: { x: num(input, "sizeX", 40), y: num(input, "sizeY", 30), z: num(input, "sizeZ", 12) },
        lodLevels: [
          { level: "LOD 0", distance: 0, detail: "Haute definition / props interactifs" },
          { level: "LOD 1", distance: Math.round(num(input, "streamingDistance", 300) * 0.35), detail: "Version simplifiee" },
          { level: "LOD 2", distance: Math.round(num(input, "streamingDistance", 300) * 0.7), detail: "Silhouette / occlusion" },
        ],
        entities: entities.length,
      };
      return result(`Plan de LODs prepare pour ${plan.mloName}.`, [
        file("lod-plan.json", JSON.stringify(plan, null, 2), "json"),
        file("README.md", `# LODs - ${plan.mloName}\n\n${mdTable(["Niveau", "Distance", "Usage"], plan.lodLevels.map((lod) => [lod.level, `${lod.distance} m`, lod.detail]))}\n\n- Entites : ${entities.length}\n- Extents : ${plan.extents.x} x ${plan.extents.y} x ${plan.extents.z}\n- Verifiez l'occlusion avec CodeWalker et en jeu.\n`, "markdown"),
      ], {
        stats: [stat("Entites", String(entities.length)), stat("Distance", `${plan.streamingDistance} m`)],
      });
    },
  },
  {
    slug: "ymap-validator",
    name: "Validateur ymap",
    category: "mlo",
    description: "Verifie un ymap XML : CMapData, extents, entites et doublons.",
    icon: "ShieldCheck",
    tags: ["ymap", "validation", "mapping"],
    fields: [
      { name: "xml", label: "ymap XML", type: "textarea", rows: 12, required: true, default: `<?xml version="1.0" encoding="UTF-8"?>\n<CMapData>\n  <name>exemple</name>\n  <streamingExtentsMin x="-50" y="-50" z="-20" />\n  <streamingExtentsMax x="50" y="50" z="40" />\n  <entities>\n    <Item type="CEntityDef"><archetypeName>prop_bench_01a</archetypeName></Item>\n  </entities>\n</CMapData>` },
    ],
    run: (input) => validateYmap(str(input, "xml", "")),
  },
  {
    slug: "mapping-manifest",
    name: "Manifest de mapping",
    category: "mlo",
    description: "Genere un fxmanifest.lua pour une ressource de map ou de props.",
    icon: "FileCode2",
    tags: ["fxmanifest", "mapping", "ressource"],
    fields: [
      { name: "resourceName", label: "Ressource", type: "text", default: "chicago_mapping" },
      { name: "author", label: "Auteur", type: "text", default: "ChicagoRP" },
      { name: "description", label: "Description", type: "text", default: "Mapping serveur" },
      { name: "mapsCsv", label: "Fichiers map (un par ligne)", type: "textarea", rows: 5, default: "stream/villa.ymap\nstream/villa_manifest.ymf" },
      { name: "includeClient", label: "Inclure client.lua", type: "switch", default: false },
    ],
    run: (input) => {
      const maps = str(input, "mapsCsv", "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const manifest = generateMloFxmanifest({
        resourceName: safeSlug(str(input, "resourceName", "chicago_mapping"), "chicago_mapping"),
        mloName: str(input, "resourceName", "Mapping"),
        author: str(input, "author", "ChicagoRP"),
        description: str(input, "description", "Mapping serveur"),
        includeClient: str(input, "includeClient", "false") === "true",
        includeProxies: false,
      });
      return result("Manifest de mapping genere.", [
        file("fxmanifest.lua", manifest, "lua"),
        file("files.txt", maps.join("\n"), "text"),
        file("README.md", `# Mapping\n\nFichiers declares :\n\n${maps.map((map) => `- ${map}`).join("\n") || "- Aucun"}\n\nPlacez les fichiers binaires dans stream/ avant de demarrer la ressource.\n`, "markdown"),
      ], {
        diagnostics: maps.some((map) => map.endsWith(".xml")) ? [{ level: "warning", message: "Les .ymap.xml ne sont pas streamables ; exportez en .ymap binaire." }] : [],
      });
    },
  },
];
