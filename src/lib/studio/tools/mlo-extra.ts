import { bool, file, mdTable, num, safeSlug, stat, str } from "../helpers";
import { coordParts, list, moduleTool, rows } from "./modules-shared";
import type { StudioTool } from "../types";

export const mloExtraTools: StudioTool[] = [
  moduleTool({
    slug: "mlo-doorlock",
    name: "Verrou de porte MLO",
    category: "mlo",
    description: "Configure une porte verrouillable avec coordonnees, orientation et ACE.",
    icon: "Building2",
    tags: ["mlo", "porte", "serrure"],
    fields: [
      { name: "name", label: "Nom", type: "text", default: "porte_entree" },
      { name: "model", label: "Modele", type: "text", default: "v_ilev_aptdoor01" },
      { name: "coords", label: "Coordonnees", type: "text", default: "0, 0, 0" },
      { name: "heading", label: "Orientation", type: "number", default: 0, min: 0, max: 360 },
      { name: "locked", label: "Verrouillee", type: "switch", default: true },
      { name: "ace", label: "ACE", type: "text", default: "fdm.doorlock" },
    ],
    build: (input) => {
      const name = safeSlug(str(input, "name", "porte_entree"));
      return {
        data: { name, model: str(input, "model", "v_ilev_aptdoor01"), coords: coordParts(str(input, "coords", "0, 0, 0")), heading: num(input, "heading", 0), locked: bool(input, "locked", true), ace: str(input, "ace", "fdm.doorlock") },
        lua: `function CanOpenDoor(src, doorName)\n  if not IsPlayerAceAllowed(src, Config.MloDoorlock.ace) then return false end\n  return not Config.MloDoorlock.locked\nend\n`,
        stats: [stat("Porte", name), stat("ACE", str(input, "ace", "fdm.doorlock"))],
      };
    },
  }),
  moduleTool({
    slug: "mlo-elevator",
    name: "Ascenseur MLO",
    category: "mlo",
    description: "Prepare les etages, la vitesse et le son d'un ascenseur interieur.",
    icon: "Building2",
    tags: ["mlo", "ascenseur", "etage"],
    fields: [
      { name: "name", label: "Nom", type: "text", default: "ascenseur_principal" },
      { name: "floorsCsv", label: "Etages (label,x,y,z)", type: "textarea", rows: 5, default: "Rez-de-chaussee,0,0,0\nEtage 1,0,0,4\nToit,0,0,12" },
      { name: "speed", label: "Vitesse", type: "number", default: 2, step: 0.1, min: 0.5, max: 10 },
      { name: "sound", label: "Son", type: "text", default: "elevator_bell" },
    ],
    build: (input) => {
      const floors = rows(input, "floorsCsv", ["label", "x", "y", "z"]).map((row) => ({ label: row.label || "Etage", x: Number(row.x) || 0, y: Number(row.y) || 0, z: Number(row.z) || 0 }));
      return {
        data: { name: safeSlug(str(input, "name", "ascenseur")), speed: num(input, "speed", 2), sound: str(input, "sound", "elevator_bell"), floors },
        lua: `function MoveElevator(src, floorIndex)\n  local floor = Config.MloElevator.floors[floorIndex]\n  if not floor then return end\n  TriggerClientEvent('mlo:elevator:move', src, floor, Config.MloElevator.speed)\nend\n`,
        stats: [stat("Etages", String(floors.length)), stat("Vitesse", String(num(input, "speed", 2)))],
        diagnostics: floors.length < 2 ? [{ level: "warning", message: "Un ascenseur doit avoir au moins deux etages." }] : [],
      };
    },
  }),
  moduleTool({
    slug: "mlo-audio-zone",
    name: "Zone audio MLO",
    category: "mlo",
    description: "Configure un emetteur audio avec rayon, volume et son.",
    icon: "Building2",
    tags: ["mlo", "audio", "ambiance"],
    fields: [
      { name: "name", label: "Nom", type: "text", default: "ambiance_lobby" },
      { name: "coords", label: "Coordonnees", type: "text", default: "0, 0, 0" },
      { name: "radius", label: "Rayon (m)", type: "number", default: 15, min: 1, max: 200 },
      { name: "sound", label: "Son", type: "text", default: "lobby_music" },
      { name: "volume", label: "Volume", type: "number", default: 0.6, step: 0.05, min: 0, max: 1 },
    ],
    build: (input) => ({
      data: { name: safeSlug(str(input, "name", "zone_audio")), coords: coordParts(str(input, "coords", "0, 0, 0")), radius: num(input, "radius", 15), sound: str(input, "sound", "lobby_music"), volume: num(input, "volume", 0.6) },
      lua: `function IsInsideAudioZone(coords)\n  local zone = Config.MloAudioZone\n  return #(coords - vector3(zone.coords.x, zone.coords.y, zone.coords.z)) <= zone.radius\nend\n`,
      stats: [stat("Rayon", `${num(input, "radius", 15)} m`), stat("Volume", String(num(input, "volume", 0.6)))],
    }),
  }),
  moduleTool({
    slug: "mlo-light-preset",
    name: "Preset lumineux MLO",
    category: "mlo",
    description: "Prepare une source lumineuse interieure avec couleur, intensite et portee.",
    icon: "Building2",
    tags: ["mlo", "lumiere", "ambiance"],
    fields: [
      { name: "coords", label: "Coordonnees", type: "text", default: "0, 0, 0" },
      { name: "color", label: "Couleur hex", type: "text", default: "#FFD9A0" },
      { name: "intensity", label: "Intensite", type: "number", default: 2, step: 0.1, min: 0.1, max: 20 },
      { name: "range", label: "Portee (m)", type: "number", default: 12, min: 1, max: 100 },
      { name: "nightOnly", label: "Nuit uniquement", type: "switch", default: true },
    ],
    build: (input) => ({
      data: { coords: coordParts(str(input, "coords", "0, 0, 0")), color: str(input, "color", "#FFD9A0"), intensity: num(input, "intensity", 2), range: num(input, "range", 12), nightOnly: bool(input, "nightOnly", true) },
      stats: [stat("Couleur", str(input, "color", "#FFD9A0")), stat("Portee", `${num(input, "range", 12)} m`)],
    }),
  }),
  moduleTool({
    slug: "mlo-occlusion",
    name: "Boite d'occlusion",
    category: "mlo",
    description: "Definit une boite d'occlusion pour masquer l'exterieur d'un interieur.",
    icon: "Building2",
    tags: ["mlo", "occlusion", "performance"],
    fields: [
      { name: "name", label: "Nom", type: "text", default: "occlusion_lobby" },
      { name: "min", label: "Min (x,y,z)", type: "text", default: "-10, -10, 0" },
      { name: "max", label: "Max (x,y,z)", type: "text", default: "10, 10, 8" },
      { name: "room", label: "Piece", type: "text", default: "lobby" },
      { name: "flags", label: "Flags", type: "text", default: "0" },
    ],
    build: (input) => ({
      data: { name: safeSlug(str(input, "name", "occlusion")), min: coordParts(str(input, "min", "-10,-10,0")), max: coordParts(str(input, "max", "10,10,8")), room: safeSlug(str(input, "room", "lobby")), flags: str(input, "flags", "0") },
      stats: [stat("Piece", str(input, "room", "lobby")), stat("Flags", str(input, "flags", "0"))],
    }),
  }),
  moduleTool({
    slug: "mlo-navmesh",
    name: "Checklist navmesh",
    category: "mlo",
    description: "Prepare les pieces, flags et etapes de validation du navmesh.",
    icon: "Building2",
    tags: ["mlo", "navmesh", "checklist"],
    fields: [
      { name: "roomsCsv", label: "Pieces", type: "text", default: "lobby, salon, cuisine" },
      { name: "flags", label: "Flags", type: "text", default: "0" },
      { name: "exportTool", label: "Outil d'export", type: "select", options: [{ value: "codewalker", label: "CodeWalker" }, { value: "blender", label: "Blender + addon" }], default: "codewalker" },
      { name: "notes", label: "Notes", type: "textarea", rows: 3, default: "Verifier les escaliers et les portes." },
    ],
    build: (input) => {
      const rooms = list(input, "roomsCsv", "lobby");
      const checklist = mdTable(["Etape", "Statut"], [
        ["Pieces couvertes", rooms.join(", ")],
        ["Flags", str(input, "flags", "0")],
        ["Export", str(input, "exportTool", "codewalker")],
        ["Test en jeu", "A faire"],
      ]);
      return {
        data: { rooms, flags: str(input, "flags", "0"), exportTool: str(input, "exportTool", "codewalker"), notes: str(input, "notes", "") },
        files: [file("checklist.md", `# Checklist navmesh\n\n${checklist}\n`, "markdown")],
        stats: [stat("Pieces", String(rooms.length)), stat("Export", str(input, "exportTool", "codewalker"))],
      };
    },
  }),
  moduleTool({
    slug: "mlo-prop-placer",
    name: "Placeur de props",
    category: "mlo",
    description: "Genere une grille de props avec coordonnees et fichier CSV.",
    icon: "Building2",
    tags: ["mlo", "props", "grille"],
    fields: [
      { name: "model", label: "Modele", type: "text", default: "prop_bench_01a" },
      { name: "origin", label: "Origine (x,y,z)", type: "text", default: "0, 0, 0" },
      { name: "rows", label: "Lignes", type: "number", default: 2, min: 1, max: 20 },
      { name: "cols", label: "Colonnes", type: "number", default: 3, min: 1, max: 20 },
      { name: "spacing", label: "Espacement (m)", type: "number", default: 2, step: 0.1, min: 0.1 },
      { name: "heading", label: "Orientation", type: "number", default: 0, min: 0, max: 360 },
    ],
    build: (input) => {
      const origin = coordParts(str(input, "origin", "0, 0, 0"));
      const rowCount = Math.min(20, num(input, "rows", 2));
      const colCount = Math.min(20, num(input, "cols", 3));
      const spacing = num(input, "spacing", 2);
      const heading = num(input, "heading", 0);
      const model = str(input, "model", "prop_bench_01a");
      const positions = [];
      for (let row = 0; row < rowCount; row += 1) {
        for (let col = 0; col < colCount; col += 1) {
          positions.push({ model, x: origin.x + col * spacing, y: origin.y + row * spacing, z: origin.z, heading });
        }
      }
      return {
        data: { model, origin, rows: rowCount, cols: colCount, spacing, heading, positions },
        files: [file("positions.csv", ["model,x,y,z,heading", ...positions.map((point) => `${point.model},${point.x},${point.y},${point.z},${point.heading}`)].join("\n"), "csv")],
        stats: [stat("Props", String(positions.length)), stat("Grille", `${rowCount} x ${colCount}`)],
      };
    },
  }),
  moduleTool({
    slug: "mlo-shell-picker",
    name: "Selecteur de shell",
    category: "mlo",
    description: "Configure un shell d'interieur, son IPL et ses pieces.",
    icon: "Building2",
    tags: ["mlo", "shell", "ipl"],
    fields: [
      { name: "shell", label: "Shell", type: "text", default: "shell_villa" },
      { name: "interiorId", label: "Interior ID", type: "text", default: "0" },
      { name: "rooms", label: "Pieces", type: "text", default: "lobby, salon, chambre" },
      { name: "ipl", label: "IPL", type: "text", default: "v_shop_247" },
    ],
    build: (input) => ({
      data: { shell: safeSlug(str(input, "shell", "shell_villa")), interiorId: str(input, "interiorId", "0"), rooms: list(input, "rooms", "lobby"), ipl: str(input, "ipl", "v_shop_247") },
      lua: `function LoadShellIpl()\n  RequestIpl(Config.MloShellPicker.ipl)\nend\n`,
      stats: [stat("Shell", str(input, "shell", "shell_villa")), stat("Pieces", String(list(input, "rooms", "lobby").length))],
    }),
  }),
  moduleTool({
    slug: "mlo-scene-packer",
    name: "Pack de scene MLO",
    category: "mlo",
    description: "Prepare une scene avec entites, coordonnees et manifeste de placement.",
    icon: "Building2",
    tags: ["mlo", "scene", "entites"],
    fields: [
      { name: "sceneName", label: "Nom", type: "text", default: "scene_lobby" },
      { name: "coords", label: "Coordonnees", type: "text", default: "0, 0, 0" },
      { name: "entitiesCsv", label: "Entites (model,x,y,z,heading)", type: "textarea", rows: 5, default: "prop_table_01a,1,2,0,0\nprop_chair_01a,2,2,0,90" },
      { name: "category", label: "Categorie", type: "text", default: "interieur" },
    ],
    build: (input) => {
      const entities = rows(input, "entitiesCsv", ["model", "x", "y", "z", "heading"]).map((row) => ({ model: row.model || "prop_bench_01a", x: Number(row.x) || 0, y: Number(row.y) || 0, z: Number(row.z) || 0, heading: Number(row.heading) || 0 }));
      return {
        data: { sceneName: safeSlug(str(input, "sceneName", "scene")), coords: coordParts(str(input, "coords", "0, 0, 0")), category: safeSlug(str(input, "category", "interieur")), entities },
        files: [file("scene-manifest.json", JSON.stringify({ name: str(input, "sceneName", "scene"), entityCount: entities.length, category: str(input, "category", "interieur") }, null, 2), "json")],
        stats: [stat("Entites", String(entities.length)), stat("Categorie", str(input, "category", "interieur"))],
      };
    },
  }),
  moduleTool({
    slug: "mlo-interior-audit",
    name: "Audit interieur MLO",
    category: "mlo",
    description: "Produit un rapport de controle pour les pieces, portails, proxies et IPL.",
    icon: "Building2",
    tags: ["mlo", "audit", "qualite"],
    fields: [
      { name: "roomCount", label: "Pieces", type: "number", default: 3, min: 0, max: 100 },
      { name: "portalCount", label: "Portails", type: "number", default: 2, min: 0, max: 100 },
      { name: "proxyCount", label: "Proxies", type: "number", default: 1, min: 0, max: 100 },
      { name: "hasIpl", label: "IPL charge", type: "switch", default: true },
      { name: "notes", label: "Notes", type: "textarea", rows: 3, default: "Verifier les collisions et les LODs." },
    ],
    build: (input) => {
      const roomCount = num(input, "roomCount", 3);
      const portalCount = num(input, "portalCount", 2);
      const proxyCount = num(input, "proxyCount", 1);
      const hasIpl = str(input, "hasIpl", "true") === "true";
      const report = mdTable(["Controle", "Valeur", "Statut"], [
        ["Pieces", String(roomCount), roomCount > 0 ? "OK" : "A corriger"],
        ["Portails", String(portalCount), portalCount >= Math.max(0, roomCount - 1) ? "OK" : "A verifier"],
        ["Proxies", String(proxyCount), proxyCount > 0 ? "OK" : "A verifier"],
        ["IPL", hasIpl ? "charge" : "absent", hasIpl ? "OK" : "A corriger"],
        ["Notes", str(input, "notes", ""), "-"],
      ]);
      return {
        data: { roomCount, portalCount, proxyCount, hasIpl, notes: str(input, "notes", "") },
        files: [file("audit.md", `# Audit interieur\n\n${report}\n`, "markdown")],
        stats: [stat("Pieces", String(roomCount)), stat("Portails", String(portalCount))],
        diagnostics: portalCount < Math.max(0, roomCount - 1) ? [{ level: "warning", message: "Le nombre de portails semble insuffisant pour relier les pieces." }] : [],
      };
    },
  }),
];
