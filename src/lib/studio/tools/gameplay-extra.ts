import { bool, formatNumber, luaString, num, safeSlug, stat, str } from "../helpers";
import { coordParts, list, moduleTool, rows } from "./modules-shared";
import type { StudioTool } from "../types";

export const gameplayExtraTools: StudioTool[] = [
  moduleTool({
    slug: "fishing-system",
    name: "Systeme de peche",
    category: "gameplay",
    description: "Configure les spots de peche, poissons, canne et temps de recharge.",
    icon: "Gamepad2",
    tags: ["peche", "job", "economie"],
    fields: [
      { name: "spotsCsv", label: "Spots (name,x,y,z)", type: "textarea", rows: 4, default: "quai,100,200,1\nlac,-300,500,2" },
      { name: "fishCsv", label: "Poissons (item,weight,price)", type: "textarea", rows: 5, default: "sardine,40,25\nbar,30,60\nsaumon,20,120\nrequin,10,500" },
      { name: "rodItem", label: "Canne", type: "text", default: "fishing_rod" },
      { name: "cooldown", label: "Recharge (s)", type: "number", default: 45, min: 1, max: 600 },
    ],
    build: (input) => {
      const spots = rows(input, "spotsCsv", ["name", "x", "y", "z"]).map((row) => ({ name: safeSlug(row.name, "spot"), coords: { x: Number(row.x) || 0, y: Number(row.y) || 0, z: Number(row.z) || 0 } }));
      const fish = rows(input, "fishCsv", ["item", "weight", "price"]).map((row) => ({ item: safeSlug(row.item, "fish"), weight: Math.max(1, Number(row.weight) || 1), price: Math.max(0, Number(row.price) || 0) }));
      return {
        data: { spots, fish, rodItem: safeSlug(str(input, "rodItem", "fishing_rod")), cooldown: num(input, "cooldown", 45) },
        lua: `local cooldowns = {}\n\nRegisterNetEvent('fishing:catch', function(spotName)\n  local src = source\n  if os.time() < (cooldowns[src] or 0) then return end\n  cooldowns[src] = os.time() + Config.FishingSystem.cooldown\n  local total = 0\n  for _, fish in ipairs(Config.FishingSystem.fish) do total = total + fish.weight end\n  local roll = math.random() * total\n  local cursor = 0\n  for _, fish in ipairs(Config.FishingSystem.fish) do\n    cursor = cursor + fish.weight\n    if roll <= cursor then\n      TriggerClientEvent('fishing:caught', src, fish)\n      return\n    end\n  end\nend)\n`,
        stats: [stat("Spots", String(spots.length)), stat("Poissons", String(fish.length))],
      };
    },
  }),
  moduleTool({
    slug: "hunting-system",
    name: "Systeme de chasse",
    category: "gameplay",
    description: "Prepare les animaux, armes autorisees, primes et temps de chasse.",
    icon: "Gamepad2",
    tags: ["chasse", "animaux", "economie"],
    fields: [
      { name: "animalsCsv", label: "Animaux (model,reward)", type: "textarea", rows: 4, default: "a_c_deer,150\na_c_boar,90\na_c_rabbit_01,40" },
      { name: "weaponsCsv", label: "Armes", type: "text", default: "weapon_huntingrifle, weapon_knife" },
      { name: "payout", label: "Prime de base", type: "number", default: 50, min: 0 },
      { name: "cooldown", label: "Recharge (s)", type: "number", default: 20, min: 1, max: 600 },
    ],
    build: (input) => {
      const animals = rows(input, "animalsCsv", ["model", "reward"]).map((row) => ({ model: row.model, reward: Math.max(0, Number(row.reward) || 0) }));
      return {
        data: { animals, weapons: list(input, "weaponsCsv", "weapon_huntingrifle"), payout: num(input, "payout", 50), cooldown: num(input, "cooldown", 20) },
        lua: `RegisterNetEvent('hunting:harvest', function(model)\n  local src = source\n  for _, animal in ipairs(Config.HuntingSystem.animals) do\n    if animal.model == model then\n      TriggerClientEvent('hunting:reward', src, animal.reward + Config.HuntingSystem.payout)\n      return\n    end\n  end\nend)\n`,
        stats: [stat("Animaux", String(animals.length)), stat("Prime", formatNumber(num(input, "payout", 50), 0))],
      };
    },
  }),
  moduleTool({
    slug: "mining-system",
    name: "Systeme de minage",
    category: "gameplay",
    description: "Configure les filons, minerais, outil et regeneration.",
    icon: "Gamepad2",
    tags: ["minage", "minerais", "job"],
    fields: [
      { name: "nodesCsv", label: "Filons (name,x,y,z)", type: "textarea", rows: 4, default: "carriere,300,1200,20\nmine,-500,2000,30" },
      { name: "oresCsv", label: "Minerais (item,weight,price)", type: "textarea", rows: 4, default: "pierre,50,10\nfer,30,45\nor,15,150\ndiamant,5,900" },
      { name: "toolItem", label: "Outil", type: "text", default: "pickaxe" },
      { name: "respawnMinutes", label: "Regeneration (min)", type: "number", default: 10, min: 1, max: 120 },
    ],
    build: (input) => {
      const nodes = rows(input, "nodesCsv", ["name", "x", "y", "z"]).map((row) => ({ name: safeSlug(row.name, "filon"), coords: { x: Number(row.x) || 0, y: Number(row.y) || 0, z: Number(row.z) || 0 } }));
      const ores = rows(input, "oresCsv", ["item", "weight", "price"]).map((row) => ({ item: safeSlug(row.item, "minerai"), weight: Math.max(1, Number(row.weight) || 1), price: Math.max(0, Number(row.price) || 0) }));
      return {
        data: { nodes, ores, toolItem: safeSlug(str(input, "toolItem", "pickaxe")), respawnMinutes: num(input, "respawnMinutes", 10) },
        lua: `RegisterNetEvent('mining:mine', function(nodeName)\n  local src = source\n  local total = 0\n  for _, ore in ipairs(Config.MiningSystem.ores) do total = total + ore.weight end\n  local roll = math.random() * total\n  local cursor = 0\n  for _, ore in ipairs(Config.MiningSystem.ores) do\n    cursor = cursor + ore.weight\n    if roll <= cursor then TriggerClientEvent('mining:found', src, ore) return end\n  end\nend)\n`,
        stats: [stat("Filons", String(nodes.length)), stat("Minerais", String(ores.length))],
      };
    },
  }),
  moduleTool({
    slug: "farming-system",
    name: "Systeme de ferme",
    category: "gameplay",
    description: "Prepare les cultures, temps de pousse, arrosage et prix de vente.",
    icon: "Gamepad2",
    tags: ["ferme", "culture", "job"],
    fields: [
      { name: "cropsCsv", label: "Cultures (item,growth,price)", type: "textarea", rows: 4, default: "ble,10,12\nmais,15,18\ntomate,20,25" },
      { name: "growthMinutes", label: "Pousse (min)", type: "number", default: 30, min: 1, max: 1440 },
      { name: "waterItem", label: "Arrosage", type: "text", default: "watering_can" },
      { name: "sellPrice", label: "Prix de vente", type: "number", default: 20, min: 0 },
    ],
    build: (input) => {
      const crops = rows(input, "cropsCsv", ["item", "growth", "price"]).map((row) => ({ item: safeSlug(row.item, "culture"), growth: Math.max(1, Number(row.growth) || 10), price: Math.max(0, Number(row.price) || 0) }));
      return {
        data: { crops, growthMinutes: num(input, "growthMinutes", 30), waterItem: safeSlug(str(input, "waterItem", "watering_can")), sellPrice: num(input, "sellPrice", 20) },
        lua: `local planted = {}\n\nRegisterNetEvent('farming:plant', function(cropName)\n  local src = source\n  planted[src] = planted[src] or {}\n  planted[src][cropName] = os.time() + Config.FarmingSystem.growthMinutes * 60\nend)\n\nRegisterNetEvent('farming:harvest', function(cropName)\n  local src = source\n  local ready = planted[src] and planted[src][cropName]\n  if not ready or os.time() < ready then return end\n  planted[src][cropName] = nil\n  TriggerClientEvent('farming:harvested', src, cropName)\nend)\n`,
        stats: [stat("Cultures", String(crops.length)), stat("Pousse", `${num(input, "growthMinutes", 30)} min`)],
      };
    },
  }),
  moduleTool({
    slug: "delivery-job",
    name: "Metier de livraison",
    category: "gameplay",
    description: "Configure les depots, destinations, paiement et vehicule de livraison.",
    icon: "Gamepad2",
    tags: ["livraison", "job", "economie"],
    fields: [
      { name: "jobName", label: "Metier", type: "text", default: "livreur" },
      { name: "depot", label: "Depot", type: "text", default: "100, 200, 30" },
      { name: "destinationsCsv", label: "Destinations (name,x,y,z)", type: "textarea", rows: 4, default: "centre,200,300,30\nport,-500,800,20\ncolline,600,-200,40" },
      { name: "payPerKm", label: "Paiement / km", type: "number", default: 80, min: 0 },
      { name: "vehicle", label: "Vehicule", type: "text", default: "boxville" },
    ],
    build: (input) => {
      const destinations = rows(input, "destinationsCsv", ["name", "x", "y", "z"]).map((row) => ({ name: safeSlug(row.name, "destination"), coords: { x: Number(row.x) || 0, y: Number(row.y) || 0, z: Number(row.z) || 0 } }));
      return {
        data: { jobName: safeSlug(str(input, "jobName", "livreur")), depot: coordParts(str(input, "depot", "0,0,0")), destinations, payPerKm: num(input, "payPerKm", 80), vehicle: safeSlug(str(input, "vehicle", "boxville")) },
        lua: `RegisterNetEvent('delivery:complete', function(destinationName)\n  local src = source\n  for _, destination in ipairs(Config.DeliveryJob.destinations) do\n    if destination.name == destinationName then\n      local payout = math.floor(Config.DeliveryJob.payPerKm * 5)\n      TriggerClientEvent('delivery:paid', src, payout)\n      return\n    end\n  end\nend)\n`,
        stats: [stat("Destinations", String(destinations.length)), stat("Vehicule", str(input, "vehicle", "boxville"))],
      };
    },
  }),
  moduleTool({
    slug: "taxi-job",
    name: "Metier de taxi",
    category: "gameplay",
    description: "Prepare les tarifs, le depot et les appels clients du taxi.",
    icon: "Gamepad2",
    tags: ["taxi", "job", "transport"],
    fields: [
      { name: "jobName", label: "Metier", type: "text", default: "taxi" },
      { name: "depot", label: "Depot", type: "text", default: "100, 200, 30" },
      { name: "farePerKm", label: "Tarif / km", type: "number", default: 35, min: 0 },
      { name: "waitingFee", label: "Attente / min", type: "number", default: 15, min: 0 },
      { name: "npcCalls", label: "Appels PNJ", type: "switch", default: true },
    ],
    build: (input) => ({
      data: { jobName: safeSlug(str(input, "jobName", "taxi")), depot: coordParts(str(input, "depot", "0,0,0")), farePerKm: num(input, "farePerKm", 35), waitingFee: num(input, "waitingFee", 15), npcCalls: bool(input, "npcCalls", true) },
      lua: `RegisterNetEvent('taxi:request', function(pickup, destination)\n  local src = source\n  local distance = #(vector3(pickup.x, pickup.y, pickup.z) - vector3(destination.x, destination.y, destination.z))\n  local fare = math.floor(distance / 1000 * Config.TaxiJob.farePerKm)\n  TriggerClientEvent('taxi:offer', src, fare)\nend)\n`,
      stats: [stat("Tarif", `${num(input, "farePerKm", 35)} / km`), stat("PNJ", bool(input, "npcCalls", true) ? "Oui" : "Non")],
    }),
  }),
  moduleTool({
    slug: "mechanic-job",
    name: "Metier de mecanicien",
    category: "gameplay",
    description: "Configure l'atelier, les prix de reparation et le tuning.",
    icon: "Gamepad2",
    tags: ["mecano", "job", "vehicule"],
    fields: [
      { name: "jobName", label: "Metier", type: "text", default: "mecano" },
      { name: "shop", label: "Atelier", type: "text", default: "300, -500, 30" },
      { name: "repairPrice", label: "Reparation", type: "number", default: 500, min: 0 },
      { name: "tunePrice", label: "Tuning", type: "number", default: 1500, min: 0 },
      { name: "vehicle", label: "Vehicule de service", type: "text", default: "towtruck" },
    ],
    build: (input) => ({
      data: { jobName: safeSlug(str(input, "jobName", "mecano")), shop: coordParts(str(input, "shop", "0,0,0")), repairPrice: num(input, "repairPrice", 500), tunePrice: num(input, "tunePrice", 1500), vehicle: safeSlug(str(input, "vehicle", "towtruck")) },
      lua: `RegisterNetEvent('mechanic:repair', function(plate)\n  local src = source\n  local price = Config.MechanicJob.repairPrice\n  TriggerClientEvent('mechanic:charge', src, plate, price)\nend)\n`,
      stats: [stat("Reparation", formatNumber(num(input, "repairPrice", 500), 0)), stat("Tuning", formatNumber(num(input, "tunePrice", 1500), 0))],
    }),
  }),
  moduleTool({
    slug: "restaurant-job",
    name: "Metier de restaurant",
    category: "gameplay",
    description: "Prepare le restaurant, le menu, la preparation et les pourboires.",
    icon: "Gamepad2",
    tags: ["restaurant", "job", "nourriture"],
    fields: [
      { name: "jobName", label: "Metier", type: "text", default: "restaurant" },
      { name: "coords", label: "Coordonnees", type: "text", default: "200, 300, 30" },
      { name: "menuCsv", label: "Menu (item,label,price,prepTime)", type: "textarea", rows: 4, default: "burger,Burger,15,30\nfrites,Frites,8,20\nsoda,Soda,5,5" },
      { name: "prepTime", label: "Preparation (s)", type: "number", default: 30, min: 1, max: 300 },
      { name: "tipRate", label: "Pourboire (%)", type: "number", default: 10, min: 0, max: 50 },
    ],
    build: (input) => {
      const menu = rows(input, "menuCsv", ["item", "label", "price", "prepTime"]).map((row) => ({ item: safeSlug(row.item, "plat"), label: row.label || row.item, price: Math.max(0, Number(row.price) || 0), prepTime: Math.max(1, Number(row.prepTime) || 30) }));
      return {
        data: { jobName: safeSlug(str(input, "jobName", "restaurant")), coords: coordParts(str(input, "coords", "0,0,0")), menu, prepTime: num(input, "prepTime", 30), tipRate: num(input, "tipRate", 10) },
        lua: `RegisterNetEvent('restaurant:order', function(itemName)\n  local src = source\n  for _, item in ipairs(Config.RestaurantJob.menu) do\n    if item.item == itemName then\n      TriggerClientEvent('restaurant:prepare', src, item)\n      return\n    end\n  end\nend)\n`,
        stats: [stat("Plats", String(menu.length)), stat("Pourboire", `${num(input, "tipRate", 10)}%`)],
      };
    },
  }),
  moduleTool({
    slug: "bank-heist",
    name: "Braquage de banque",
    category: "gameplay",
    description: "Configure un braquage avec butin, police requise et recharge.",
    icon: "Gamepad2",
    tags: ["braquage", "police", "economie"],
    fields: [
      { name: "bankName", label: "Banque", type: "text", default: "Banque centrale" },
      { name: "coords", label: "Coordonnees", type: "text", default: "150, -1000, 30" },
      { name: "lootCsv", label: "Butin (item,min,max,weight)", type: "textarea", rows: 5, default: "cash,5000,15000,60\ngold_bar,1,3,25\nmarked_bills,10,30,15" },
      { name: "requiredCops", label: "Policiers requis", type: "number", default: 4, min: 0, max: 20 },
      { name: "cooldown", label: "Recharge (min)", type: "number", default: 60, min: 1, max: 1440 },
    ],
    build: (input) => {
      const loot = rows(input, "lootCsv", ["item", "min", "max", "weight"]).map((row) => ({ item: safeSlug(row.item, "butin"), min: Math.max(0, Number(row.min) || 0), max: Math.max(0, Number(row.max) || 0), weight: Math.max(1, Number(row.weight) || 1) }));
      return {
        data: { bankName: str(input, "bankName", "Banque"), coords: coordParts(str(input, "coords", "0,0,0")), loot, requiredCops: num(input, "requiredCops", 4), cooldown: num(input, "cooldown", 60) },
        lua: `local lastHeist = 0\n\nRegisterNetEvent('heist:start', function()\n  local src = source\n  if os.time() - lastHeist < Config.BankHeist.cooldown * 60 then return end\n  local cops = 0\n  for _, playerId in ipairs(GetPlayers()) do\n    if IsPlayerAceAllowed(playerId, 'job.police') then cops = cops + 1 end\n  end\n  if cops < Config.BankHeist.requiredCops then return end\n  lastHeist = os.time()\n  TriggerClientEvent('heist:started', src)\nend)\n`,
        stats: [stat("Butin", String(loot.length)), stat("Policiers", String(num(input, "requiredCops", 4)))],
      };
    },
  }),
  moduleTool({
    slug: "drug-lab",
    name: "Laboratoire de drogue",
    category: "gameplay",
    description: "Prepare un laboratoire avec recettes, alertes police et recharge.",
    icon: "Gamepad2",
    tags: ["laboratoire", "crime", "economie"],
    fields: [
      { name: "labName", label: "Laboratoire", type: "text", default: "Labo de Sandy" },
      { name: "coords", label: "Coordonnees", type: "text", default: "2000, 3000, 40" },
      { name: "recipesCsv", label: "Recettes (input,output,quantity,time)", type: "textarea", rows: 4, default: "chemical,weed,2,60\nchemical,coke,1,120" },
      { name: "policeAlert", label: "Alerte police", type: "switch", default: true },
      { name: "cooldown", label: "Recharge (min)", type: "number", default: 20, min: 1, max: 600 },
    ],
    build: (input) => {
      const recipes = rows(input, "recipesCsv", ["input", "output", "quantity", "time"]).map((row) => ({ input: safeSlug(row.input, "input"), output: safeSlug(row.output, "output"), quantity: Math.max(1, Number(row.quantity) || 1), time: Math.max(1, Number(row.time) || 60) }));
      return {
        data: { labName: str(input, "labName", "Laboratoire"), coords: coordParts(str(input, "coords", "0,0,0")), recipes, policeAlert: bool(input, "policeAlert", true), cooldown: num(input, "cooldown", 20) },
        lua: `local lastCraft = {}\n\nRegisterNetEvent('druglab:craft', function(recipeIndex)\n  local src = source\n  if os.time() - (lastCraft[src] or 0) < Config.DrugLab.cooldown * 60 then return end\n  local recipe = Config.DrugLab.recipes[recipeIndex]\n  if not recipe then return end\n  lastCraft[src] = os.time()\n  TriggerClientEvent('druglab:crafted', src, recipe)\n  if Config.DrugLab.policeAlert then\n    TriggerEvent('police:alert', ${luaString(str(input, "labName", "Laboratoire"))})\n  end\nend)\n`,
        stats: [stat("Recettes", String(recipes.length)), stat("Alerte", bool(input, "policeAlert", true) ? "Oui" : "Non")],
      };
    },
  }),
];
