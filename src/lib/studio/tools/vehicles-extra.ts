import {
  bool,
  formatNumber,
  luaString,
  num,
  safeSlug,
  stat,
  str,
} from "../helpers";
import { coordParts, list, moduleTool, rows } from "./modules-shared";
import type { StudioTool } from "../types";

export const vehicleExtraTools: StudioTool[] = [
  moduleTool({
    slug: "vehicle-audio",
    name: "Preset audio vehicule",
    category: "vehicules",
    description: "Configure le nom audio, le klaxon et la sirene d'un vehicule.",
    icon: "Car",
    tags: ["audio", "vehicule", "sirene"],
    fields: [
      { name: "model", label: "Modele", type: "text", default: "sultan", required: true },
      { name: "audioName", label: "Nom audio", type: "text", default: "sultan" },
      { name: "horn", label: "Klaxon", type: "text", default: "car_horn" },
      { name: "siren", label: "Sirene", type: "switch", default: false },
    ],
    build: (input) => {
      const model = safeSlug(str(input, "model", "sultan"));
      const audioName = str(input, "audioName", model);
      const horn = safeSlug(str(input, "horn", "car_horn"), "car_horn");
      const siren = bool(input, "siren");
      return {
        data: { model, audioName, horn, siren },
        lua: `function GetVehicleAudioName(model)\n  if model == ${luaString(model)} then return ${luaString(audioName)} end\n  return nil\nend\n\nfunction HasVehicleSiren(model)\n  return model == ${luaString(model)} and ${siren ? "true" : "false"}\nend\n`,
        stats: [stat("Modele", model), stat("Sirene", siren ? "Oui" : "Non")],
      };
    },
  }),
  moduleTool({
    slug: "vehicle-livery",
    name: "Planificateur de liveries",
    category: "vehicules",
    description: "Prepare les liveries, prix et deblocages d'un vehicule avec sa table SQL.",
    icon: "Car",
    tags: ["livery", "peinture", "vehicule"],
    fields: [
      { name: "model", label: "Modele", type: "text", default: "sultan", required: true },
      { name: "liveries", label: "Nombre de liveries", type: "number", default: 6, min: 1, max: 50 },
      { name: "price", label: "Prix unitaire", type: "number", default: 2500, min: 0 },
      { name: "unlocked", label: "Debloque par defaut", type: "switch", default: false },
    ],
    build: (input) => {
      const model = safeSlug(str(input, "model", "sultan"));
      const liveries = Math.max(1, Math.min(50, num(input, "liveries", 6)));
      const price = Math.max(0, num(input, "price", 2500));
      const unlocked = bool(input, "unlocked");
      return {
        data: { model, liveries, price, unlocked },
        sql: `CREATE TABLE IF NOT EXISTS vehicle_liveries (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  model VARCHAR(64) NOT NULL,\n  livery INT NOT NULL,\n  price INT NOT NULL DEFAULT ${price},\n  unlocked TINYINT(1) NOT NULL DEFAULT ${unlocked ? 1 : 0},\n  UNIQUE KEY uniq_vehicle_livery (model, livery)\n);\n`,
        stats: [stat("Liveries", String(liveries)), stat("Prix", formatNumber(price, 0))],
      };
    },
  }),
  moduleTool({
    slug: "vehicle-insurance",
    name: "Configuration assurance",
    category: "vehicules",
    description: "Definit la prime, la franchise et le delai d'indemnisation d'un vehicule assure.",
    icon: "Car",
    tags: ["assurance", "economie", "vehicule"],
    fields: [
      { name: "premium", label: "Prime mensuelle", type: "number", default: 1200, min: 0 },
      { name: "deductible", label: "Franchise", type: "number", default: 2500, min: 0 },
      { name: "payout", label: "Taux d'indemnisation (%)", type: "number", default: 80, min: 0, max: 100 },
      { name: "waitDays", label: "Delai (jours)", type: "number", default: 3, min: 0, max: 30 },
    ],
    build: (input) => {
      const premium = num(input, "premium", 1200);
      const deductible = num(input, "deductible", 2500);
      const payout = Math.min(100, Math.max(0, num(input, "payout", 80)));
      const waitDays = num(input, "waitDays", 3);
      return {
        data: { premium, deductible, payoutPercent: payout, waitDays },
        sql: `CREATE TABLE IF NOT EXISTS vehicle_insurance (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  plate VARCHAR(16) NOT NULL,\n  owner VARCHAR(120) NOT NULL,\n  premium INT NOT NULL DEFAULT ${premium},\n  deductible INT NOT NULL DEFAULT ${deductible},\n  payout_percent INT NOT NULL DEFAULT ${payout},\n  active TINYINT(1) NOT NULL DEFAULT 1,\n  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n  UNIQUE KEY uniq_insured_plate (plate)\n);\n`,
        lua: `function ComputeInsurancePayout(vehicleValue)\n  local config = Config.VehicleInsurance\n  local afterDeductible = math.max(0, vehicleValue - config.deductible)\n  return math.floor(afterDeductible * (config.payoutPercent / 100))\nend\n`,
        stats: [stat("Prime", formatNumber(premium, 0)), stat("Franchise", formatNumber(deductible, 0))],
      };
    },
  }),
  moduleTool({
    slug: "vehicle-impound",
    name: "Configuration fourriere",
    category: "vehicules",
    description: "Prepare les frais de fourriere, la duree maximale et les points de recuperation.",
    icon: "Car",
    tags: ["fourriere", "vehicule", "economie"],
    fields: [
      { name: "feePerDay", label: "Frais / jour", type: "number", default: 500, min: 0 },
      { name: "maxDays", label: "Jours maximum", type: "number", default: 14, min: 1, max: 90 },
      { name: "releaseFee", label: "Frais de sortie", type: "number", default: 1500, min: 0 },
      { name: "locationsCsv", label: "Points (name,coords)", type: "textarea", rows: 4, default: "Centre,100.0,200.0,30.0\nNord,-200.0,500.0,40.0" },
    ],
    build: (input) => {
      const locations = rows(input, "locationsCsv", ["name", "coords"]);
      return {
        data: {
          feePerDay: num(input, "feePerDay", 500),
          maxDays: num(input, "maxDays", 14),
          releaseFee: num(input, "releaseFee", 1500),
          locations: locations.map((row) => ({ name: row.name || "Fourriere", coords: coordParts(row.coords) })),
        },
        stats: [stat("Points", String(locations.length)), stat("Frais / jour", String(num(input, "feePerDay", 500)))],
        diagnostics: locations.length === 0 ? [{ level: "warning", message: "Aucun point de fourriere defini." }] : [],
      };
    },
  }),
  moduleTool({
    slug: "vehicle-fuel",
    name: "Profil de carburant",
    category: "vehicules",
    description: "Configure la contenance, la consommation et les types de carburant d'un vehicule.",
    icon: "Car",
    tags: ["carburant", "consommation", "vehicule"],
    fields: [
      { name: "tankSize", label: "Reservoir (litres)", type: "number", default: 60, min: 1, max: 500 },
      { name: "consumption", label: "Consommation (L/km)", type: "number", default: 0.09, step: 0.01, min: 0.01 },
      { name: "fuelTypesCsv", label: "Carburants", type: "text", default: "essence, diesel, electrique" },
      { name: "jerrycan", label: "Jerrycan autorise", type: "switch", default: true },
    ],
    build: (input) => {
      const tankSize = num(input, "tankSize", 60);
      const consumption = num(input, "consumption", 0.09);
      return {
        data: { tankSize, consumption, fuelTypes: list(input, "fuelTypesCsv", "essence"), jerrycan: bool(input, "jerrycan", true) },
        lua: `function GetFuelUse(distanceKm)\n  return math.max(0, distanceKm * Config.VehicleFuel.consumption)\nend\n\nfunction CanRefuel(fuelType)\n  for _, allowed in ipairs(Config.VehicleFuel.fuelTypes) do\n    if allowed == fuelType then return true end\n  end\n  return false\nend\n`,
        stats: [stat("Reservoir", `${tankSize} L`), stat("Consommation", `${consumption} L/km`)],
      };
    },
  }),
  moduleTool({
    slug: "vehicle-damage",
    name: "Profil de degats",
    category: "vehicules",
    description: "Regle les multiplicateurs de degats carrosserie, moteur, reservoir et deformation.",
    icon: "Car",
    tags: ["degats", "vehicule", "equilibrage"],
    fields: [
      { name: "body", label: "Carrosserie", type: "number", default: 1, step: 0.1, min: 0, max: 3 },
      { name: "engine", label: "Moteur", type: "number", default: 1.2, step: 0.1, min: 0, max: 3 },
      { name: "tank", label: "Reservoir", type: "number", default: 1.4, step: 0.1, min: 0, max: 3 },
      { name: "deformation", label: "Deformation", type: "number", default: 1, step: 0.1, min: 0, max: 3 },
    ],
    build: (input) => {
      const multipliers = {
        body: num(input, "body", 1),
        engine: num(input, "engine", 1.2),
        tank: num(input, "tank", 1.4),
        deformation: num(input, "deformation", 1),
      };
      return {
        data: { multipliers },
        lua: `function GetDamageMultiplier(part)\n  return Config.VehicleDamage.multipliers[part] or 1.0\nend\n`,
        stats: [stat("Moteur", `${multipliers.engine}x`), stat("Reservoir", `${multipliers.tank}x`)],
      };
    },
  }),
  moduleTool({
    slug: "vehicle-seats",
    name: "Plan des places",
    category: "vehicules",
    description: "Decrit les places disponibles et la capacite maximale d'un vehicule.",
    icon: "Car",
    tags: ["sieges", "places", "vehicule"],
    fields: [
      { name: "model", label: "Modele", type: "text", default: "sultan", required: true },
      { name: "driver", label: "Conducteur", type: "switch", default: true },
      { name: "passengers", label: "Passagers avant", type: "number", default: 1, min: 0, max: 3 },
      { name: "rear", label: "Places arriere", type: "number", default: 2, min: 0, max: 6 },
      { name: "trunk", label: "Coffre", type: "number", default: 40, min: 0, max: 200 },
    ],
    build: (input) => {
      const driver = bool(input, "driver", true);
      const passengers = num(input, "passengers", 1);
      const rear = num(input, "rear", 2);
      return {
        data: { model: safeSlug(str(input, "model", "sultan")), driver, passengers, rear, trunk: num(input, "trunk", 40), total: (driver ? 1 : 0) + passengers + rear },
        stats: [stat("Places", String((driver ? 1 : 0) + passengers + rear)), stat("Coffre", `${num(input, "trunk", 40)} kg`)],
      };
    },
  }),
  moduleTool({
    slug: "vehicle-finance",
    name: "Financement vehicule",
    category: "vehicules",
    description: "Configure l'apport, le taux, les durees et le score minimum de credit.",
    icon: "Car",
    tags: ["financement", "credit", "vehicule"],
    fields: [
      { name: "downPayment", label: "Apport (%)", type: "number", default: 20, min: 0, max: 100 },
      { name: "interest", label: "Taux annuel (%)", type: "number", default: 7.5, step: 0.1, min: 0, max: 50 },
      { name: "termsCsv", label: "Durees (mois)", type: "text", default: "12, 24, 36, 48" },
      { name: "minScore", label: "Score minimum", type: "number", default: 500, min: 0, max: 1000 },
    ],
    build: (input) => {
      const terms = list(input, "termsCsv", "12,24,36").map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0);
      return {
        data: { downPaymentPercent: num(input, "downPayment", 20), interestPercent: num(input, "interest", 7.5), terms, minScore: num(input, "minScore", 500) },
        sql: `CREATE TABLE IF NOT EXISTS vehicle_finance (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  plate VARCHAR(16) NOT NULL,\n  owner VARCHAR(120) NOT NULL,\n  principal INT NOT NULL,\n  term_months INT NOT NULL,\n  monthly INT NOT NULL,\n  remaining INT NOT NULL,\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n  UNIQUE KEY uniq_financed_plate (plate)\n);\n`,
        lua: `function MonthlyPayment(principal, months)\n  local rate = Config.VehicleFinance.interestPercent / 100 / 12\n  if rate <= 0 then return math.ceil(principal / months) end\n  return math.ceil(principal * rate / (1 - (1 + rate) ^ -months))\nend\n`,
        stats: [stat("Durees", String(terms.length)), stat("Taux", `${num(input, "interest", 7.5)}%`)],
      };
    },
  }),
  moduleTool({
    slug: "vehicle-spawner",
    name: "Menu de spawn admin",
    category: "vehicules",
    description: "Prepare un menu de spawn de vehicules avec permission et categories.",
    icon: "Car",
    tags: ["spawn", "admin", "vehicule"],
    fields: [
      { name: "permission", label: "ACE requise", type: "text", default: "fdm.vehicle.spawn" },
      { name: "categoriesCsv", label: "Categories (name,label,models)", type: "textarea", rows: 4, default: "sport,Sport,sultan,comet\nsuv,SUV,baller,dubsta" },
      { name: "coords", label: "Point de spawn", type: "text", default: "0, 0, 0" },
      { name: "adminOnly", label: "Admin uniquement", type: "switch", default: true },
    ],
    build: (input) => {
      const categories = rows(input, "categoriesCsv", ["name", "label", "models"]);
      return {
        data: {
          permission: str(input, "permission", "fdm.vehicle.spawn"),
          coords: coordParts(str(input, "coords", "0, 0, 0")),
          adminOnly: bool(input, "adminOnly", true),
          categories: categories.map((row) => ({ name: safeSlug(row.name, "categorie"), label: row.label || row.name, models: row.models.split("|").map((model) => safeSlug(model, "")).filter(Boolean) })),
        },
        stats: [stat("Categories", String(categories.length)), stat("Permission", str(input, "permission", "fdm.vehicle.spawn"))],
      };
    },
  }),
  moduleTool({
    slug: "vehicle-cleanup",
    name: "Nettoyage des vehicules",
    category: "vehicules",
    description: "Configure la suppression des vehicules abandonnes et les avertissements joueurs.",
    icon: "Car",
    tags: ["cleanup", "performance", "vehicule"],
    fields: [
      { name: "timeoutMinutes", label: "Delai (minutes)", type: "number", default: 15, min: 1, max: 180 },
      { name: "maxDistance", label: "Distance max (m)", type: "number", default: 250, min: 10, max: 2000 },
      { name: "maxPerPlayer", label: "Vehicules / joueur", type: "number", default: 3, min: 1, max: 20 },
      { name: "warnSeconds", label: "Avertissement (s)", type: "number", default: 60, min: 5, max: 300 },
    ],
    build: (input) => {
      const timeoutMinutes = num(input, "timeoutMinutes", 15);
      return {
        data: { timeoutMinutes, maxDistance: num(input, "maxDistance", 250), maxPerPlayer: num(input, "maxPerPlayer", 3), warnSeconds: num(input, "warnSeconds", 60) },
        lua: `CreateThread(function()\n  while true do\n    Wait(60000)\n    -- Verifier les vehicules sans occupant proche et appliquer le delai.\n  end\nend)\n`,
        stats: [stat("Delai", `${timeoutMinutes} min`), stat("Max / joueur", String(num(input, "maxPerPlayer", 3)))],
      };
    },
  }),
];
