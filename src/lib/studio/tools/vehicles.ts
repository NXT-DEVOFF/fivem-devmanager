import {
  file,
  luaString,
  mdTable,
  num,
  parseTable,
  parseNumberList,
  result,
  safeSlug,
  stat,
  str,
} from "../helpers";
import {
  DEFAULT_HANDLING,
  DEFAULT_HANDLING_XML,
  VEHICLE_PRESET_OPTIONS,
  analyzeHandling,
  applyVehiclePreset,
  debugVehicle,
  generateHandlingXml,
  generateSpawnLua,
  generateVehiclesMeta,
  scoreHandling,
  vehicleReport,
  vehicleStats,
  type HandlingData,
} from "../vehicles";
import type { StudioResult, StudioTool } from "../types";

const classOptions = [
  { value: "VC_SPORT", label: "Sport" },
  { value: "VC_SUPER", label: "Supercar" },
  { value: "VC_SUV", label: "SUV" },
  { value: "VC_SEDAN", label: "Berline" },
  { value: "VC_COUPE", label: "Coupe" },
  { value: "VC_MUSCLE", label: "Muscle" },
  { value: "VC_OFFROAD", label: "Offroad" },
  { value: "VC_MOTORCYCLE", label: "Moto" },
  { value: "VC_EMERGENCY", label: "Urgence" },
];

const typeOptions = [
  { value: "VEHICLE_TYPE_CAR", label: "Voiture" },
  { value: "VEHICLE_TYPE_BIKE", label: "Moto" },
  { value: "VEHICLE_TYPE_BOAT", label: "Bateau" },
  { value: "VEHICLE_TYPE_HELI", label: "Helicoptere" },
  { value: "VEHICLE_TYPE_PLANE", label: "Avion" },
];

const frameworkOptions = [
  { value: "standalone", label: "Standalone" },
  { value: "qb", label: "QBCore" },
  { value: "esx", label: "ESX" },
  { value: "ox", label: "ox_lib / ox_inventory" },
];

function handlingFromInput(input: Parameters<StudioTool["run"]>[0], preset: string): HandlingData {
  if (preset !== "custom") {
    const presetData = applyVehiclePreset({ ...DEFAULT_HANDLING, handlingName: str(input, "model", "sultan") }, preset);
    return {
      ...presetData,
      handlingName: str(input, "model", presetData.handlingName),
    };
  }
  return {
    ...DEFAULT_HANDLING,
    handlingName: str(input, "model", DEFAULT_HANDLING.handlingName),
    mass: num(input, "mass", DEFAULT_HANDLING.mass),
    initialDragCoeff: num(input, "drag", DEFAULT_HANDLING.initialDragCoeff),
    driveInertia: num(input, "inertia", DEFAULT_HANDLING.driveInertia),
    driveForce: num(input, "driveForce", DEFAULT_HANDLING.driveForce),
    brakeForce: num(input, "brakeForce", DEFAULT_HANDLING.brakeForce),
    gears: num(input, "gears", DEFAULT_HANDLING.gears),
    maxFlatVel: num(input, "maxFlatVel", DEFAULT_HANDLING.maxFlatVel),
    tractionCurveMax: num(input, "traction", DEFAULT_HANDLING.tractionCurveMax),
    suspensionForce: num(input, "suspension", DEFAULT_HANDLING.suspensionForce),
    steeringLock: num(input, "steering", DEFAULT_HANDLING.steeringLock),
    flags: str(input, "flags", DEFAULT_HANDLING.flags),
    gearRatios: parseNumberList(str(input, "ratios", DEFAULT_HANDLING.gearRatios.join(", "))).length
      ? parseNumberList(str(input, "ratios", DEFAULT_HANDLING.gearRatios.join(", ")))
      : [...DEFAULT_HANDLING.gearRatios],
  };
}

function generateVehiclePack(data: HandlingData, input: Parameters<StudioTool["run"]>[0]): StudioResult {
  const diagnostics = analyzeHandling(data, true);
  const score = scoreHandling(data, diagnostics);
  const stats = vehicleStats(data);
  const model = safeSlug(data.handlingName, "sultan");
  const files = [
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
      generateSpawnLua({ model, command: str(input, "command", "veh"), plate: str(input, "plate", "DEV 001"), permission: str(input, "permission", "") }),
      "lua",
    ),
    file("README.md", vehicleReport(data, diagnostics, stats, score), "markdown"),
  ];
  return result(`Pack vehicule ${model} genere (score ${score}/100).`, files, {
    diagnostics,
    stats: [stat("Score", `${score}/100`, score >= 80 ? "success" : score >= 50 ? "warning" : "danger"), ...stats],
    warnings: ["Fusionnez les blocs dans vos fichiers existants et testez en jeu."],
  });
}

export const vehicleTools: StudioTool[] = [
  {
    slug: "vehicle-debug",
    name: "Debug vehicule",
    category: "vehicules",
    description: "Analyse un handling.meta, detecte les valeurs incoherentes et genere les fichiers corriges.",
    icon: "Car",
    tags: ["handling", "debug", "vehicule"],
    fields: [
      { name: "xml", label: "handling.meta (XML)", type: "textarea", rows: 14, default: DEFAULT_HANDLING_XML, required: true },
      { name: "model", label: "Modele / handlingName", type: "text", default: "sultan", required: true },
      { name: "preset", label: "Preset de correction", type: "select", options: VEHICLE_PRESET_OPTIONS, default: "custom" },
      { name: "applyPreset", label: "Appliquer le preset", type: "switch", default: false },
      { name: "command", label: "Commande de spawn", type: "text", default: "veh" },
      { name: "plate", label: "Plaque de test", type: "text", default: "DEV 001" },
    ],
    run: debugVehicle,
  },
  {
    slug: "handling-generator",
    name: "Generateur handling.meta",
    category: "vehicules",
    description: "Genere un handling complet a partir d'un preset ou de valeurs 100% personnalisees.",
    icon: "SlidersHorizontal",
    tags: ["handling", "meta", "generateur"],
    fields: [
      { name: "model", label: "Modele", type: "text", default: "sultan" },
      { name: "preset", label: "Base", type: "select", options: VEHICLE_PRESET_OPTIONS, default: "sport" },
      { name: "mass", label: "Masse", type: "number", default: 1500, min: 100, max: 10000 },
      { name: "driveForce", label: "Force motrice", type: "number", default: 0.32, step: 0.01, min: 0, max: 2 },
      { name: "brakeForce", label: "Freinage", type: "number", default: 1.4, step: 0.01, min: 0, max: 5 },
      { name: "gears", label: "Vitesses", type: "number", default: 6, min: 1, max: 8 },
      { name: "maxFlatVel", label: "Vitesse max (m/s)", type: "number", default: 65, step: 1 },
      { name: "drag", label: "Trainee", type: "number", default: 8, step: 0.1 },
      { name: "inertia", label: "Inertie", type: "number", default: 1, step: 0.05 },
      { name: "traction", label: "Traction", type: "number", default: 1.3, step: 0.05 },
      { name: "suspension", label: "Suspension", type: "number", default: 1.9, step: 0.05 },
      { name: "steering", label: "Braquage", type: "number", default: 36, step: 1 },
      { name: "ratios", label: "Rapports de boite", type: "text", default: "3.4, 2.3, 1.7, 1.3, 1.05, 0.85" },
      { name: "make", label: "Marque", type: "text", default: "Declasse" },
      { name: "vehicleClass", label: "Classe", type: "select", options: classOptions, default: "VC_SPORT" },
      { name: "seats", label: "Places", type: "number", default: 2, min: 1, max: 8 },
      { name: "command", label: "Commande de spawn", type: "text", default: "veh" },
    ],
    run: (input) => {
      const preset = str(input, "preset", "sport");
      const data = handlingFromInput(input, preset);
      return generateVehiclePack(data, input);
    },
  },
  {
    slug: "vehicles-meta",
    name: "Generateur vehicles.meta",
    category: "vehicules",
    description: "Cree une entree CVehicleModelInfo complete pour un nouveau modele.",
    icon: "FileCode2",
    tags: ["vehicles.meta", "modele", "meta"],
    fields: [
      { name: "model", label: "Nom du modele", type: "text", default: "sultan2", required: true },
      { name: "handlingId", label: "handlingId", type: "text", default: "sultan2" },
      { name: "make", label: "Marque", type: "text", default: "Karin" },
      { name: "vehicleClass", label: "Classe", type: "select", options: classOptions, default: "VC_SPORT" },
      { name: "vehicleType", label: "Type", type: "select", options: typeOptions, default: "VEHICLE_TYPE_CAR" },
      { name: "seats", label: "Places", type: "number", default: 2, min: 1, max: 8 },
      { name: "doors", label: "Portes", type: "number", default: 2, min: 1, max: 6 },
      { name: "txdName", label: "Texture (txdName)", type: "text", default: "sultan2" },
      { name: "flags", label: "Flags", type: "text", default: "FLAG_HAS_LIVERY" },
    ],
    run: (input) => {
      const model = safeSlug(str(input, "model", "sultan2"), "sultan2");
      const meta = generateVehiclesMeta({
        model,
        handlingId: str(input, "handlingId", model) || model,
        make: str(input, "make", "Karin"),
        vehicleClass: str(input, "vehicleClass", "VC_SPORT"),
        vehicleType: str(input, "vehicleType", "VEHICLE_TYPE_CAR"),
        seats: num(input, "seats", 2),
        doors: num(input, "doors", 2),
        txdName: str(input, "txdName", model),
        flags: str(input, "flags", "FLAG_HAS_LIVERY"),
      });
      return result(`Entree vehicles.meta generee pour ${model}.`, [file("vehicles.meta", meta, "xml")], {
        notes: ["Ajoutez aussi le fichier de handling et les textures dans la ressource."],
      });
    },
  },
  {
    slug: "vehicle-spawn",
    name: "Commande de spawn vehicule",
    category: "vehicules",
    description: "Genere une commande client avec verification ACE, plaque et nettoyage du modele.",
    icon: "TerminalSquare",
    tags: ["spawn", "commande", "lua"],
    fields: [
      { name: "model", label: "Modele", type: "text", default: "sultan" },
      { name: "command", label: "Commande", type: "text", default: "veh" },
      { name: "plate", label: "Plaque", type: "text", default: "DEV 001" },
      { name: "permission", label: "Permission ACE", type: "text", default: "fdm.vehicle" },
    ],
    run: (input) => {
      const model = safeSlug(str(input, "model", "sultan"), "sultan");
      const command = safeSlug(str(input, "command", "veh"), "veh").replace(/_/g, "");
      return result(`Commande /${command} generee pour ${model}.`, [
        file(
          "spawn.lua",
          generateSpawnLua({ model, command, plate: str(input, "plate", "DEV 001"), permission: str(input, "permission", "") }),
          "lua",
        ),
      ], {
        warnings: ["Ajoutez la permission ACE dans votre server.cfg si vous l'utilisez."],
      });
    },
  },
  {
    slug: "vehicle-performance",
    name: "Calculateur de performance",
    category: "vehicules",
    description: "Estime vitesse, acceleration, freinage et rapport poids/puissance a partir du handling.",
    icon: "Gauge",
    tags: ["performance", "calcul", "handling"],
    fields: [
      { name: "mass", label: "Masse", type: "number", default: 1500 },
      { name: "driveForce", label: "Force motrice", type: "number", default: 0.32, step: 0.01 },
      { name: "brakeForce", label: "Freinage", type: "number", default: 1.4, step: 0.01 },
      { name: "gears", label: "Vitesses", type: "number", default: 6 },
      { name: "maxFlatVel", label: "Vitesse max (m/s)", type: "number", default: 65 },
      { name: "drag", label: "Trainee", type: "number", default: 8, step: 0.1 },
      { name: "inertia", label: "Inertie", type: "number", default: 1, step: 0.05 },
      { name: "traction", label: "Traction", type: "number", default: 1.3, step: 0.05 },
      { name: "suspension", label: "Suspension", type: "number", default: 1.9, step: 0.05 },
    ],
    run: (input) => {
      const data: HandlingData = {
        ...DEFAULT_HANDLING,
        handlingName: "analyse",
        mass: num(input, "mass", DEFAULT_HANDLING.mass),
        driveForce: num(input, "driveForce", DEFAULT_HANDLING.driveForce),
        brakeForce: num(input, "brakeForce", DEFAULT_HANDLING.brakeForce),
        gears: num(input, "gears", DEFAULT_HANDLING.gears),
        maxFlatVel: num(input, "maxFlatVel", DEFAULT_HANDLING.maxFlatVel),
        initialDragCoeff: num(input, "drag", DEFAULT_HANDLING.initialDragCoeff),
        driveInertia: num(input, "inertia", DEFAULT_HANDLING.driveInertia),
        tractionCurveMax: num(input, "traction", DEFAULT_HANDLING.tractionCurveMax),
        suspensionForce: num(input, "suspension", DEFAULT_HANDLING.suspensionForce),
      };
      const diagnostics = analyzeHandling(data);
      const stats = vehicleStats(data);
      return result("Estimation de performance calculee.", [
        file("performance.json", JSON.stringify({ data, stats, score: scoreHandling(data, diagnostics) }, null, 2), "json"),
        file("performance.md", vehicleReport(data, diagnostics, stats, scoreHandling(data, diagnostics)), "markdown"),
      ], { diagnostics, stats });
    },
  },
  {
    slug: "vehicle-tune",
    name: "Config de tuning",
    category: "vehicules",
    description: "Genere des paliers de tuning, prix et logique d'application pour un vehicule.",
    icon: "Wrench",
    tags: ["tuning", "garage", "economie"],
    fields: [
      { name: "model", label: "Modele", type: "text", default: "sultan" },
      { name: "framework", label: "Framework", type: "select", options: frameworkOptions, default: "standalone" },
      { name: "maxLevel", label: "Niveau maximum", type: "number", default: 4, min: 1, max: 10 },
      { name: "enginePrices", label: "Prix moteur par niveau", type: "text", default: "5000, 12000, 25000, 45000" },
      { name: "brakePrices", label: "Prix freins", type: "text", default: "3000, 8000, 16000, 28000" },
      { name: "turboPrice", label: "Prix turbo", type: "number", default: 35000 },
    ],
    run: (input) => {
      const model = safeSlug(str(input, "model", "sultan"), "sultan");
      const maxLevel = Math.max(1, Math.min(10, num(input, "maxLevel", 4)));
      const enginePrices = parseNumberList(str(input, "enginePrices", "5000, 12000, 25000, 45000"));
      const brakePrices = parseNumberList(str(input, "brakePrices", "3000, 8000, 16000, 28000"));
      const config = {
        model,
        framework: str(input, "framework", "standalone"),
        maxLevel,
        enginePrices,
        brakePrices,
        turboPrice: num(input, "turboPrice", 35000),
      };
      const lua = `Config = Config or {}
Config.Tuning = ${JSON.stringify(config, null, 2)}

function GetTuningPrice(kind, level)
  local prices = kind == "engine" and Config.Tuning.enginePrices or Config.Tuning.brakePrices
  return prices[level] or 0
end

function ApplyTuning(vehicle, kind, level)
  if kind == "engine" then
    SetVehicleModKit(vehicle, 0)
    SetVehicleMod(vehicle, 11, level - 1, false)
  elseif kind == "brakes" then
    SetVehicleModKit(vehicle, 0)
    SetVehicleMod(vehicle, 12, level - 1, false)
  elseif kind == "turbo" then
    ToggleVehicleMod(vehicle, 18, true)
  end
end
`;
      return result(`Configuration de tuning generee pour ${model}.`, [
        file("tuning.lua", lua, "lua"),
        file("tuning.json", JSON.stringify(config, null, 2), "json"),
      ], {
        stats: [stat("Niveaux", String(maxLevel)), stat("Turbo", String(config.turboPrice))],
        warnings: ["Adaptez les prix et les permissions a votre economie."],
      });
    },
  },
  {
    slug: "vehicle-shop",
    name: "Concessionnaire",
    category: "vehicules",
    description: "Genere un catalogue de vehicules, prix et categories pour un concessionnaire.",
    icon: "Store",
    tags: ["shop", "concession", "economie"],
    fields: [
      { name: "shopName", label: "Nom", type: "text", default: "Concession Chicago" },
      { name: "coords", label: "Coordonnees", type: "text", default: "215.0, -810.0, 30.0" },
      { name: "blip", label: "Blip", type: "text", default: "Concession" },
      { name: "currency", label: "Monnaie", type: "select", options: [{ value: "money", label: "Argent" }, { value: "bank", label: "Banque" }, { value: "coins", label: "Coins" }], default: "money" },
      { name: "vehiclesCsv", label: "Vehicules (model,label,price,category)", type: "textarea", rows: 8, default: "sultan,Sultan,25000,sport\nadder,Adder,120000,super\nblista,Blista,12000,compact" },
    ],
    run: (input) => {
      const rows = parseTable(str(input, "vehiclesCsv", ""), ["model", "label", "price", "category"]);
      const vehicles = rows.map((row) => ({ model: safeSlug(row.model, "sultan"), label: row.label || row.model, price: Number(row.price) || 0, category: row.category || "divers" }));
      const config = {
        name: str(input, "shopName", "Concession"),
        coords: str(input, "coords", "0, 0, 0"),
        blip: str(input, "blip", "Concession"),
        currency: str(input, "currency", "money"),
        vehicles,
      };
      const lua = `Config = Config or {}
Config.VehicleShop = ${JSON.stringify(config, null, 2)}

RegisterNetEvent("vehicleShop:buy", function(model)
  local shop = Config.VehicleShop
  for _, vehicle in ipairs(shop.vehicles) do
    if vehicle.model == model then
      TriggerClientEvent("vehicleShop:spawn", source, vehicle.model)
      print(("[shop] %s achete %s pour %d"):format(GetPlayerName(source), vehicle.label, vehicle.price))
      return
    end
  end
end)
`;
      return result(`Concession « ${config.name} » generee avec ${vehicles.length} vehicule(s).`, [
        file("shop.lua", lua, "lua"),
        file("vehicles.json", JSON.stringify(vehicles, null, 2), "json"),
        file(
          "README.md",
          `# ${config.name}\n\n- Coordonnees : ${config.coords}\n- Monnaie : ${config.currency}\n- Vehicules : ${vehicles.length}\n\nBranchez la validation d'achat sur votre framework et verifiez le solde cote serveur.\n`,
          "markdown",
        ),
      ], {
        diagnostics: vehicles.length === 0 ? [{ level: "error", message: "Aucun vehicule dans le CSV." }] : [],
        stats: [stat("Vehicules", String(vehicles.length)), stat("Monnaie", config.currency)],
      });
    },
  },
  {
    slug: "garage-config",
    name: "Configuration de garage",
    category: "vehicules",
    description: "Cree un garage avec point de spawn, blip, type et liste de vehicules.",
    icon: "Warehouse",
    tags: ["garage", "spawn", "vehicule"],
    fields: [
      { name: "garageName", label: "Nom", type: "text", default: "Garage Central" },
      { name: "coords", label: "Point d'entree", type: "text", default: "215.0, -810.0, 30.0" },
      { name: "spawnCoords", label: "Point de spawn", type: "text", default: "220.0, -810.0, 30.0" },
      { name: "blip", label: "Blip", type: "text", default: "Garage" },
      { name: "garageType", label: "Type", type: "select", options: [{ value: "car", label: "Voiture" }, { value: "bike", label: "Moto" }, { value: "boat", label: "Bateau" }, { value: "air", label: "Avion" }], default: "car" },
      { name: "vehiclesCsv", label: "Vehicules autorises (model)", type: "textarea", rows: 5, default: "sultan\nblista\nadder" },
    ],
    run: (input) => {
      const models = str(input, "vehiclesCsv", "").split(/\r?\n/).map((line) => safeSlug(line.trim(), "")).filter(Boolean);
      const garage = {
        name: str(input, "garageName", "Garage"),
        coords: str(input, "coords", "0, 0, 0"),
        spawn: str(input, "spawnCoords", "0, 0, 0"),
        blip: str(input, "blip", "Garage"),
        type: str(input, "garageType", "car"),
        vehicles: models,
      };
      return result(`Garage « ${garage.name} » configure avec ${models.length} vehicule(s).`, [
        file("garages.lua", `Config = Config or {}\nConfig.Garages = ${JSON.stringify([garage], null, 2)}\n`, "lua"),
        file("garage.json", JSON.stringify(garage, null, 2), "json"),
      ], {
        stats: [stat("Vehicules", String(models.length)), stat("Type", garage.type)],
        notes: ["Le stockage des vehicules appartient a votre framework ; ce fichier ne fait que declarer le garage."],
      });
    },
  },
  {
    slug: "vehicle-plate",
    name: "Format de plaques",
    category: "vehicules",
    description: "Genere un format de plaque, une regex et une fonction Lua de validation.",
    icon: "BadgeCheck",
    tags: ["plaque", "validation", "lua"],
    fields: [
      { name: "pattern", label: "Modele", type: "text", default: "XX-000-XX" },
      { name: "prefix", label: "Prefixe", type: "text", default: "RP" },
      { name: "minLength", label: "Longueur minimum", type: "number", default: 6, min: 2, max: 12 },
      { name: "maxLength", label: "Longueur maximum", type: "number", default: 8, min: 2, max: 12 },
      { name: "example", label: "Exemple", type: "text", default: "RP-123-AB" },
    ],
    run: (input) => {
      const pattern = str(input, "pattern", "XX-000-XX");
      const prefix = str(input, "prefix", "RP").toUpperCase();
      const min = Math.max(2, num(input, "minLength", 6));
      const max = Math.max(min, num(input, "maxLength", 8));
      const regex = `^${prefix}-[0-9]{3}-[A-Z]{2}$`;
      const lua = `local platePattern = ${luaString(regex)}\n\nfunction IsValidPlate(plate)\n  plate = tostring(plate or ""):upper()\n  return #plate >= ${min} and #plate <= ${max} and plate:match(platePattern) ~= nil\nend\n\nfunction FormatPlate(value)\n  return (${luaString(prefix + "-")} .. tostring(value or "")):upper()\nend\n`;
      return result("Format de plaque et validateur Lua generes.", [
        file("plate.lua", lua, "lua"),
        file("plate.json", JSON.stringify({ pattern, prefix, minLength: min, maxLength: max, regex }, null, 2), "json"),
      ], {
        notes: ["Adaptez la regex si vous autorisez des plaques personnalisees."],
        stats: [stat("Regex", regex), stat("Longueur", `${min}-${max}`)],
      });
    },
  },
  {
    slug: "vehicle-flags",
    name: "Decodeur de handling flags",
    category: "vehicules",
    description: "Decode un bitmask de handling flags et genere un helper Lua de verification.",
    icon: "Binary",
    tags: ["flags", "handling", "debug"],
    fields: [
      { name: "model", label: "Modele", type: "text", default: "sultan" },
      { name: "flags", label: "Flags (hexadecimal)", type: "text", default: "1F000000" },
    ],
    run: (input) => {
      const flags = str(input, "flags", "1F000000").replace(/^0x/i, "");
      const numeric = Number.parseInt(flags || "0", 16);
      const bits = Number.isFinite(numeric)
        ? Array.from({ length: 32 }, (_, index) => (numeric & (1 << index) ? index : null)).filter((value): value is number => value !== null)
        : [];
      const lua = `local flags = ${numeric || 0}\n\nfunction HasHandlingFlag(bit)\n  return (flags & (1 << bit)) ~= 0\nend\n\nfor bit = 0, 31 do\n  if HasHandlingFlag(bit) then\n    print(("[handling] flag actif : %d"):format(bit))\n  end\nend\n`;
      return result(`Flags ${flags} decodes : ${bits.length} bit(s) actif(s).`, [
        file("handling-flags.lua", lua, "lua"),
        file("flags.json", JSON.stringify({ model: str(input, "model", "sultan"), flags, bits }, null, 2), "json"),
        file(
          "handling-flags.md",
          `# Handling flags - ${str(input, "model", "sultan")}\n\nValeur : \`${flags}\`\n\n${mdTable(["Bit", "Puissance"], bits.map((bit) => [String(bit), String(2 ** bit)]))}\n\nLes bits actifs dependent de la version du jeu ; testez chaque modification.\n`,
          "markdown",
        ),
      ], {
        diagnostics: Number.isFinite(numeric) ? [] : [{ level: "error", message: "La valeur des flags n'est pas un hexadecimal valide." }],
        stats: [stat("Bits actifs", String(bits.length))],
      });
    },
  },
  {
    slug: "vehicle-keys",
    name: "Systeme de cles vehicule",
    category: "vehicules",
    description: "Genere les cles de vehicule client/serveur avec proprietaire en base, commande de verrouillage et verification framework.",
    icon: "KeyRound",
    tags: ["cles", "vehicule", "proprietaire", "garage", "securite"],
    fields: [
      { name: "framework", label: "Framework", type: "select", options: frameworkOptions, default: "esx" },
      { name: "resourceName", label: "Ressource", type: "text", default: "vehicle_keys", required: true },
      { name: "command", label: "Commande", type: "text", default: "keys" },
      { name: "adminPermission", label: "Permission admin", type: "text", default: "vehiclekeys.admin" },
    ],
    run: (input) => {
      const resource = safeSlug(str(input, "resourceName", "vehicle_keys"), "vehicle_keys");
      const requestedFramework = str(input, "framework", "esx");
      const framework = ["esx", "qb", "ox", "standalone"].includes(requestedFramework)
        ? requestedFramework
        : "standalone";
      const frameworkLabel =
        frameworkOptions.find((option) => option.value === framework)?.label ?? "Standalone";
      const command = safeSlug(str(input, "command", "keys"), "keys");
      const adminPermission =
        str(input, "adminPermission", "vehiclekeys.admin")
          .replace(/[^A-Za-z0-9_.-]/g, "")
          .slice(0, 80) || "vehiclekeys.admin";
      const dependencies = ["oxmysql"];
      if (framework === "esx") dependencies.push("es_extended");
      if (framework === "qb") dependencies.push("qb-core");

      const manifest = `fx_version 'cerulean'\ngame 'gta5'\nlua54 'yes'\n\ndependencies {\n${dependencies.map((dependency) => `  '${dependency}',`).join("\n")}\n}\n\nshared_scripts {\n  'shared/config.lua',\n}\n\nserver_scripts {\n  'server/keys.lua',\n}\n\nclient_scripts {\n  'client/keys.lua',\n}\n`;
      const config = `Config = Config or {}\nConfig.ResourceName = ${luaString(resource)}\nConfig.Framework = ${luaString(framework)}\nConfig.Command = ${luaString(command)}\nConfig.AdminPermission = ${luaString(adminPermission)}\n`;
      const server = `local Config = Config or {}\nlocal Framework = Config.Framework\nlocal ESX, QBCore\n\nif Framework == 'esx' then\n  ESX = exports['es_extended']:getSharedObject()\nelseif Framework == 'qb' then\n  QBCore = exports['qb-core']:GetCoreObject()\nend\n\nlocal function getIdentifier(source)\n  if Framework == 'esx' and ESX then\n    local player = ESX.GetPlayerFromId(source)\n    return player and player.identifier or nil\n  end\n  if Framework == 'qb' and QBCore then\n    local player = QBCore.Functions.GetPlayer(source)\n    return player and player.PlayerData.citizenid or nil\n  end\n  return GetPlayerIdentifierByType(source, 'license') or GetPlayerIdentifier(source, 0)\nend\n\nlocal function normalizePlate(value)\n  if type(value) ~= 'string' then return nil end\n  value = value:gsub('%s+', ''):upper():sub(1, 12)\n  if #value < 2 then return nil end\n  return value\nend\n\nlocal function hasKey(source, plate)\n  local identifier = getIdentifier(source)\n  if not identifier then return false end\n  local row = MySQL.single.await(\"SELECT owner FROM vehicle_keys WHERE plate = ?\", { plate })\n  return row ~= nil and row.owner == identifier\nend\n\nRegisterNetEvent(Config.ResourceName .. ':server:toggle', function(plate)\n  local src = source\n  plate = normalizePlate(plate)\n  if not plate then return end\n\n  if not hasKey(src, plate) then\n    TriggerClientEvent(Config.ResourceName .. ':client:denied', src)\n    return\n  end\n\n  TriggerClientEvent(Config.ResourceName .. ':client:toggle', src, plate)\nend)\n\nRegisterNetEvent(Config.ResourceName .. ':server:register', function(plate)\n  local src = source\n  if not IsPlayerAceAllowed(src, Config.AdminPermission) then return end\n\n  plate = normalizePlate(plate)\n  local identifier = getIdentifier(src)\n  if not plate or not identifier then return end\n\n  MySQL.insert.await(\n    \"INSERT INTO vehicle_keys (plate, owner) VALUES (?, ?) ON DUPLICATE KEY UPDATE owner = VALUES(owner)\",\n    { plate, identifier }\n  )\n  TriggerClientEvent(Config.ResourceName .. ':client:registered', src, plate)\nend)\n`;
      const client = `local Config = Config or {}\n\nlocal function notify(message)\n  BeginTextCommandThefeedPost('STRING')\n  AddTextComponentSubstringPlayerName(message)\n  EndTextCommandThefeedPostTicker(false, true)\nend\n\nlocal function normalizePlate(value)\n  return value:gsub('%s+', ''):upper()\nend\n\nlocal function closestVehicle()\n  local ped = PlayerPedId()\n  local vehicle = GetVehiclePedIsIn(ped, false)\n  if vehicle ~= 0 then return vehicle end\n\n  local coords = GetEntityCoords(ped)\n  return GetClosestVehicle(coords.x, coords.y, coords.z, 3.0, 0, 71)\nend\n\nRegisterCommand(Config.Command, function()\n  local vehicle = closestVehicle()\n  if vehicle == 0 then\n    notify('Aucun vehicule a proximite.')\n    return\n  end\n\n  TriggerServerEvent(Config.ResourceName .. ':server:toggle', normalizePlate(GetVehicleNumberPlateText(vehicle)))\nend, false)\n\nRegisterCommand(Config.Command .. 'grant', function(_, args)\n  if not args[1] then\n    notify('Usage : /' .. Config.Command .. 'grant PLATE')\n    return\n  end\n  TriggerServerEvent(Config.ResourceName .. ':server:register', args[1])\nend, false)\n\nRegisterNetEvent(Config.ResourceName .. ':client:denied', function()\n  notify('Vous ne possedez pas les cles de ce vehicule.')\nend)\n\nRegisterNetEvent(Config.ResourceName .. ':client:registered', function(plate)\n  notify('Cles enregistrees pour ' .. tostring(plate))\nend)\n\nRegisterNetEvent(Config.ResourceName .. ':client:toggle', function(plate)\n  local vehicle = closestVehicle()\n  if vehicle == 0 then return end\n  if normalizePlate(GetVehicleNumberPlateText(vehicle)) ~= plate then return end\n\n  local locked = GetVehicleDoorLockStatus(vehicle) == 2\n  SetVehicleDoorsLocked(vehicle, locked and 1 or 2)\n  notify(locked and 'Vehicule deverrouille.' or 'Vehicule verrouille.')\nend)\n`;
      const sql = `CREATE TABLE IF NOT EXISTS vehicle_keys (\n  plate VARCHAR(12) NOT NULL PRIMARY KEY,\n  owner VARCHAR(64) NOT NULL,\n  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  INDEX vehicle_keys_owner_idx (owner)\n);\n`;
      const readme = `# ${resource}\n\nSysteme de cles de vehicule base sur ${frameworkLabel}.\n\n## Installation\n\n1. Importez sql/vehicle_keys.sql dans votre base.\n2. Ajoutez la ressource apres oxmysql et votre framework.\n3. Attribuez la permission ${adminPermission} aux admins.\n4. Utilisez /${command} a proximite d'un vehicule.\n5. Un admin peut attribuer les cles avec /${command}grant PLATE.\n\n## Securite\n\n- Le proprietaire est verifie en base a chaque ouverture.\n- La commande admin verifie une permission ACE cote serveur.\n- La plaque est normalisee et limitee avant la requete.\n- Ne stockez pas de donnees sensibles dans shared/config.lua.\n`;

      return result(`Systeme de cles ${resource} genere pour ${frameworkLabel}.`, [
        file("fxmanifest.lua", manifest, "lua"),
        file("shared/config.lua", config, "lua"),
        file("server/keys.lua", server, "lua"),
        file("client/keys.lua", client, "lua"),
        file("sql/vehicle_keys.sql", sql, "sql"),
        file("README.md", readme, "markdown"),
      ], {
        stats: [
          stat("Framework", frameworkLabel),
          stat("Commande", `/${command}`),
          stat("Table SQL", "vehicle_keys"),
        ],
        notes: ["Le proprietaire est stocke cote serveur et compare a l'identifiant du joueur a chaque demande."],
        warnings: [
          "Adaptez la commande admin et la permission ACE avant la production.",
          "Pour ox et standalone, l'identifiant de proprietaire utilise la licence FiveM.",
        ],
      });
    },
  },
];
