import {
  bool,
  clamp,
  escapeXml,
  file,
  formatNumber,
  luaString,
  num,
  result,
  safeSlug,
  stat,
  str,
} from "./helpers";
import type { StudioDiagnostic, StudioFile, StudioInput, StudioResult, StudioStat } from "./types";

export interface HandlingData {
  handlingName: string;
  mass: number;
  initialDragCoeff: number;
  driveInertia: number;
  driveForce: number;
  brakeForce: number;
  gears: number;
  maxFlatVel: number;
  tractionCurveMax: number;
  tractionCurveMin: number;
  suspensionForce: number;
  suspensionDamping: number;
  suspensionCompression: number;
  suspensionRaise: number;
  suspensionBiasFront: number;
  antiRollBarForce: number;
  rollCentreFront: number;
  rollCentreRear: number;
  steeringLock: number;
  flags: string;
  gearRatios: number[];
}

export interface VehicleMetaInput {
  model: string;
  handlingId: string;
  make: string;
  vehicleClass: string;
  vehicleType: string;
  seats: number;
  doors: number;
  txdName: string;
  flags: string;
}

export interface VehicleParseResult {
  data: HandlingData;
  found: boolean;
}

export const DEFAULT_HANDLING: HandlingData = {
  handlingName: "sultan",
  mass: 1400,
  initialDragCoeff: 8.5,
  driveInertia: 1,
  driveForce: 0.28,
  brakeForce: 1.2,
  gears: 6,
  maxFlatVel: 60,
  tractionCurveMax: 1.2,
  tractionCurveMin: 0.8,
  suspensionForce: 1.8,
  suspensionDamping: 2.4,
  suspensionCompression: 4.4,
  suspensionRaise: 0,
  suspensionBiasFront: 0.5,
  antiRollBarForce: 1.2,
  rollCentreFront: 0,
  rollCentreRear: 0,
  steeringLock: 35,
  flags: "1F000000",
  gearRatios: [3.5, 2.4, 1.7, 1.3, 1.0, 0.8],
};

export const VEHICLE_PRESETS: Record<string, Partial<HandlingData>> = {
  sport: {
    mass: 1500,
    initialDragCoeff: 8,
    driveInertia: 1,
    driveForce: 0.32,
    brakeForce: 1.4,
    gears: 6,
    maxFlatVel: 65,
    tractionCurveMax: 1.3,
    suspensionForce: 1.9,
    suspensionDamping: 2.3,
    suspensionCompression: 4.2,
    suspensionBiasFront: 0.5,
    antiRollBarForce: 1.4,
    steeringLock: 36,
    gearRatios: [3.4, 2.3, 1.7, 1.3, 1.05, 0.85],
  },
  drift: {
    mass: 1400,
    initialDragCoeff: 7.2,
    driveInertia: 1.35,
    driveForce: 0.29,
    brakeForce: 1.05,
    gears: 5,
    maxFlatVel: 58,
    tractionCurveMax: 0.95,
    suspensionForce: 1.7,
    suspensionDamping: 2.0,
    suspensionCompression: 4.8,
    suspensionBiasFront: 0.48,
    antiRollBarForce: 1.15,
    steeringLock: 42,
    gearRatios: [3.3, 2.2, 1.6, 1.2, 0.9],
  },
  offroad: {
    mass: 2200,
    initialDragCoeff: 10.5,
    driveInertia: 1.15,
    driveForce: 0.3,
    brakeForce: 1.6,
    gears: 6,
    maxFlatVel: 45,
    tractionCurveMax: 1.45,
    suspensionForce: 1.35,
    suspensionDamping: 2.7,
    suspensionCompression: 5.2,
    suspensionRaise: 0.12,
    suspensionBiasFront: 0.5,
    antiRollBarForce: 1.6,
    steeringLock: 38,
    gearRatios: [3.8, 2.6, 1.9, 1.4, 1.1, 0.9],
  },
  supercar: {
    mass: 1300,
    initialDragCoeff: 6.2,
    driveInertia: 0.9,
    driveForce: 0.42,
    brakeForce: 1.85,
    gears: 7,
    maxFlatVel: 82,
    tractionCurveMax: 1.4,
    suspensionForce: 2.2,
    suspensionDamping: 2.1,
    suspensionCompression: 3.8,
    suspensionRaise: -0.04,
    suspensionBiasFront: 0.47,
    antiRollBarForce: 1.8,
    steeringLock: 34,
    gearRatios: [3.6, 2.4, 1.8, 1.45, 1.15, 0.95, 0.8],
  },
  moto: {
    mass: 250,
    initialDragCoeff: 4.8,
    driveInertia: 0.8,
    driveForce: 0.35,
    brakeForce: 1.25,
    gears: 6,
    maxFlatVel: 72,
    tractionCurveMax: 1.1,
    suspensionForce: 1.2,
    suspensionDamping: 1.8,
    suspensionCompression: 3.4,
    suspensionRaise: 0,
    suspensionBiasFront: 0.5,
    antiRollBarForce: 0.7,
    steeringLock: 40,
    gearRatios: [3.2, 2.2, 1.65, 1.3, 1.05, 0.85],
  },
};

export const VEHICLE_PRESET_OPTIONS = [
  { value: "custom", label: "Custom (conserver les valeurs)" },
  { value: "sport", label: "Sport / route" },
  { value: "drift", label: "Drift" },
  { value: "offroad", label: "Offroad / 4x4" },
  { value: "supercar", label: "Supercar" },
  { value: "moto", label: "Moto" },
];

function xmlTag(body: string, tag: string): string {
  const match = body.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1]?.trim() ?? "";
}

function numericTag(body: string, tag: string, fallback: number): number {
  const match = body.match(new RegExp(`<${tag}\\s+value=["']([^"']+)["']`, "i"));
  const value = Number(match?.[1]);
  return Number.isFinite(value) ? value : fallback;
}

/** Analyse un extrait de handling.meta (XML) sans dependance externe. */
export function parseHandlingXml(xml: string): VehicleParseResult {
  const source = xml.trim();
  if (!source) return { data: { ...DEFAULT_HANDLING }, found: false };
  const item = source.match(/<Item[^>]*type=["']CHandlingData["'][^>]*>([\s\S]*?)<\/Item>/i);
  const body = item?.[1] ?? source;
  const found = /CHandlingData|handlingName|fMass/i.test(body);
  const ratioBlock = body.match(/<gearRatios>([\s\S]*?)<\/gearRatios>/i)?.[1] ?? "";
  const gearRatios = [...ratioBlock.matchAll(/<Item\s+value=["']([^"']+)["']/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));
  const data: HandlingData = {
    handlingName: xmlTag(body, "handlingName") || DEFAULT_HANDLING.handlingName,
    mass: numericTag(body, "fMass", DEFAULT_HANDLING.mass),
    initialDragCoeff: numericTag(body, "fInitialDragCoeff", DEFAULT_HANDLING.initialDragCoeff),
    driveInertia: numericTag(body, "fDriveInertia", DEFAULT_HANDLING.driveInertia),
    driveForce: numericTag(body, "fInitialDriveForce", DEFAULT_HANDLING.driveForce),
    brakeForce: numericTag(body, "fBrakeForce", DEFAULT_HANDLING.brakeForce),
    gears: numericTag(body, "nInitialDriveGears", DEFAULT_HANDLING.gears),
    maxFlatVel: numericTag(body, "fInitialDriveMaxFlatVel", DEFAULT_HANDLING.maxFlatVel),
    tractionCurveMax: numericTag(body, "fTractionCurveMax", DEFAULT_HANDLING.tractionCurveMax),
    tractionCurveMin: numericTag(body, "fTractionCurveMin", DEFAULT_HANDLING.tractionCurveMin),
    suspensionForce: numericTag(body, "fSuspensionForce", DEFAULT_HANDLING.suspensionForce),
    suspensionDamping: numericTag(body, "fSuspensionCompDamp", DEFAULT_HANDLING.suspensionDamping),
    suspensionCompression: numericTag(body, "fSuspensionReboundDamp", DEFAULT_HANDLING.suspensionCompression),
    suspensionRaise: numericTag(body, "fSuspensionRaise", DEFAULT_HANDLING.suspensionRaise),
    suspensionBiasFront: numericTag(body, "fSuspensionBiasFront", DEFAULT_HANDLING.suspensionBiasFront),
    antiRollBarForce: numericTag(body, "fAntiRollBarForce", DEFAULT_HANDLING.antiRollBarForce),
    rollCentreFront: numericTag(body, "fRollCentreHeightFront", DEFAULT_HANDLING.rollCentreFront),
    rollCentreRear: numericTag(body, "fRollCentreHeightRear", DEFAULT_HANDLING.rollCentreRear),
    steeringLock: numericTag(body, "fSteeringLock", DEFAULT_HANDLING.steeringLock),
    flags: xmlTag(body, "strHandlingFlags") || DEFAULT_HANDLING.flags,
    gearRatios: gearRatios.length > 0 ? gearRatios : [...DEFAULT_HANDLING.gearRatios],
  };
  return { data, found };
}

export function applyVehiclePreset(data: HandlingData, preset: string): HandlingData {
  const values = VEHICLE_PRESETS[preset];
  if (!values) return { ...data, gearRatios: [...data.gearRatios] };
  return {
    ...data,
    ...values,
    handlingName: data.handlingName,
    gearRatios: values.gearRatios ? [...values.gearRatios] : [...data.gearRatios],
  };
}

function float(value: number, digits = 3): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "0.000";
}

export function generateHandlingXml(data: HandlingData): string {
  const ratios = data.gearRatios.map((ratio) => `        <Item value="${float(ratio, 4)}" />`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<CHandlingDataMgr>
  <HandlingData>
    <Item type="CHandlingData">
      <handlingName>${escapeXml(data.handlingName)}</handlingName>
      <fMass value="${float(data.mass, 2)}" />
      <fInitialDragCoeff value="${float(data.initialDragCoeff, 3)}" />
      <fDriveInertia value="${float(data.driveInertia, 3)}" />
      <fInitialDriveForce value="${float(data.driveForce, 3)}" />
      <fBrakeForce value="${float(data.brakeForce, 3)}" />
      <nInitialDriveGears value="${Math.max(1, Math.round(data.gears))}" />
      <fInitialDriveMaxFlatVel value="${float(data.maxFlatVel, 2)}" />
      <fTractionCurveMax value="${float(data.tractionCurveMax, 3)}" />
      <fTractionCurveMin value="${float(data.tractionCurveMin, 3)}" />
      <fSuspensionForce value="${float(data.suspensionForce, 3)}" />
      <fSuspensionCompDamp value="${float(data.suspensionDamping, 3)}" />
      <fSuspensionReboundDamp value="${float(data.suspensionCompression, 3)}" />
      <fSuspensionRaise value="${float(data.suspensionRaise, 3)}" />
      <fSuspensionBiasFront value="${float(data.suspensionBiasFront, 3)}" />
      <fAntiRollBarForce value="${float(data.antiRollBarForce, 3)}" />
      <fRollCentreHeightFront value="${float(data.rollCentreFront, 3)}" />
      <fRollCentreHeightRear value="${float(data.rollCentreRear, 3)}" />
      <fSteeringLock value="${float(data.steeringLock, 2)}" />
      <strHandlingFlags>${escapeXml(data.flags)}</strHandlingFlags>
      <gearRatios>
${ratios}
      </gearRatios>
    </Item>
  </HandlingData>
</CHandlingDataMgr>
`;
}

export function generateVehiclesMeta(input: VehicleMetaInput): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<CVehicleModelInfo__InitDataList>
  <reservedParents>
    <Item>ADDER</Item>
    <Item>SULTAN</Item>
  </reservedParents>
  <InitDatas>
    <Item type="CVehicleModelInfo__InitData">
      <modelName>${escapeXml(input.model)}</modelName>
      <txdName>${escapeXml(input.txdName)}</txdName>
      <handlingId>${escapeXml(input.handlingId)}</handlingId>
      <makeName>${escapeXml(input.make)}</makeName>
      <vehicleClass>${escapeXml(input.vehicleClass)}</vehicleClass>
      <vehicleType>${escapeXml(input.vehicleType)}</vehicleType>
      <maxNumberOfPassengers value="${Math.max(1, Math.round(input.seats))}" />
      <numberOfDoors value="${Math.max(1, Math.round(input.doors))}" />
      <flags>${escapeXml(input.flags)}</flags>
    </Item>
  </InitDatas>
  <txdRelationships>
    <Item>
      <parent>${escapeXml(input.txdName)}</parent>
      <child>${escapeXml(input.txdName)}</child>
    </Item>
  </txdRelationships>
</CVehicleModelInfo__InitDataList>
`;
}

export function generateSpawnLua(input: {
  model: string;
  command: string;
  plate: string;
  permission: string;
}): string {
  const command = safeSlug(input.command, "veh").replace(/_/g, "");
  const model = safeSlug(input.model, "sultan");
  return `-- Commandes de debug vehicule generees par FiveM DevManager
local modelName = ${luaString(model)}
local modelHash = GetHashKey(modelName)
local plate = ${luaString(input.plate || "DEV 001")}
local acePermission = ${luaString(input.permission || "")}

local function canUseCommand()
  if acePermission == "" then return true end
  return IsPlayerAceAllowed(PlayerId(), acePermission)
end

local function spawnVehicle()
  if not canUseCommand() then
    print("[vehicule] permission manquante: " .. acePermission)
    return
  end
  local ped = PlayerPedId()
  local coords = GetEntityCoords(ped)
  local heading = GetEntityHeading(ped)
  RequestModel(modelHash)
  local attempts = 0
  while not HasModelLoaded(modelHash) and attempts < 100 do
    Wait(10)
    attempts = attempts + 1
  end
  if not HasModelLoaded(modelHash) then
    print("[vehicule] modele introuvable: " .. modelName)
    return
  end
  local vehicle = CreateVehicle(modelHash, coords.x + 2.0, coords.y + 0.5, coords.z, heading, true, false)
  SetVehicleNumberPlateText(vehicle, plate)
  SetPedIntoVehicle(ped, vehicle, -1)
  SetModelAsNoLongerNeeded(modelHash)
  TriggerEvent("vehicleDebug:spawned", vehicle, modelName)
end

RegisterCommand(${luaString(command)}, spawnVehicle, false)
TriggerEvent("chat:addSuggestion", ${luaString("/" + command)}, "Spawn du vehicule " .. modelName)
`;
}

export function analyzeHandling(data: HandlingData, found = true): StudioDiagnostic[] {
  const diagnostics: StudioDiagnostic[] = [];
  if (!found) {
    diagnostics.push({
      level: "error",
      message: "Aucun bloc CHandlingData detecte. Collez un extrait de handling.meta valide.",
      field: "xml",
    });
  }
  if (!data.handlingName.trim()) {
    diagnostics.push({ level: "error", message: "Le handlingName est vide.", field: "handlingName" });
  }
  if (data.mass <= 0) {
    diagnostics.push({ level: "error", message: "La masse doit etre superieure a 0.", field: "mass" });
  } else if (data.mass < 500) {
    diagnostics.push({ level: "warning", message: "Masse tres faible : le vehicule risque de s'envoler.", field: "mass" });
  } else if (data.mass > 4500) {
    diagnostics.push({ level: "warning", message: "Masse tres elevee : acceleration et freinage seront penalises.", field: "mass" });
  }
  if (data.driveForce <= 0) {
    diagnostics.push({ level: "error", message: "La force motrice (fInitialDriveForce) est nulle.", field: "driveForce" });
  } else if (data.driveForce > 0.65) {
    diagnostics.push({ level: "warning", message: "Force motrice tres elevee : risque de wheelspin permanent.", field: "driveForce" });
  }
  if (data.brakeForce <= 0) {
    diagnostics.push({ level: "error", message: "La force de freinage (fBrakeForce) est nulle.", field: "brakeForce" });
  }
  if (data.gears < 1 || data.gears > 8) {
    diagnostics.push({ level: "error", message: "Le nombre de vitesses doit etre compris entre 1 et 8.", field: "gears" });
  }
  if (data.gearRatios.length !== Math.round(data.gears)) {
    diagnostics.push({
      level: "warning",
      message: `${data.gearRatios.length} rapport(s) fourni(s) pour ${Math.round(data.gears)} vitesse(s).`,
      field: "gears",
    });
  }
  if (data.maxFlatVel < 10 || data.maxFlatVel > 130) {
    diagnostics.push({ level: "warning", message: "Vitesse maximale theorique hors plage realiste (10-130 m/s).", field: "maxFlatVel" });
  }
  if (data.initialDragCoeff < 1 || data.initialDragCoeff > 40) {
    diagnostics.push({ level: "warning", message: "Coefficient de trainee hors plage (1-40).", field: "initialDragCoeff" });
  }
  if (data.driveInertia < 0.2 || data.driveInertia > 5) {
    diagnostics.push({ level: "warning", message: "Inertie moteur hors plage (0.2-5).", field: "driveInertia" });
  }
  if (data.tractionCurveMax < 0.5 || data.tractionCurveMax > 2.5) {
    diagnostics.push({ level: "warning", message: "Traction laterale hors plage (0.5-2.5).", field: "tractionCurveMax" });
  }
  if (data.suspensionForce <= 0 || data.suspensionForce > 5) {
    diagnostics.push({ level: "warning", message: "Force de suspension hors plage (0-5).", field: "suspensionForce" });
  }
  if (data.steeringLock < 15 || data.steeringLock > 60) {
    diagnostics.push({ level: "warning", message: "Angle de braquage hors plage (15-60 degres).", field: "steeringLock" });
  }
  if (!/^[0-9A-Fa-f]+$/.test(data.flags.trim())) {
    diagnostics.push({ level: "info", message: "Les flags de handling ne sont pas hexadecimaux ; verifiez leur syntaxe.", field: "flags" });
  }
  return diagnostics;
}

export function vehicleStats(data: HandlingData): StudioStat[] {
  const topSpeed = data.maxFlatVel * 3.6;
  const powerToWeight = (data.driveForce * 1000) / Math.max(1, data.mass);
  const acceleration = data.driveForce / Math.max(0.1, data.driveInertia);
  const braking = data.brakeForce * 100;
  return [
    stat("Vitesse max estimee", `${formatNumber(topSpeed, 0)} km/h`, topSpeed > 240 ? "warning" : "info"),
    stat("Rapport poids/puissance", `${formatNumber(powerToWeight, 2)}`, powerToWeight > 0.25 ? "warning" : "success"),
    stat("Acceleration", `${formatNumber(acceleration, 2)}`, acceleration > 0.4 ? "warning" : "success"),
    stat("Freinage", `${formatNumber(braking, 0)}`, braking < 100 ? "danger" : braking > 170 ? "success" : "default"),
    stat("Vitesses", `${Math.round(data.gears)}`, data.gears >= 5 ? "success" : "warning"),
  ];
}

export function scoreHandling(data: HandlingData, diagnostics: StudioDiagnostic[]): number {
  const penalties = diagnostics.reduce(
    (total, diagnostic) => total + (diagnostic.level === "error" ? 20 : diagnostic.level === "warning" ? 5 : 0),
    0,
  );
  const performance =
    clamp(data.driveForce / 0.5, 0, 1) * 18 +
    clamp(data.brakeForce / 2, 0, 1) * 12 +
    clamp(data.maxFlatVel / 100, 0, 1) * 10;
  return Math.round(clamp(60 + performance - penalties, 0, 100));
}

export function vehicleReport(
  data: HandlingData,
  diagnostics: StudioDiagnostic[],
  stats: StudioStat[],
  score: number,
): string {
  return `# Rapport vehicule - ${data.handlingName}

Score de qualite : **${score}/100**

## Statistiques estimees

| Indicateur | Valeur |
| --- | --- |
${stats.map((item) => `| ${item.label} | ${item.value} |`).join("\n")}

## Diagnostics

| Niveau | Message |
| --- | --- |
${diagnostics.map((item) => `| ${item.level} | ${item.message} |`).join("\n")}

## Valeurs techniques

| Champ | Valeur |
| --- | --- |
| Masse | ${data.mass} |
| Force motrice | ${data.driveForce} |
| Freinage | ${data.brakeForce} |
| Vitesses | ${data.gears} |
| Vitesse max (m/s) | ${data.maxFlatVel} |
| Trainee | ${data.initialDragCoeff} |
| Inertie | ${data.driveInertia} |
| Traction | ${data.tractionCurveMax} |
| Suspension | ${data.suspensionForce} |
| Flags | ${data.flags} |

> Les estimations sont indicatives : testez toujours en jeu et comparez avec un vehicule de reference.
`;
}

export function debugVehicle(input: StudioInput): StudioResult {
  const xml = str(input, "xml", DEFAULT_HANDLING_XML);
  const preset = str(input, "preset", "custom");
  const applyPreset = bool(input, "applyPreset", false);
  const model = safeSlug(str(input, "model", "sultan"), "sultan");
  const parsed = parseHandlingXml(xml);
  const data = applyPreset ? applyVehiclePreset(parsed.data, preset) : parsed.data;
  data.handlingName = model;
  const diagnostics = analyzeHandling(data, parsed.found);
  if (applyPreset && preset !== "custom") {
    diagnostics.push({
      level: "info",
      message: `Preset « ${preset} » applique aux valeurs du vehicule.`,
    });
  }
  const score = scoreHandling(data, diagnostics);
  const stats = vehicleStats(data);
  const files: StudioFile[] = [
    file("handling.meta", generateHandlingXml(data), "xml"),
    file(
      "vehicles.meta",
      generateVehiclesMeta({
        model,
        handlingId: model,
        make: str(input, "make", "Declasse"),
        vehicleClass: str(input, "vehicleClass", "VC_SPORT"),
        vehicleType: str(input, "vehicleType", "VEHICLE_TYPE_CAR"),
        seats: num(input, "seats", 2),
        doors: num(input, "doors", 2),
        txdName: model,
        flags: str(input, "metaFlags", "FLAG_HAS_LIVERY"),
      }),
      "xml",
    ),
    file(
      "spawn.lua",
      generateSpawnLua({
        model,
        command: str(input, "command", "veh"),
        plate: str(input, "plate", "DEV 001"),
        permission: str(input, "permission", ""),
      }),
      "lua",
    ),
    file("rapport-vehicule.md", vehicleReport(data, diagnostics, stats, score), "markdown"),
  ];
  return result(
    `Analyse de ${model} : score ${score}/100 · ${diagnostics.filter((item) => item.level === "error").length} erreur(s), ${diagnostics.filter((item) => item.level === "warning").length} avertissement(s).`,
    files,
    {
      diagnostics,
      stats: [stat("Score global", `${score}/100`, score >= 80 ? "success" : score >= 50 ? "warning" : "danger"), ...stats],
      warnings: [
        "Les fichiers generes sont des bases de travail : validez-les en jeu et dans CodeWalker avant publication.",
        "Le handling.meta doit etre fusionne dans le fichier existant de votre ressource vehicule.",
      ],
      meta: { score, model, preset },
    },
  );
}

export const DEFAULT_HANDLING_XML = generateHandlingXml(DEFAULT_HANDLING);
