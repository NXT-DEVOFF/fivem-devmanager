import {
  file,
  formatNumber,
  luaString,
  mdTable,
  num,
  parseTable,
  result,
  safeSlug,
  stat,
  str,
} from "../helpers";
import type { StudioTool } from "../types";

const frameworkOptions = [
  { value: "standalone", label: "Standalone" },
  { value: "qb", label: "QBCore" },
  { value: "esx", label: "ESX" },
  { value: "ox", label: "ox_lib / ox_inventory" },
];

export const gameplayTools: StudioTool[] = [
  {
    slug: "job-generator",
    name: "Generateur de metier",
    category: "gameplay",
    description: "Cree un metier avec grades, point de service, vehicules et framework.",
    icon: "BriefcaseBusiness",
    tags: ["job", "metier", "economie"],
    fields: [
      { name: "jobName", label: "Identifiant", type: "text", default: "vigneron", required: true },
      { name: "label", label: "Libelle", type: "text", default: "Vigneron" },
      { name: "framework", label: "Framework", type: "select", options: frameworkOptions, default: "standalone" },
      { name: "gradesCsv", label: "Grades (name,label,salary)", type: "textarea", rows: 4, default: "recrue,Recrue,500\nvigneron,Vigneron,900\nchef,Chef de cave,1500" },
      { name: "coords", label: "Point de service", type: "text", default: "0, 0, 0" },
      { name: "vehiclesCsv", label: "Vehicules (model)", type: "text", default: "burrito, tractor" },
    ],
    run: (input) => {
      const job = safeSlug(str(input, "jobName", "job"), "job");
      const grades = parseTable(str(input, "gradesCsv", ""), ["name", "label", "salary"]).map((row) => ({ name: safeSlug(row.name, "grade"), label: row.label || row.name, salary: Number(row.salary) || 0 }));
      const vehicles = str(input, "vehiclesCsv", "").split(",").map((value) => safeSlug(value.trim(), "")).filter(Boolean);
      const config = { job, label: str(input, "label", job), framework: str(input, "framework", "standalone"), coords: str(input, "coords", "0, 0, 0"), grades, vehicles };
      return result(`Metier ${job} genere (${grades.length} grades).`, [
        file("job.lua", `Config = Config or {}\nConfig.Job = ${JSON.stringify(config, null, 2)}\n\nRegisterNetEvent('${job}:startShift', function()\n  local src = source\n  print(('[${job}] prise de service par %s'):format(GetPlayerName(src)))\nend)\n`, "lua"),
        file("job.json", JSON.stringify(config, null, 2), "json"),
        file("README.md", `# ${config.label}\n\n- Grades : ${grades.map((grade) => grade.label).join(", ") || "aucun"}\n- Vehicules : ${vehicles.join(", ") || "aucun"}\n\nBranchez la creation d'emploi sur votre framework et verifiez les permissions cote serveur.\n`, "markdown"),
      ], { diagnostics: grades.length === 0 ? [{ level: "warning", message: "Aucun grade defini." }] : [], stats: [stat("Grades", String(grades.length)), stat("Vehicules", String(vehicles.length))] });
    },
  },
  {
    slug: "shop-generator",
    name: "Generateur de boutique",
    category: "gameplay",
    description: "Cree une boutique configurable avec articles, prix et coordonnees.",
    icon: "ShoppingBasket",
    tags: ["shop", "boutique", "items"],
    fields: [
      { name: "shopName", label: "Nom", type: "text", default: "Epicerie" },
      { name: "framework", label: "Framework", type: "select", options: frameworkOptions, default: "standalone" },
      { name: "coords", label: "Coordonnees", type: "text", default: "25.0, -1345.0, 29.0" },
      { name: "itemsCsv", label: "Articles (item,label,price,stock)", type: "textarea", rows: 6, default: "bread,Pain,5,100\nwater,Eau,3,100\nsandwich,Sandwich,8,50" },
    ],
    run: (input) => {
      const items = parseTable(str(input, "itemsCsv", ""), ["item", "label", "price", "stock"]).map((row) => ({ item: safeSlug(row.item, "item"), label: row.label || row.item, price: Number(row.price) || 0, stock: Number(row.stock) || 0 }));
      const shop = { name: str(input, "shopName", "Boutique"), framework: str(input, "framework", "standalone"), coords: str(input, "coords", "0, 0, 0"), items };
      return result(`Boutique ${shop.name} generee (${items.length} articles).`, [
        file("shop.lua", `Config = Config or {}\nConfig.Shop = ${JSON.stringify(shop, null, 2)}\n\nRegisterNetEvent('shop:buy', function(itemName, quantity)\n  local src = source\n  local item\n  for _, entry in ipairs(Config.Shop.items) do\n    if entry.item == itemName then item = entry break end\n  end\n  if not item then return end\n  quantity = math.max(1, math.min(tonumber(quantity) or 1, 10))\n  if item.stock < quantity then return end\n  item.stock = item.stock - quantity\n  print(('[shop] %s achete %dx %s'):format(GetPlayerName(src), quantity, item.label))\nend)\n`, "lua"),
        file("shop.json", JSON.stringify(shop, null, 2), "json"),
      ], { stats: [stat("Articles", String(items.length)), stat("Framework", shop.framework)] });
    },
  },
  {
    slug: "loot-table",
    name: "Table de loot",
    category: "gameplay",
    description: "Genere une table de loot ponderee et sa fonction Lua de tirage.",
    icon: "Gift",
    tags: ["loot", "hasard", "gameplay"],
    fields: [
      { name: "tableName", label: "Nom de la table", type: "text", default: "coffre_cambriolage" },
      { name: "rolls", label: "Tirages", type: "number", default: 2, min: 1, max: 20 },
      { name: "entriesCsv", label: "Entrees (item,weight,min,max)", type: "textarea", rows: 7, default: "bread,40,1,3\nwater,30,1,2\nlockpick,20,1,1\nrolex,5,1,1\nweed,5,1,2" },
    ],
    run: (input) => {
      const tableName = safeSlug(str(input, "tableName", "loot"), "loot");
      const rolls = Math.max(1, Math.min(20, num(input, "rolls", 2)));
      const entries = parseTable(str(input, "entriesCsv", ""), ["item", "weight", "min", "max"]).map((row) => ({ item: safeSlug(row.item, "item"), weight: Math.max(1, Number(row.weight) || 1), min: Math.max(1, Number(row.min) || 1), max: Math.max(1, Number(row.max) || 1) }));
      const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
      const lua = `Config = Config or {}\nConfig.Loot = ${JSON.stringify({ tableName, rolls, entries }, null, 2)}\n\nlocal function pickWeighted()\n  local total = 0\n  for _, entry in ipairs(Config.Loot.entries) do total = total + entry.weight end\n  local roll = math.random() * total\n  local cursor = 0\n  for _, entry in ipairs(Config.Loot.entries) do\n    cursor = cursor + entry.weight\n    if roll <= cursor then return entry end\n  end\n  return Config.Loot.entries[1]\nend\n\nfunction RollLoot()\n  local loot = {}\n  for _ = 1, Config.Loot.rolls do\n    local entry = pickWeighted()\n    local quantity = math.random(entry.min, entry.max)\n    loot[entry.item] = (loot[entry.item] or 0) + quantity\n  end\n  return loot\nend\n`;
      return result(`Table ${tableName} generee (${entries.length} entrees, ${rolls} tirages).`, [
        file("loot.lua", lua, "lua"),
        file("loot.json", JSON.stringify({ tableName, rolls, entries, totalWeight: total }, null, 2), "json"),
      ], { diagnostics: entries.length === 0 ? [{ level: "error", message: "Aucune entree de loot." }] : [], stats: [stat("Entrees", String(entries.length)), stat("Poids total", String(total))] });
    },
  },
  {
    slug: "xp-curve",
    name: "Courbe d'XP",
    category: "gameplay",
    description: "Genere une courbe d'XP, un tableau de niveaux et les fonctions Lua associees.",
    icon: "TrendingUp",
    tags: ["xp", "niveau", "progression"],
    fields: [
      { name: "startXp", label: "XP niveau 1", type: "number", default: 100, min: 1 },
      { name: "multiplier", label: "Multiplicateur", type: "number", default: 1.35, step: 0.01, min: 1 },
      { name: "maxLevel", label: "Niveau max", type: "number", default: 50, min: 2, max: 200 },
    ],
    run: (input) => {
      const start = num(input, "startXp", 100);
      const multiplier = Math.max(1, num(input, "multiplier", 1.35));
      const maxLevel = Math.max(2, Math.min(200, num(input, "maxLevel", 50)));
      const levels = Array.from({ length: maxLevel }, (_, index) => Math.round(start * multiplier ** index));
      const lua = `Config = Config or {}\nConfig.XP = { start = ${start}, multiplier = ${multiplier}, maxLevel = ${maxLevel} }\n\nfunction XpForLevel(level)\n  return math.floor(Config.XP.start * (Config.XP.multiplier ^ math.max(0, level - 1)))\nend\n\nfunction LevelFromXp(xp)\n  local level = 1\n  while level < Config.XP.maxLevel and xp >= XpForLevel(level) do\n    xp = xp - XpForLevel(level)\n    level = level + 1\n  end\n  return level, xp\nend\n`;
      return result(`Courbe d'XP generee pour ${maxLevel} niveaux.`, [
        file("xp.lua", lua, "lua"),
        file("xp-curve.csv", ["level,xp", ...levels.map((xp, index) => `${index + 1},${xp}`)].join("\n"), "csv"),
        file("xp-table.md", mdTable(["Niveau", "XP requis"], levels.slice(0, 20).map((xp, index) => [String(index + 1), formatNumber(xp, 0)])), "markdown"),
      ], { stats: [stat("Niveaux", String(maxLevel)), stat("XP max", formatNumber(levels.at(-1) ?? 0, 0))] });
    },
  },
  {
    slug: "housing-config",
    name: "Configuration de logement",
    category: "gameplay",
    description: "Cree une maison avec prix, interieur, garage et proprietaire.",
    icon: "House",
    tags: ["housing", "maison", "economie"],
    fields: [
      { name: "houseName", label: "Nom", type: "text", default: "Villa Vespucci" },
      { name: "coords", label: "Coordonnees", type: "text", default: "-1000.0, -500.0, 30.0" },
      { name: "price", label: "Prix", type: "number", default: 250000, min: 0 },
      { name: "interior", label: "Interieur", type: "text", default: "modern_01" },
      { name: "slots", label: "Emplacements", type: "number", default: 4, min: 1, max: 20 },
      { name: "hasGarage", label: "Garage", type: "switch", default: true },
    ],
    run: (input) => {
      const house = { name: str(input, "houseName", "Maison"), coords: str(input, "coords", "0, 0, 0"), price: num(input, "price", 0), interior: str(input, "interior", "modern_01"), slots: num(input, "slots", 4), garage: str(input, "hasGarage", "true") === "true", owner: null };
      return result(`Logement ${house.name} configure.`, [
        file("housing.lua", `Config = Config or {}\nConfig.Houses = ${JSON.stringify([house], null, 2)}\n`, "lua"),
        file("house.json", JSON.stringify(house, null, 2), "json"),
        file("housing.sql", `CREATE TABLE IF NOT EXISTS housing (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  name VARCHAR(120) NOT NULL,\n  owner VARCHAR(120) NULL,\n  price INT NOT NULL DEFAULT 0,\n  interior VARCHAR(80) NOT NULL,\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);\n`, "sql"),
      ], { stats: [stat("Prix", formatNumber(house.price, 0)), stat("Emplacements", String(house.slots))] });
    },
  },
  {
    slug: "phone-app",
    name: "Application telephone",
    category: "gameplay",
    description: "Genere le scaffold d'une application telephone NUI avec endpoints.",
    icon: "Smartphone",
    tags: ["phone", "nui", "application"],
    fields: [
      { name: "appName", label: "Nom", type: "text", default: "MonApp" },
      { name: "appId", label: "Identifiant", type: "text", default: "monapp" },
      { name: "description", label: "Description", type: "text", default: "Application FiveM" },
      { name: "framework", label: "Framework", type: "select", options: frameworkOptions, default: "standalone" },
      { name: "endpointsCsv", label: "Endpoints (name,description)", type: "textarea", rows: 4, default: "list,Lister les elements\ncreate,Creer un element" },
    ],
    run: (input) => {
      const appId = safeSlug(str(input, "appId", "monapp"), "monapp");
      const endpoints = parseTable(str(input, "endpointsCsv", ""), ["name", "description"]);
      return result(`Application ${appId} generee.`, [
        file("fxmanifest.lua", `fx_version 'cerulean'\ngame 'gta5'\n\nui_page 'ui/index.html'\n\nfiles {\n  'ui/index.html',\n  'ui/style.css',\n  'ui/script.js',\n}\n\nclient_script 'client.lua'\nserver_script 'server.lua'\n`, "lua"),
        file("client.lua", `local appId = ${luaString(appId)}\n\nRegisterNUICallback('${appId}:list', function(_, cb)\n  local items = lib.callback.await('${appId}:list', false)\n  cb({ items = items })\nend)\n\nRegisterCommand('${appId}', function()\n  SetNuiFocus(true, true)\n  SendNUIMessage({ type = 'open', app = appId })\nend, false)\n`, "lua"),
        file("server.lua", `lib.callback.register('${appId}:list', function(source)\n  -- TODO: remplacer par une vraie requete et verifier la permission.\n  return {}\nend)\n`, "lua"),
        file("ui/index.html", `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="style.css"><title>${appId}</title></head>\n<body><main id="app"><h1>${str(input, "appName", appId)}</h1><p>${str(input, "description", "")}</p><button id="refresh">Rafraichir</button><pre id="output"></pre></main><script src="script.js"></script></body></html>\n`, "html"),
        file("ui/script.js", `const output = document.getElementById('output')\nconst refresh = document.getElementById('refresh')\n\nrefresh.addEventListener('click', async () => {\n  const result = await fetch('https://${appId}/list', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })\n  output.textContent = JSON.stringify(await result.json(), null, 2)\n})\n\nwindow.addEventListener('message', (event) => {\n  if (event.data.type === 'open') document.body.classList.add('visible')\n})\n`, "javascript"),
        file("ui/style.css", `body { margin: 0; font-family: system-ui, sans-serif; background: transparent; color: #fff; }\n#app { display: none; max-width: 360px; margin: 10vh auto; padding: 20px; border-radius: 18px; background: #111827; border: 1px solid #263247; }\nbody.visible #app { display: block; }\nbutton { padding: 8px 12px; border: 0; border-radius: 8px; background: #5865f2; color: #fff; cursor: pointer; }\npre { white-space: pre-wrap; font-size: 12px; }\n`, "css"),
        file("README.md", `# ${str(input, "appName", appId)}\n\nEndpoints :\n\n${endpoints.map((endpoint) => `- ${endpoint.name} : ${endpoint.description}`).join("\n") || "- Aucun"}\n\nAdaptez l'integration a votre telephone (qb-phone, ox_inventory, etc.).\n`, "markdown"),
      ], { stats: [stat("Endpoints", String(endpoints.length)), stat("Framework", str(input, "framework", "standalone"))] });
    },
  },
  {
    slug: "dispatch-preset",
    name: "Preset dispatch",
    category: "gameplay",
    description: "Genere une configuration dispatch pour police, pompiers, EMS ou mecano.",
    icon: "Siren",
    tags: ["dispatch", "police", "urgence"],
    fields: [
      { name: "preset", label: "Preset", type: "select", options: [{ value: "police", label: "Police" }, { value: "fire", label: "Pompiers" }, { value: "ems", label: "EMS" }, { value: "mechanic", label: "Mecano" }], default: "police" },
      { name: "unitsCsv", label: "Unites (name,label,color)", type: "textarea", rows: 4, default: "LSPD,Police,blue\nBCSO,Sheriff,brown\nSAHP,Highway,black" },
      { name: "codesCsv", label: "Codes (code,label,priority)", type: "textarea", rows: 5, default: "10-31,Cambriolage,2\n10-50,Accident,1\n10-52,Urgence medicale,1" },
    ],
    run: (input) => {
      const preset = str(input, "preset", "police");
      const units = parseTable(str(input, "unitsCsv", ""), ["name", "label", "color"]);
      const codes = parseTable(str(input, "codesCsv", ""), ["code", "label", "priority"]);
      return result(`Dispatch ${preset} genere (${units.length} unites, ${codes.length} codes).`, [
        file("dispatch.lua", `Config = Config or {}\nConfig.Dispatch = ${JSON.stringify({ preset, units, codes }, null, 2)}\n\nfunction GetDispatchCode(code)\n  for _, entry in ipairs(Config.Dispatch.codes) do\n    if entry.code == code then return entry end\n  end\n  return nil\nend\n`, "lua"),
        file("dispatch.json", JSON.stringify({ preset, units, codes }, null, 2), "json"),
        file("README.md", `# Dispatch ${preset}\n\nBranchez les codes sur votre systeme d'appels et verifiez les permissions par metier.\n`, "markdown"),
      ], { stats: [stat("Unites", String(units.length)), stat("Codes", String(codes.length))] });
    },
  },
  {
    slug: "weather-cycle",
    name: "Cycle meteo",
    category: "gameplay",
    description: "Genere un cycle meteo et un cycle jour/nuit configurables.",
    icon: "CloudSun",
    tags: ["meteo", "temps", "cycles"],
    fields: [
      { name: "cycleMinutes", label: "Duree d'un cycle (min)", type: "number", default: 30, min: 1 },
      { name: "weatherCsv", label: "Meteos (nom,poids)", type: "textarea", rows: 5, default: "CLEAR,40\nCLOUDS,25\nOVERCAST,15\nRAIN,15\nTHUNDER,5" },
      { name: "timeStart", label: "Heure de depart", type: "number", default: 8, min: 0, max: 23 },
      { name: "dynamic", label: "Cycle dynamique", type: "switch", default: true },
    ],
    run: (input) => {
      const weathers = parseTable(str(input, "weatherCsv", ""), ["name", "weight"]).map((row) => ({ name: row.name.toLowerCase(), weight: Math.max(1, Number(row.weight) || 1) }));
      const cycle = Math.max(1, num(input, "cycleMinutes", 30));
      const total = weathers.reduce((sum, weather) => sum + weather.weight, 0);
      return result(`Cycle meteo de ${cycle} minutes genere.`, [
        file("weather.lua", `Config = Config or {}\nConfig.Weather = ${JSON.stringify({ cycleMinutes: cycle, timeStart: num(input, "timeStart", 8), dynamic: str(input, "dynamic", "true") === "true", weathers }, null, 2)}\n\nlocal totalWeight = ${total}\n\nlocal function pickWeather()\n  local roll = math.random() * totalWeight\n  local cursor = 0\n  for _, weather in ipairs(Config.Weather.weathers) do\n    cursor = cursor + weather.weight\n    if roll <= cursor then return weather.name end\n  end\n  return Config.Weather.weathers[1].name\nend\n\nCreateThread(function()\n  while true do\n    if Config.Weather.dynamic then\n      SetWeatherOverride(pickWeather())\n    end\n    Wait(Config.Weather.cycleMinutes * 60 * 1000)\n  end\nend)\n`, "lua"),
        file("weather.json", JSON.stringify({ cycleMinutes: cycle, weathers, totalWeight: total }, null, 2), "json"),
      ], { stats: [stat("Meteos", String(weathers.length)), stat("Cycle", `${cycle} min`)] });
    },
  },
  {
    slug: "wanted-system",
    name: "Systeme de recherche",
    category: "gameplay",
    description: "Configure les etoiles de recherche, les crimes et la decroissance.",
    icon: "BadgeAlert",
    tags: ["police", "recherche", "crime"],
    fields: [
      { name: "maxStars", label: "Etoiles max", type: "number", default: 5, min: 1, max: 5 },
      { name: "decaySeconds", label: "Decroissance (secondes)", type: "number", default: 60, min: 5 },
      { name: "crimesCsv", label: "Crimes (name,stars,fine)", type: "textarea", rows: 6, default: "vol,1,500\nagression,2,1500\nbraquage,3,5000\nfuite,1,0" },
      { name: "policeJobsCsv", label: "Metiers police", type: "text", default: "police, sheriff" },
    ],
    run: (input) => {
      const crimes = parseTable(str(input, "crimesCsv", ""), ["name", "stars", "fine"]).map((row) => ({ name: safeSlug(row.name, "crime"), stars: Math.min(5, Math.max(1, Number(row.stars) || 1)), fine: Number(row.fine) || 0 }));
      const jobs = str(input, "policeJobsCsv", "").split(",").map((job) => safeSlug(job.trim(), "")).filter(Boolean);
      return result(`Systeme de recherche configure (${crimes.length} crimes).`, [
        file("wanted.lua", `Config = Config or {}\nConfig.Wanted = ${JSON.stringify({ maxStars: num(input, "maxStars", 5), decaySeconds: num(input, "decaySeconds", 60), crimes, policeJobs: jobs }, null, 2)}\n\nfunction AddWanted(playerId, crimeName)\n  for _, crime in ipairs(Config.Wanted.crimes) do\n    if crime.name == crimeName then\n      TriggerClientEvent('wanted:update', playerId, crime.stars)\n      return crime\n    end\n  end\nend\n`, "lua"),
        file("wanted.json", JSON.stringify({ crimes, policeJobs: jobs }, null, 2), "json"),
      ], { stats: [stat("Crimes", String(crimes.length)), stat("Etoiles max", String(num(input, "maxStars", 5)))] });
    },
  },
  {
    slug: "quest-generator",
    name: "Generateur de quete",
    category: "gameplay",
    description: "Cree une quete avec etapes, PNJ, recompenses et suivi de progression.",
    icon: "Scroll",
    tags: ["quete", "mission", "gameplay"],
    fields: [
      { name: "questName", label: "Nom", type: "text", default: "Le colis perdu" },
      { name: "framework", label: "Framework", type: "select", options: frameworkOptions, default: "standalone" },
      { name: "npcCoords", label: "PNJ", type: "text", default: "100.0, 200.0, 30.0" },
      { name: "stepsCsv", label: "Etapes (name,label,coords)", type: "textarea", rows: 5, default: "depart,Parler au PNJ,100,200,30\ncolis,Recuperer le colis,150,220,30\nretour,Revenir au PNJ,100,200,30" },
      { name: "rewardsCsv", label: "Recompenses (item,quantity,money)", type: "textarea", rows: 4, default: "bread,2,0\n,0,5000" },
    ],
    run: (input) => {
      const quest = safeSlug(str(input, "questName", "quete"), "quete");
      const steps = parseTable(str(input, "stepsCsv", ""), ["name", "label", "coords"]).map((row) => ({ name: safeSlug(row.name, "step"), label: row.label || row.name, coords: row.coords || "0,0,0" }));
      const rewards = parseTable(str(input, "rewardsCsv", ""), ["item", "quantity", "money"]).map((row) => ({ item: row.item, quantity: Number(row.quantity) || 0, money: Number(row.money) || 0 }));
      return result(`Quete ${quest} generee avec ${steps.length} etapes.`, [
        file("quest.lua", `Config = Config or {}\nConfig.Quest = ${JSON.stringify({ quest, framework: str(input, "framework", "standalone"), npcCoords: str(input, "npcCoords", "0,0,0"), steps, rewards }, null, 2)}\n\nlocal progress = {}\n\nRegisterNetEvent('quest:advance', function(stepName)\n  local src = source\n  local questData = Config.Quest\n  local index = (progress[src] or 0) + 1\n  local step = questData.steps[index]\n  if not step or step.name ~= stepName then return end\n  progress[src] = index\n  if index >= #questData.steps then\n    for _, reward in ipairs(questData.rewards) do\n      print(('[quest] %s recoit %s x%d et %d$'):format(GetPlayerName(src), reward.item, reward.quantity, reward.money))\n    end\n    progress[src] = nil\n  end\nend)\n`, "lua"),
        file("quest.json", JSON.stringify({ quest, steps, rewards }, null, 2), "json"),
        file("README.md", `# ${str(input, "questName", quest)}\n\nEtapes :\n\n${steps.map((step, index) => `${index + 1}. ${step.label} (${step.coords})`).join("\n")}\n\nVerifiez les coordonnees et les recompenses cote serveur.\n`, "markdown"),
      ], { stats: [stat("Etapes", String(steps.length)), stat("Recompenses", String(rewards.length))] });
    },
  },
];
