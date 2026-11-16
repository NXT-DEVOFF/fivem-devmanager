import {
  file,
  formatNumber,
  mdTable,
  num,
  safeSlug,
  sqlIdentifier,
  stat,
  str,
} from "../helpers";
import {
  DEFAULT_HANDLING,
  DEFAULT_HANDLING_XML,
  analyzeHandling,
  generateHandlingXml,
  generateVehiclesMeta,
  parseHandlingXml,
  type HandlingData,
} from "../vehicles";
import { moduleTool } from "./modules-shared";
import type { StudioDiagnostic, StudioTool } from "../types";

const DEFAULT_META_HANDLING_XML = generateHandlingXml({
  ...DEFAULT_HANDLING,
  handlingName: "sultan2",
});

const DEFAULT_VEHICLES_META = generateVehiclesMeta({
  model: "sultan2",
  handlingId: "sultan2",
  make: "Karin",
  vehicleClass: "VC_SPORT",
  vehicleType: "VEHICLE_TYPE_CAR",
  seats: 2,
  doors: 2,
  txdName: "sultan2",
  flags: "FLAG_HAS_LIVERY",
});

const DEFAULT_COMPARISON_XML = generateHandlingXml({
  ...DEFAULT_HANDLING,
  handlingName: "sultan",
  mass: 1600,
  initialDragCoeff: 7.4,
  driveForce: 0.36,
  brakeForce: 1.5,
  maxFlatVel: 68,
  gearRatios: [3.3, 2.2, 1.65, 1.3, 1.02, 0.82],
});

interface ParsedVehicleMeta {
  found: boolean;
  model: string;
  handlingId: string;
  txdName: string;
  make: string;
  vehicleClass: string;
  vehicleType: string;
  seats: number;
  doors: number;
  flags: string;
}

function xmlTag(body: string, tag: string): string {
  const match = body.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1]?.trim() ?? "";
}

function xmlAttribute(body: string, tag: string): number {
  const match = body.match(new RegExp(`<${tag}\\s+value=["']([^"']+)["']`, "i"));
  const value = Number(match?.[1]);
  return Number.isFinite(value) ? value : 0;
}

function parseVehicleMeta(xml: string): ParsedVehicleMeta {
  const item = xml.match(/<Item[^>]*type=["']CVehicleModelInfo__InitData["'][^>]*>([\s\S]*?)<\/Item>/i);
  const body = item?.[1] ?? xml;
  return {
    found: /CVehicleModelInfo__InitData|modelName/i.test(body),
    model: xmlTag(body, "modelName"),
    handlingId: xmlTag(body, "handlingId"),
    txdName: xmlTag(body, "txdName"),
    make: xmlTag(body, "makeName"),
    vehicleClass: xmlTag(body, "vehicleClass"),
    vehicleType: xmlTag(body, "vehicleType"),
    seats: xmlAttribute(body, "maxNumberOfPassengers"),
    doors: xmlAttribute(body, "numberOfDoors"),
    flags: xmlTag(body, "flags"),
  };
}

const handlingLabels: Array<[keyof HandlingData, string]> = [
  ["mass", "Masse"],
  ["initialDragCoeff", "Trainee"],
  ["driveInertia", "Inertie"],
  ["driveForce", "Force motrice"],
  ["brakeForce", "Freinage"],
  ["gears", "Vitesses"],
  ["maxFlatVel", "Vitesse max (m/s)"],
  ["tractionCurveMax", "Traction max"],
  ["tractionCurveMin", "Traction min"],
  ["suspensionForce", "Suspension"],
  ["suspensionDamping", "Amortissement"],
  ["suspensionCompression", "Compression"],
  ["suspensionRaise", "Hauteur"],
  ["suspensionBiasFront", "Biais avant"],
  ["antiRollBarForce", "Barre anti-roulis"],
  ["rollCentreFront", "Centre roulis avant"],
  ["rollCentreRear", "Centre roulis arriere"],
  ["steeringLock", "Braquage"],
];

export const vehicleAdvancedTools: StudioTool[] = [
  moduleTool({
    slug: "vehicle-fleet-telemetry",
    name: "Telemetrie de flotte",
    category: "vehicules",
    description:
      "Genere une ressource complete de collecte telemetrique : vitesse, sante moteur, carrosserie, position et conducteur, avec retention SQL.",
    icon: "Activity",
    tags: ["telemetrie", "flotte", "sql", "performance", "monitoring"],
    fields: [
      { name: "resourceName", label: "Ressource", type: "text", default: "fdm_fleet_telemetry", required: true },
      { name: "table", label: "Table SQL", type: "text", default: "vehicle_telemetry", required: true },
      { name: "sampleSeconds", label: "Intervalle d'echantillonnage (s)", type: "number", default: 15, min: 5, max: 300 },
      { name: "retentionDays", label: "Retention (jours)", type: "number", default: 14, min: 1, max: 365 },
      { name: "speedLimit", label: "Seuil de survitesse (km/h)", type: "number", default: 160, min: 30, max: 400 },
      { name: "engineThreshold", label: "Seuil moteur critique (%)", type: "number", default: 25, min: 0, max: 100 },
      { name: "batchSize", label: "Taille des lots", type: "number", default: 25, min: 1, max: 100 },
      { name: "permission", label: "Permission de consultation", type: "text", default: "fdm.telemetry" },
    ],
    build: (input) => {
      const resource = safeSlug(str(input, "resourceName", "fdm_fleet_telemetry"), "fdm_fleet_telemetry");
      const table = sqlIdentifier(str(input, "table", "vehicle_telemetry"), "vehicle_telemetry");
      const sampleSeconds = Math.max(5, Math.min(300, num(input, "sampleSeconds", 15)));
      const retentionDays = Math.max(1, Math.min(365, num(input, "retentionDays", 14)));
      const speedLimit = Math.max(30, Math.min(400, num(input, "speedLimit", 160)));
      const engineThreshold = Math.max(0, Math.min(100, num(input, "engineThreshold", 25)));
      const batchSize = Math.max(1, Math.min(100, num(input, "batchSize", 25)));
      const permission = str(input, "permission", "fdm.telemetry").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80) || "fdm.telemetry";
      const data = {
        resourceName: resource,
        table,
        sampleSeconds,
        retentionDays,
        speedLimit,
        engineThreshold,
        batchSize,
        permission,
      };

      const schema = `CREATE TABLE IF NOT EXISTS ${table} (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  plate VARCHAR(16) NOT NULL,
  model VARCHAR(32) NOT NULL,
  driver VARCHAR(64) NULL,
  speed_kmh DECIMAL(7,2) NOT NULL DEFAULT 0,
  engine_health DECIMAL(7,2) NOT NULL DEFAULT 0,
  body_health DECIMAL(7,2) NOT NULL DEFAULT 0,
  pos_x DECIMAL(10,3) NOT NULL DEFAULT 0,
  pos_y DECIMAL(10,3) NOT NULL DEFAULT 0,
  pos_z DECIMAL(10,3) NOT NULL DEFAULT 0,
  overspeed TINYINT(1) NOT NULL DEFAULT 0,
  captured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vehicle_telemetry_plate (plate, captured_at),
  INDEX idx_vehicle_telemetry_captured (captured_at),
  INDEX idx_vehicle_telemetry_driver (driver, captured_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

      const fxmanifest = `fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name '${resource}'
description 'Telemetrie de flotte generee par FiveM DevManager'
version '1.0.0'

dependencies {
  'oxmysql',
}

server_scripts {
  'vehicle-fleet-telemetry.lua',
  'server/telemetry.lua',
}
`;

      const server = `local tableName = Config.VehicleFleetTelemetry.table
local sampleSeconds = Config.VehicleFleetTelemetry.sampleSeconds
local retentionDays = Config.VehicleFleetTelemetry.retentionDays
local speedLimit = Config.VehicleFleetTelemetry.speedLimit
local engineThreshold = Config.VehicleFleetTelemetry.engineThreshold
local batchSize = Config.VehicleFleetTelemetry.batchSize
local permission = Config.VehicleFleetTelemetry.permission

local function normalizePlate(value)
  if type(value) ~= 'string' then return nil end
  local plate = value:gsub('%s+', ''):upper():sub(1, 12)
  if #plate < 2 then return nil end
  return plate
end

local function insertBatch(batch)
  if #batch == 0 then return end
  for index = 1, #batch do
    local row = batch[index]
    local ok, err = pcall(function()
      MySQL.insert.await(
        ('INSERT INTO %s (plate, model, driver, speed_kmh, engine_health, body_health, pos_x, pos_y, pos_z, overspeed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'):format(tableName),
        { row.plate, row.model, row.driver, row.speed, row.engine, row.body, row.x, row.y, row.z, row.overspeed }
      )
    end)
    if not ok then
      print(('[%s] insertion telemetrie impossible : %s'):format(GetCurrentResourceName(), tostring(err)))
    end
  end
end

local function collect()
  local vehicles = GetAllVehicles() or {}
  local batch = {}

  for _, vehicle in ipairs(vehicles) do
    if DoesEntityExist(vehicle) then
      local plate = normalizePlate(GetVehicleNumberPlateText(vehicle))
      if plate then
        local coords = GetEntityCoords(vehicle)
        local speed = GetEntitySpeed(vehicle) * 3.6
        local engine = GetVehicleEngineHealth(vehicle) / 10.0
        local body = GetVehicleBodyHealth(vehicle) / 10.0
        local owner = NetworkGetEntityOwner(vehicle)
        local driver = nil

        if owner and owner > 0 then
          driver = GetPlayerIdentifierByType(owner, 'license')
        end

        batch[#batch + 1] = {
          plate = plate,
          model = tostring(GetEntityModel(vehicle)),
          driver = driver,
          speed = math.max(0, math.floor(speed * 100) / 100),
          engine = math.max(0, math.min(100, math.floor(engine * 100) / 100)),
          body = math.max(0, math.min(100, math.floor(body * 100) / 100)),
          x = math.floor(coords.x * 1000) / 1000,
          y = math.floor(coords.y * 1000) / 1000,
          z = math.floor(coords.z * 1000) / 1000,
          overspeed = speed > speedLimit and 1 or 0,
        }

        if #batch >= batchSize then
          insertBatch(batch)
          batch = {}
        end
      end
    end
  end

  insertBatch(batch)
end

local function pushAlert(row)
  if row.overspeed == 1 or row.engine <= engineThreshold then
    TriggerEvent('fdm:telemetry:alert', row)
  end
end

CreateThread(function()
  while true do
    local ok, err = pcall(collect)
    if not ok then
      print(('[%s] collecte telemetrie impossible : %s'):format(GetCurrentResourceName(), tostring(err)))
    end
    Wait(sampleSeconds * 1000)
  end
end)

CreateThread(function()
  while true do
    Wait(6 * 60 * 60 * 1000)
    local ok, err = pcall(function()
      MySQL.query.await(
        ('DELETE FROM %s WHERE captured_at < (NOW() - INTERVAL %d DAY) LIMIT 10000'):format(tableName, retentionDays)
      )
    end)
    if not ok then
      print(('[%s] purge telemetrie impossible : %s'):format(GetCurrentResourceName(), tostring(err)))
    end
  end
end)

RegisterCommand('telemetry', function(source, args)
  if source ~= 0 and not IsPlayerAceAllowed(source, permission) then
    return
  end

  if args[1] == 'purge' then
    MySQL.query.await(
      ('DELETE FROM %s WHERE captured_at < (NOW() - INTERVAL %d DAY)'):format(tableName, retentionDays)
    )
    print(('[telemetry] historique de plus de %d jours supprime.'):format(retentionDays))
    return
  end

  local count = MySQL.scalar.await(('SELECT COUNT(*) FROM %s'):format(tableName)) or 0
  local latest = MySQL.single.await(('SELECT * FROM %s ORDER BY captured_at DESC LIMIT 1'):format(tableName))
  print(('[telemetry] %d echantillon(s) en base.'):format(tonumber(count) or 0))
  if latest then
    pushAlert(latest)
    print(('[telemetry] dernier releve : %s %s km/h moteur %s%%'):format(
      tostring(latest.plate),
      tostring(latest.speed_kmh),
      tostring(latest.engine_health)
    ))
  end
end, false)
`;

      const readme = `# ${resource}

Ressource de telemetrie de flotte generee par FiveM DevManager.

## Installation

1. Importez le fichier \`schema.sql\` dans la base du serveur.
2. Placez la ressource apres \`oxmysql\`.
3. Ajoutez \`ensure ${resource}\` dans \`server.cfg\`.
4. Attribuez la permission ACE \`${permission}\` aux personnes autorisees.

## Fonctionnement

- Un echantillon est collecte toutes les \`${sampleSeconds}\` secondes.
- Les donnees sont inserees par lots de \`${batchSize}\`.
- Les echantillons de plus de \`${retentionDays}\` jours sont purges automatiquement.
- Le seuil de survitesse est fixe a \`${speedLimit}\` km/h.
- Le seuil moteur critique est fixe a \`${engineThreshold}\` %.
- L'evenement \`fdm:telemetry:alert\` est emis pour les survitesses et les moteurs critiques.

## Commandes

- \`/telemetry\` : affiche le nombre d'echantillons et le dernier releve.
- \`/telemetry purge\` : supprime les donnees au-dela de la retention.

## Limites

- La collecte depend de la disponibilite des natives serveur de sante vehicule.
- Les identifiants de conducteur utilisent la licence FiveM ; adaptez la requete si vous utilisez un framework.
- Ne stockez jamais de secret dans cette ressource.
`;

      return {
        data,
        sql: schema,
        files: [
          file("fxmanifest.lua", fxmanifest, "lua"),
          file("server/telemetry.lua", server, "lua"),
        ],
        readme,
        stats: [
          stat("Intervalle", `${sampleSeconds} s`),
          stat("Retention", `${retentionDays} j`),
          stat("Survitesse", `${speedLimit} km/h`),
        ],
        diagnostics: sampleSeconds > 60 ? [{ level: "warning", message: "Un intervalle superieur a 60 secondes peut masquer des incidents courts." }] : [],
      };
    },
  }),
  moduleTool({
    slug: "vehicle-handling-diff",
    name: "Comparateur de handling",
    category: "vehicules",
    description:
      "Compare deux handling.meta, calcule les ecarts numeriques et produit un rapport ainsi qu'un fichier fusionne.",
    icon: "GitCompare",
    tags: ["handling", "diff", "comparaison", "xml"],
    fields: [
      { name: "model", label: "Modele cible", type: "text", default: "sultan", required: true },
      { name: "xmlA", label: "Handling A (reference)", type: "textarea", rows: 12, default: DEFAULT_HANDLING_XML, required: true },
      { name: "xmlB", label: "Handling B (comparaison)", type: "textarea", rows: 12, default: DEFAULT_COMPARISON_XML, required: true },
      { name: "keepB", label: "Conserver les valeurs B dans la fusion", type: "switch", default: true },
    ],
    build: (input) => {
      const model = safeSlug(str(input, "model", "sultan"), "sultan");
      const keepB = input.keepB === undefined ? true : input.keepB === true || input.keepB === "true";
      const parsedA = parseHandlingXml(str(input, "xmlA", DEFAULT_HANDLING_XML));
      const parsedB = parseHandlingXml(str(input, "xmlB", DEFAULT_COMPARISON_XML));
      const differences: Array<{ field: string; label: string; a: number; b: number; delta: number; percent: number }> = [];

      for (const [key, label] of handlingLabels) {
        const a = parsedA.data[key];
        const b = parsedB.data[key];
        if (typeof a !== "number" || typeof b !== "number") continue;
        const delta = b - a;
        if (Math.abs(delta) > 0.000001) {
          differences.push({
            field: key,
            label,
            a,
            b,
            delta,
            percent: a === 0 ? 0 : (delta / Math.abs(a)) * 100,
          });
        }
      }

      if (parsedA.data.flags !== parsedB.data.flags) {
        differences.push({
          field: "flags",
          label: "Flags",
          a: Number.NaN,
          b: Number.NaN,
          delta: Number.NaN,
          percent: Number.NaN,
        });
      }

      const ratiosA = parsedA.data.gearRatios.join(", ");
      const ratiosB = parsedB.data.gearRatios.join(", ");
      if (ratiosA !== ratiosB) {
        differences.push({
          field: "gearRatios",
          label: "Rapports de boite",
          a: Number.NaN,
          b: Number.NaN,
          delta: Number.NaN,
          percent: Number.NaN,
        });
      }

      const diagnostics: StudioDiagnostic[] = [
        ...analyzeHandling(parsedA.data, parsedA.found),
        ...analyzeHandling(parsedB.data, parsedB.found),
      ];
      if (!parsedA.found) diagnostics.push({ level: "error", message: "Le handling A ne contient pas de bloc CHandlingData.", field: "xmlA" });
      if (!parsedB.found) diagnostics.push({ level: "error", message: "Le handling B ne contient pas de bloc CHandlingData.", field: "xmlB" });
      if (differences.length === 0) diagnostics.push({ level: "info", message: "Les deux handlings sont identiques sur les champs suivis." });

      const target = keepB ? parsedB.data : parsedA.data;
      const merged = generateHandlingXml({ ...target, handlingName: model });
      const reportRows = differences.map((entry) => {
        if (Number.isNaN(entry.a)) {
          return [entry.label, entry.field === "flags" ? parsedA.data.flags : ratiosA, entry.field === "flags" ? parsedB.data.flags : ratiosB, "-", "-"];
        }
        return [
          entry.label,
          formatNumber(entry.a, 3),
          formatNumber(entry.b, 3),
          `${entry.delta > 0 ? "+" : ""}${formatNumber(entry.delta, 3)}`,
          `${entry.percent > 0 ? "+" : ""}${formatNumber(entry.percent, 1)} %`,
        ];
      });
      const report = `# Comparaison handling - ${model}

Reference : **A** · Comparaison : **B** · Fusion : **${keepB ? "B" : "A"}**

${mdTable(["Champ", "A", "B", "Ecart", "Variation"], reportRows.length > 0 ? reportRows : [["Aucun ecart", "-", "-", "-", "-"]])}

## Diagnostics

${diagnostics.map((diagnostic) => `- **${diagnostic.level}** : ${diagnostic.message}`).join("\n") || "- Aucun"}

> Les valeurs estimees doivent etre validees en jeu. La fusion conserve les champs non compares de la source choisie.
`;
      return {
        data: {
          model,
          keepB,
          differentFields: differences.length,
          differences,
          sourceA: parsedA.data.handlingName,
          sourceB: parsedB.data.handlingName,
          identical: differences.length === 0,
        },
        files: [
          file("handling-diff.md", report, "markdown"),
          file("handling-diff.json", JSON.stringify({ model, keepB, differences }, null, 2), "json"),
          file("handling-merged.meta", merged, "xml"),
        ],
        readme: `# Comparateur de handling

Comparez deux extraits de \`handling.meta\` et inspectez les variations de masse, traction,
freinage, suspension, boite et flags.

- \`handling-diff.md\` : rapport lisible.
- \`handling-diff.json\` : donnees structurees pour vos outils.
- \`handling-merged.meta\` : fichier fusionne, a valider en jeu.

La fusion ne remplace pas un test de conduite. Verifiez les identifiants de handling et
les references de modele avant de publier le fichier.
`,
        stats: [
          stat("Champs differents", String(differences.length), differences.length > 0 ? "warning" : "success"),
          stat("Source fusion", keepB ? "B" : "A"),
        ],
      };
    },
  }),
  moduleTool({
    slug: "vehicle-meta-audit",
    name: "Audit vehicles.meta",
    category: "vehicules",
    description:
      "Croise vehicles.meta et handling.meta : modele, handlingId, textures, places, portes et coherence des blocs.",
    icon: "ListChecks",
    tags: ["vehicles.meta", "handling", "audit", "qualite"],
    fields: [
      { name: "model", label: "Modele attendu", type: "text", default: "sultan2", required: true },
      { name: "vehiclesXml", label: "vehicles.meta", type: "textarea", rows: 12, default: DEFAULT_VEHICLES_META, required: true },
      { name: "handlingXml", label: "handling.meta", type: "textarea", rows: 12, default: DEFAULT_META_HANDLING_XML, required: true },
      { name: "strict", label: "Mode strict", type: "switch", default: true },
    ],
    build: (input) => {
      const expected = safeSlug(str(input, "model", "sultan2"), "sultan2");
      const strict = input.strict === undefined ? true : input.strict === true || input.strict === "true";
      const meta = parseVehicleMeta(str(input, "vehiclesXml", DEFAULT_VEHICLES_META));
      const handling = parseHandlingXml(str(input, "handlingXml", DEFAULT_META_HANDLING_XML));
      const diagnostics: StudioDiagnostic[] = [];

      if (!meta.found) diagnostics.push({ level: "error", message: "Aucun bloc CVehicleModelInfo__InitData detecte.", field: "vehiclesXml" });
      if (!handling.found) diagnostics.push({ level: "error", message: "Aucun bloc CHandlingData detecte.", field: "handlingXml" });
      if (meta.model && meta.model.toLowerCase() !== expected) {
        diagnostics.push({ level: strict ? "error" : "warning", message: `Le modelName ${meta.model} ne correspond pas a ${expected}.`, field: "vehiclesXml" });
      }
      if (meta.handlingId && handling.data.handlingName && meta.handlingId.toLowerCase() !== handling.data.handlingName.toLowerCase()) {
        diagnostics.push({
          level: "error",
          message: `handlingId ${meta.handlingId} different du handlingName ${handling.data.handlingName}.`,
          field: "handlingXml",
        });
      }
      if (!meta.txdName) diagnostics.push({ level: "warning", message: "txdName est vide : les textures risquent de manquer.", field: "vehiclesXml" });
      if (meta.seats < 1 || meta.seats > 8) diagnostics.push({ level: "warning", message: "Le nombre de places est hors plage (1-8).", field: "vehiclesXml" });
      if (meta.doors < 1 || meta.doors > 6) diagnostics.push({ level: "warning", message: "Le nombre de portes est hors plage (1-6).", field: "vehiclesXml" });

      const checks = [
        ["Bloc vehicles.meta", meta.found],
        ["Bloc handling.meta", handling.found],
        ["Modele attendu", !meta.model || meta.model.toLowerCase() === expected],
        ["handlingId coherent", !meta.handlingId || !handling.data.handlingName || meta.handlingId.toLowerCase() === handling.data.handlingName.toLowerCase()],
        ["Texture renseignee", Boolean(meta.txdName)],
        ["Places valides", meta.seats >= 1 && meta.seats <= 8],
        ["Portes valides", meta.doors >= 1 && meta.doors <= 6],
      ] as const;
      const passed = checks.filter(([, ok]) => ok).length;
      const score = Math.round((passed / checks.length) * 100);
      const normalizedMeta = generateVehiclesMeta({
        model: meta.model || expected,
        handlingId: meta.handlingId || handling.data.handlingName || expected,
        make: meta.make || "Declasse",
        vehicleClass: meta.vehicleClass || "VC_SPORT",
        vehicleType: meta.vehicleType || "VEHICLE_TYPE_CAR",
        seats: Math.max(1, Math.min(8, meta.seats || 2)),
        doors: Math.max(1, Math.min(6, meta.doors || 2)),
        txdName: meta.txdName || expected,
        flags: meta.flags || "FLAG_HAS_LIVERY",
      });
      const report = `# Audit vehicles.meta - ${expected}

Score : **${score}/100**

${mdTable(["Controle", "Etat"], checks.map(([label, ok]) => [label, ok ? "OK" : "A corriger"]))}

## Valeurs lues

| Champ | vehicles.meta | handling.meta |
| --- | --- | --- |
| Identifiant | ${meta.model || "-"} | ${handling.data.handlingName || "-"} |
| handlingId | ${meta.handlingId || "-"} | ${handling.data.handlingName || "-"} |
| Texture | ${meta.txdName || "-"} | - |
| Places | ${meta.seats || "-"} | - |
| Portes | ${meta.doors || "-"} | - |
| Masse | - | ${handling.data.mass} |
| Vitesses | - | ${handling.data.gears} |

## Diagnostics

${diagnostics.map((diagnostic) => `- **${diagnostic.level}** : ${diagnostic.message}`).join("\n") || "- Aucun"}

> Les fichiers normalises sont fournis comme base de correction. Fusionnez-les dans vos fichiers existants.
`;
      return {
        data: {
          expected,
          meta,
          handlingName: handling.data.handlingName,
          checks: checks.map(([label, ok]) => ({ label, ok })),
          score,
        },
        files: [
          file("vehicles.meta", normalizedMeta, "xml"),
          file("handling.meta", generateHandlingXml({ ...handling.data, handlingName: meta.handlingId || expected }), "xml"),
          file("audit-vehicles.md", report, "markdown"),
          file("audit-vehicles.json", JSON.stringify({ expected, meta, handlingName: handling.data.handlingName, score, checks }, null, 2), "json"),
        ],
        readme: `# Audit vehicles.meta

Ce module verifie la coherence entre \`vehicles.meta\` et \`handling.meta\` :

- presence des blocs attendus ;
- correspondance entre \`modelName\` et le modele cible ;
- correspondance entre \`handlingId\` et \`handlingName\` ;
- presence de la texture, des places et des portes ;
- generation de fichiers normalises pour correction.

Le score est indicatif. Un vehicule peut demarrer avec un score bas mais rester instable en jeu.
`,
        stats: [
          stat("Score", `${score}/100`, score >= 85 ? "success" : score >= 60 ? "warning" : "danger"),
          stat("Controles", `${passed}/${checks.length}`),
        ],
        diagnostics,
      };
    },
  }),
];
