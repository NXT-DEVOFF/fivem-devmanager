import { file, num, safeSlug, sqlIdentifier as sqlName, stat, str } from "../helpers";
import { coordParts, moduleTool, rows } from "./modules-shared";
import type { StudioDiagnostic, StudioTool } from "../types";

interface Ingredient {
  item: string;
  quantity: number;
}

interface Recipe {
  name: string;
  label: string;
  station: string;
  ingredients: Ingredient[];
  output: string;
  quantity: number;
  time: number;
  cooldown: number;
}

const DEFAULT_STATIONS = `cuisine,Cuisine,100,200,30,2.5
etabli,Etabli,110,200,30,2.5`;
const DEFAULT_RECIPES = `burger,Burger,cuisine,viande:1|pain:1,burger,1,8,15
eau,Eau purifiee,cuisine,bouteille_vide:1|eau_sale:1,eau,1,5,10
kit,K kit reparation,etabli,fer:2|plastic:1,repair_kit,1,15,60`;
const DEFAULT_FACTIONS = `citizens,Citoyens,0,0,100
police,Police,0,-100,100`;
const DEFAULT_ACTIONS = `help,citizens,5,60,Aide un joueur
report,citizens,3,120,Signale un probleme
crime,police,-10,120,Infraction constatee`;
const DEFAULT_SKILLS = `endurance,Endurance,5,2,
force,Force,5,3,endurance
crochetage,Crochetage,3,4,
medecine,Medecine,4,5,endurance`;

export const gameplayAdvancedTools: StudioTool[] = [
  moduleTool({
    slug: "crafting-system",
    name: "Systeme de fabrication",
    category: "gameplay",
    description:
      "Genere un atelier complet : stations, recettes, ingredients, progression client, validation serveur et journal SQL.",
    icon: "Wrench",
    tags: ["craft", "fabrication", "inventaire", "framework", "sql"],
    fields: [
      { name: "resourceName", label: "Ressource", type: "text", default: "fdm_crafting", required: true },
      { name: "framework", label: "Framework", type: "select", options: [{ value: "ox", label: "ox_inventory" }, { value: "esx", label: "ESX" }, { value: "qb", label: "QBCore" }], default: "ox" },
      { name: "stationsCsv", label: "Stations (name,label,x,y,z,radius)", type: "textarea", rows: 6, default: DEFAULT_STATIONS, required: true },
      { name: "recipesCsv", label: "Recettes (name,label,station,ingredients,output,quantity,time,cooldown)", type: "textarea", rows: 8, default: DEFAULT_RECIPES, required: true },
      { name: "logToSql", label: "Journaliser les fabrications", type: "switch", default: true },
      { name: "logTable", label: "Table de journal", type: "text", default: "craft_log" },
    ],
    build: (input) => {
      const resource = safeSlug(str(input, "resourceName", "fdm_crafting"), "fdm_crafting");
      const framework = ["ox", "esx", "qb"].includes(str(input, "framework", "ox")) ? str(input, "framework", "ox") : "ox";
      const logToSql = input.logToSql === undefined ? true : input.logToSql === true || input.logToSql === "true";
      const logTable = sqlName(str(input, "logTable", "craft_log"), "craft_log");
      const stations = rows(input, "stationsCsv", ["name", "label", "x", "y", "z", "radius"]).map((row) => ({
        name: safeSlug(row.name, "station"),
        label: row.label || row.name || "Station",
        coords: coordParts(`${row.x || 0}, ${row.y || 0}, ${row.z || 0}`),
        radius: Math.max(1, Number(row.radius) || 2.5),
      }));
      const stationNames = new Set(stations.map((station) => station.name));
      const diagnostics: StudioDiagnostic[] = [];
      if (stations.length === 0) diagnostics.push({ level: "error", message: "Aucune station definie.", field: "stationsCsv" });

      const recipes: Recipe[] = rows(input, "recipesCsv", ["name", "label", "station", "ingredients", "output", "quantity", "time", "cooldown"]).map((row) => {
        const ingredients = (row.ingredients || "")
          .split("|")
          .map((entry) => {
            const [item, quantity] = entry.split(":");
            return { item: safeSlug(item || "", "item"), quantity: Math.max(1, Number(quantity) || 1) };
          })
          .filter((entry) => entry.item !== "");
        return {
          name: safeSlug(row.name, "recipe"),
          label: row.label || row.name || "Recette",
          station: safeSlug(row.station, "station"),
          ingredients,
          output: safeSlug(row.output, "item"),
          quantity: Math.max(1, Number(row.quantity) || 1),
          time: Math.max(1, Math.min(120, Number(row.time) || 5)),
          cooldown: Math.max(0, Math.min(3600, Number(row.cooldown) || 0)),
        };
      });
      if (recipes.length === 0) diagnostics.push({ level: "error", message: "Aucune recette definie.", field: "recipesCsv" });
      for (const recipe of recipes) {
        if (!stationNames.has(recipe.station)) diagnostics.push({ level: "warning", message: `Recette ${recipe.name} : station ${recipe.station} inconnue.` });
        if (recipe.ingredients.length === 0) diagnostics.push({ level: "error", message: `Recette ${recipe.name} : aucun ingredient.` });
      }

      const dependency = framework === "ox" ? "'ox_inventory'" : framework === "esx" ? "'es_extended'" : "'qb-core'";
      const fxmanifest = `fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name '${resource}'
description 'Systeme de fabrication genere par FiveM DevManager'
version '1.0.0'

dependencies {
  'oxmysql',
  'ox_lib',
  ${dependency},
}

shared_scripts {
  'crafting-system.lua',
}

server_scripts {
  'server/crafting.lua',
}

client_scripts {
  'client/crafting.lua',
}
`;

      const schema = logToSql
        ? `CREATE TABLE IF NOT EXISTS ${logTable} (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  identifier VARCHAR(80) NOT NULL,
  recipe VARCHAR(64) NOT NULL,
  output_item VARCHAR(64) NOT NULL,
  quantity INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_craft_log_actor (identifier, created_at),
  INDEX idx_craft_log_recipe (recipe, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`
        : "";

      const server = `local framework = Config.CraftingSystem.framework
local stations = Config.CraftingSystem.stations
local recipes = Config.CraftingSystem.recipes
local logTable = Config.CraftingSystem.logTable
local logToSql = Config.CraftingSystem.logToSql
local cooldowns = {}
local ESX, QBCore

if framework == 'esx' then
  ESX = exports['es_extended']:getSharedObject()
elseif framework == 'qb' then
  QBCore = exports['qb-core']:GetCoreObject()
end

local function notify(source, message, kind)
  TriggerClientEvent('crafting:client:notify', source, message, kind or 'inform')
end

local function identifier(source)
  if framework == 'esx' and ESX then
    local player = ESX.GetPlayerFromId(source)
    return player and player.identifier or nil
  end
  if framework == 'qb' and QBCore then
    local player = QBCore.Functions.GetPlayer(source)
    return player and player.PlayerData.citizenid or nil
  end
  return GetPlayerIdentifierByType(source, 'license')
end

local function countItem(source, item)
  if framework == 'ox' then
    return tonumber(exports.ox_inventory:GetItemCount(source, item)) or 0
  end
  if framework == 'esx' and ESX then
    local player = ESX.GetPlayerFromId(source)
    local entry = player and player.getInventoryItem(item)
    return entry and tonumber(entry.count) or 0
  end
  if framework == 'qb' and QBCore then
    local player = QBCore.Functions.GetPlayer(source)
    local entry = player and player.Functions.GetItemByName(item)
    return entry and tonumber(entry.amount) or 0
  end
  return 0
end

local function removeItem(source, item, quantity)
  if framework == 'ox' then
    return exports.ox_inventory:RemoveItem(source, item, quantity)
  end
  if framework == 'esx' and ESX then
    local player = ESX.GetPlayerFromId(source)
    if not player then return false end
    player.removeInventoryItem(item, quantity)
    return true
  end
  if framework == 'qb' and QBCore then
    local player = QBCore.Functions.GetPlayer(source)
    if not player then return false end
    return player.Functions.RemoveItem(item, quantity)
  end
  return false
end

local function addItem(source, item, quantity)
  if framework == 'ox' then
    return exports.ox_inventory:AddItem(source, item, quantity)
  end
  if framework == 'esx' and ESX then
    local player = ESX.GetPlayerFromId(source)
    if not player then return false end
    player.addInventoryItem(item, quantity)
    return true
  end
  if framework == 'qb' and QBCore then
    local player = QBCore.Functions.GetPlayer(source)
    if not player then return false end
    return player.Functions.AddItem(item, quantity)
  end
  return false
end

local function nearestStation(source, stationName)
  local ped = GetPlayerPed(source)
  if ped == 0 then return false end
  local coords = GetEntityCoords(ped)
  for _, station in ipairs(stations) do
    if station.name == stationName then
      return #(coords - vector3(station.coords.x, station.coords.y, station.coords.z)) <= station.radius
    end
  end
  return false
end

RegisterNetEvent('crafting:server:craft', function(recipeName)
  local source = source
  local actor = identifier(source)
  if not actor then return end

  local recipe
  for _, entry in ipairs(recipes) do
    if entry.name == tostring(recipeName) then recipe = entry break end
  end
  if not recipe then
    notify(source, 'Recette inconnue.', 'error')
    return
  end
  if not nearestStation(source, recipe.station) then
    notify(source, 'Vous devez etre a la station ' .. recipe.station .. '.', 'error')
    return
  end

  local key = ('%s:%s'):format(actor, recipe.name)
  local now = os.time()
  if cooldowns[key] and now - cooldowns[key] < (recipe.time + recipe.cooldown) then
    notify(source, 'Cette recette est encore en recharge.', 'error')
    return
  end

  for _, ingredient in ipairs(recipe.ingredients) do
    if countItem(source, ingredient.item) < ingredient.quantity then
      notify(source, ('Ingredient manquant : %s x%d.'):format(ingredient.item, ingredient.quantity), 'error')
      return
    end
  end

  local removed = {}
  for _, ingredient in ipairs(recipe.ingredients) do
    if not removeItem(source, ingredient.item, ingredient.quantity) then
      for _, entry in ipairs(removed) do
        addItem(source, entry.item, entry.quantity)
      end
      notify(source, 'La fabrication a echoue, ingredients rembourses.', 'error')
      return
    end
    removed[#removed + 1] = ingredient
  end

  if not addItem(source, recipe.output, recipe.quantity) then
    for _, entry in ipairs(removed) do
      addItem(source, entry.item, entry.quantity)
    end
    notify(source, 'Inventaire plein : fabrication annulee.', 'error')
    return
  end

  cooldowns[key] = now
  notify(source, ('%s fabrique : %s x%d.'):format(recipe.label, recipe.output, recipe.quantity), 'success')
  TriggerEvent('fdm:crafting:completed', source, actor, recipe)

  if logToSql then
    local ok, err = pcall(function()
      MySQL.insert.await(
        ('INSERT INTO %s (identifier, recipe, output_item, quantity) VALUES (?, ?, ?, ?)'):format(logTable),
        { actor, recipe.name, recipe.output, recipe.quantity }
      )
    end)
    if not ok then
      print(('[crafting] journal impossible : %s'):format(tostring(err)))
    end
  end
end)

exports('GetRecipe', function(name)
  for _, recipe in ipairs(recipes) do
    if recipe.name == name then return recipe end
  end
  return nil
end)
`;

      const client = `local recipes = Config.CraftingSystem.recipes

local function findRecipe(name)
  for _, recipe in ipairs(recipes) do
    if recipe.name == name then return recipe end
  end
  return nil
end

RegisterNetEvent('crafting:client:notify', function(message, kind)
  lib.notify({ description = tostring(message), type = kind or 'inform' })
end)

RegisterCommand('craft', function(_, args)
  local recipe = findRecipe(tostring(args[1] or ''))
  if not recipe then
    lib.notify({ description = 'Usage : /craft <recette>', type = 'error' })
    return
  end

  local progress = lib.progressBar({
    duration = recipe.time * 1000,
    label = ('Fabrication : %s'):format(recipe.label),
    canCancel = true,
    disableMovement = true,
    disableCarMovement = true,
    disableCombat = true,
  })

  if not progress then
    lib.notify({ description = 'Fabrication annulee.', type = 'error' })
    return
  end

  TriggerServerEvent('crafting:server:craft', recipe.name)
end, false)

TriggerEvent('chat:addSuggestion', '/craft', 'Fabrique une recette a la station la plus proche', {
  { name = 'recette', help = table.concat((function()
    local names = {}
    for _, recipe in ipairs(recipes) do names[#names + 1] = recipe.name end
    return names
  end)(), ', ') },
})
`;

      const readme = `# ${resource}

Systeme de fabrication pour ${framework === "ox" ? "ox_inventory" : framework === "esx" ? "ESX" : "QBCore"}.

## Installation

1. ${logToSql ? "Importez `schema.sql` dans la base." : "Aucun schema SQL n'est necessaire."}
2. Placez la ressource apres \`oxmysql\`, \`ox_lib\` et votre inventaire.
3. Adaptez les stations et les recettes dans la configuration.
4. Testez chaque recette avec un inventaire de development.

## Commandes

- \`/craft <recette>\` : lance la fabrication si le joueur est a la station.

## Securite

- Les ingredients sont verifies cote serveur.
- Les retraits sont rembourses si une etape echoue.
- Le joueur doit etre a portee de la station.
- Le cooldown inclut le temps de fabrication.
- Le client ne peut pas ajouter l'objet lui-meme : seul le serveur le fait.
`;

      return {
        data: { resourceName: resource, framework, logToSql, logTable, stations, recipes },
        ...(logToSql ? { sql: schema } : {}),
        lua: `function GetCraftingRecipe(name)
  for _, recipe in ipairs(Config.CraftingSystem.recipes) do
    if recipe.name == name then return recipe end
  end
  return nil
end
`,
        files: [
          file("fxmanifest.lua", fxmanifest, "lua"),
          file("server/crafting.lua", server, "lua"),
          file("client/crafting.lua", client, "lua"),
        ],
        readme,
        stats: [
          stat("Recettes", String(recipes.length), recipes.length ? "success" : "danger"),
          stat("Stations", String(stations.length)),
          stat("Framework", framework.toUpperCase()),
        ],
        diagnostics,
      };
    },
  }),
  moduleTool({
    slug: "reputation-system",
    name: "Systeme de reputation",
    category: "gameplay",
    description:
      "Genere des factions, actions, cooldowns, grades et une progression de reputation stockee en SQL.",
    icon: "TrendingUp",
    tags: ["reputation", "faction", "progression", "sql", "economie"],
    fields: [
      { name: "resourceName", label: "Ressource", type: "text", default: "fdm_reputation", required: true },
      { name: "table", label: "Table SQL", type: "text", default: "player_reputation" },
      { name: "factionsCsv", label: "Factions (name,label,start,min,max)", type: "textarea", rows: 5, default: DEFAULT_FACTIONS, required: true },
      { name: "actionsCsv", label: "Actions (action,faction,amount,cooldown,description)", type: "textarea", rows: 5, default: DEFAULT_ACTIONS },
      { name: "adminAce", label: "Permission admin", type: "text", default: "fdm.reputation.admin" },
      { name: "command", label: "Commande joueur", type: "text", default: "rep" },
    ],
    build: (input) => {
      const resource = safeSlug(str(input, "resourceName", "fdm_reputation"), "fdm_reputation");
      const table = sqlName(str(input, "table", "player_reputation"), "player_reputation");
      const adminAce = str(input, "adminAce", "fdm.reputation.admin").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80) || "fdm.reputation.admin";
      const command = safeSlug(str(input, "command", "rep"), "rep").replace(/_/g, "");
      const factions = rows(input, "factionsCsv", ["name", "label", "start", "min", "max"]).map((row) => {
        const parsedMin = Number(row.min);
        const parsedMax = Number(row.max);
        const min = Number.isFinite(parsedMin) ? parsedMin : -100;
        const max = Number.isFinite(parsedMax) ? parsedMax : 100;
        return {
          name: safeSlug(row.name, "faction"),
          label: row.label || row.name || "Faction",
          start: Math.max(min, Math.min(max, Number(row.start) || 0)),
          min,
          max,
        };
      });
      const factionNames = new Set(factions.map((faction) => faction.name));
      const actions = rows(input, "actionsCsv", ["action", "faction", "amount", "cooldown", "description"]).map((row) => ({
        name: safeSlug(row.action, "action"),
        faction: safeSlug(row.faction, "faction"),
        amount: Math.max(-1000, Math.min(1000, Number(row.amount) || 0)),
        cooldown: Math.max(0, Math.min(86400, Number(row.cooldown) || 0)),
        description: row.description || row.action || "Action",
      }));
      const diagnostics: StudioDiagnostic[] = [];
      if (factions.length === 0) diagnostics.push({ level: "error", message: "Aucune faction definie.", field: "factionsCsv" });
      for (const action of actions) {
        if (!factionNames.has(action.faction)) diagnostics.push({ level: "warning", message: `Action ${action.name} : faction ${action.faction} inconnue.` });
      }
      const data = { resourceName: resource, table, adminAce, command, factions, actions };

      const schema = `CREATE TABLE IF NOT EXISTS ${table} (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  identifier VARCHAR(80) NOT NULL,
  faction VARCHAR(64) NOT NULL,
  points INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_player_reputation (identifier, faction),
  INDEX idx_player_reputation_faction (faction, points)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

      const fxmanifest = `fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name '${resource}'
description 'Systeme de reputation genere par FiveM DevManager'
version '1.0.0'

dependencies {
  'oxmysql',
}

shared_scripts {
  'reputation-system.lua',
}

server_scripts {
  'server/reputation.lua',
}

client_scripts {
  'client/suggestions.lua',
}
`;

      const server = `local tableName = Config.ReputationSystem.table
local factions = Config.ReputationSystem.factions
local actions = Config.ReputationSystem.actions
local adminAce = Config.ReputationSystem.adminAce
local actionCooldowns = {}

local function getIdentifier(source)
  return GetPlayerIdentifierByType(source, 'license')
end

local function factionByName(name)
  for _, faction in ipairs(factions) do
    if faction.name == name then return faction end
  end
  return nil
end

local function rankFor(points, faction)
  local span = math.max(1, faction.max - faction.min)
  local ratio = (points - faction.min) / span
  if ratio >= 0.8 then return 'Elite' end
  if ratio >= 0.55 then return 'Respecte' end
  if ratio >= 0.25 then return 'Connu' end
  return 'Neutre'
end

function GetReputation(source, factionName)
  local faction = factionByName(factionName)
  if not faction then return nil end
  local identifier = getIdentifier(source)
  if not identifier then return nil end
  local row = MySQL.single.await(
    ('SELECT points FROM %s WHERE identifier = ? AND faction = ? LIMIT 1'):format(tableName),
    { identifier, faction.name }
  )
  return row and tonumber(row.points) or faction.start
end

function AddReputation(source, factionName, amount, reason)
  local faction = factionByName(factionName)
  local identifier = getIdentifier(source)
  amount = math.floor(tonumber(amount) or 0)
  if not faction or not identifier or amount == 0 or math.abs(amount) > 1000 then
    return false
  end

  local start = math.max(faction.min, math.min(faction.max, faction.start + amount))
  MySQL.insert.await(
    ('INSERT INTO %s (identifier, faction, points) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE points = LEAST(?, GREATEST(?, points + ?))'):format(tableName),
    { identifier, faction.name, start, faction.max, faction.min, amount }
  )
  TriggerEvent('fdm:reputation:changed', source, identifier, faction.name, amount, reason or 'action')
  return true
end

function ApplyReputationAction(source, actionName)
  local action = nil
  for _, entry in ipairs(actions) do
    if entry.name == actionName then action = entry break end
  end
  if not action then return false, 'action_inconnue' end

  local identifier = getIdentifier(source)
  if not identifier then return false, 'identifiant_introuvable' end

  local key = ('%s:%s'):format(identifier, action.name)
  local now = os.time()
  if actionCooldowns[key] and now - actionCooldowns[key] < action.cooldown then
    return false, 'cooldown'
  end
  actionCooldowns[key] = now

  local ok = AddReputation(source, action.faction, action.amount, action.description)
  return ok, ok and 'ok' or 'faction_invalide'
end

exports('GetReputation', GetReputation)
exports('AddReputation', AddReputation)
exports('ApplyReputationAction', ApplyReputationAction)

RegisterCommand(Config.ReputationSystem.command, function(source)
  if source == 0 then return end
  local lines = {}
  for _, faction in ipairs(factions) do
    local points = GetReputation(source, faction.name) or faction.start
    lines[#lines + 1] = ('%s : %d (%s)'):format(faction.label, points, rankFor(points, faction))
  end
  TriggerClientEvent('chat:addMessage', source, { args = { 'Reputation', table.concat(lines, ' | ') } })
end, false)

RegisterCommand('repadmin', function(source, args)
  if source ~= 0 and not IsPlayerAceAllowed(source, adminAce) then return end
  if args[1] ~= 'add' or not args[2] or not args[3] or not args[4] then
    print('[reputation] usage : /repadmin add <id> <faction> <montant>')
    return
  end

  local target = tonumber(args[2])
  local amount = tonumber(args[4])
  if not target or not amount then
    print('[reputation] id ou montant invalide.')
    return
  end
  local ok = AddReputation(target, args[3], amount, 'admin')
  print(('[reputation] %s'):format(ok and 'valeur appliquee' or 'echec'))
end, false)
`;

      const client = `TriggerEvent('chat:addSuggestion', '/' .. Config.ReputationSystem.command, 'Affiche votre reputation')
TriggerEvent('chat:addSuggestion', '/repadmin', 'Ajuste la reputation d un joueur (admin)', {
  { name = 'add', help = 'Action' },
  { name = 'id', help = 'Identifiant serveur du joueur' },
  { name = 'faction', help = 'Nom de la faction' },
  { name = 'montant', help = 'Valeur positive ou negative' },
})
`;

      const readme = `# ${resource}

Systeme de reputation multi-factions.

## Installation

1. Importez \`schema.sql\`.
2. Ajoutez la ressource apres \`oxmysql\`.
3. Attribuez \`${adminAce}\` aux administrateurs.

## API serveur

\`\`\`lua
local points = GetReputation(source, 'citizens')
AddReputation(source, 'police', 10, 'mission_terminee')
local ok, reason = ApplyReputationAction(source, 'help')
\`\`\`

## Commandes

- \`/${command}\` : affiche la reputation du joueur.
- \`/repadmin add <id> <faction> <montant>\` : ajuste une reputation.

## Securite

- La quantite est limitee a 1000 par operation.
- Les points sont bornes par les minimum et maximum de chaque faction.
- Les actions disposent d'un cooldown par joueur.
- Le client ne peut pas ecrire directement en base.
`;

      return {
        data,
        sql: schema,
        lua: `function GetReputationFaction(name)
  for _, faction in ipairs(Config.ReputationSystem.factions) do
    if faction.name == name then return faction end
  end
  return nil
end
`,
        files: [
          file("fxmanifest.lua", fxmanifest, "lua"),
          file("server/reputation.lua", server, "lua"),
          file("client/suggestions.lua", client, "lua"),
        ],
        readme,
        stats: [
          stat("Factions", String(factions.length), factions.length ? "success" : "danger"),
          stat("Actions", String(actions.length)),
          stat("Table", table),
        ],
        diagnostics,
      };
    },
  }),
  moduleTool({
    slug: "skill-tree",
    name: "Arbre de competences",
    category: "gameplay",
    description:
      "Genere un arbre de competences avec prerequis, couts progressifs, points SQL, deblocage serveur et commandes.",
    icon: "GitBranch",
    tags: ["competences", "progression", "sql", "rpg", "points"],
    fields: [
      { name: "resourceName", label: "Ressource", type: "text", default: "fdm_skills", required: true },
      { name: "tablePrefix", label: "Prefixe SQL", type: "text", default: "player_skill" },
      { name: "skillsCsv", label: "Competences (id,label,maxRank,cost,prerequisite)", type: "textarea", rows: 7, default: DEFAULT_SKILLS, required: true },
      { name: "startingPoints", label: "Points initiaux", type: "number", default: 1, min: 0, max: 100 },
      { name: "adminAce", label: "Permission admin", type: "text", default: "fdm.skills.admin" },
      { name: "command", label: "Commande joueur", type: "text", default: "skills" },
    ],
    build: (input) => {
      const resource = safeSlug(str(input, "resourceName", "fdm_skills"), "fdm_skills");
      const prefix = sqlName(str(input, "tablePrefix", "player_skill"), "player_skill").slice(0, 48);
      const startingPoints = Math.max(0, Math.min(100, num(input, "startingPoints", 1)));
      const adminAce = str(input, "adminAce", "fdm.skills.admin").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80) || "fdm.skills.admin";
      const command = safeSlug(str(input, "command", "skills"), "skills").replace(/_/g, "");
      const skills = rows(input, "skillsCsv", ["id", "label", "maxRank", "cost", "prerequisite"]).map((row) => ({
        id: safeSlug(row.id, "skill"),
        label: row.label || row.id || "Competence",
        maxRank: Math.max(1, Math.min(20, Number(row.maxRank) || 1)),
        cost: Math.max(1, Math.min(1000, Number(row.cost) || 1)),
        prerequisite: row.prerequisite ? safeSlug(row.prerequisite, "") : "",
      }));
      const skillIds = new Set(skills.map((skill) => skill.id));
      const diagnostics: StudioDiagnostic[] = [];
      if (skills.length === 0) diagnostics.push({ level: "error", message: "Aucune competence definie.", field: "skillsCsv" });
      for (const skill of skills) {
        if (skill.prerequisite && !skillIds.has(skill.prerequisite)) {
          diagnostics.push({ level: "warning", message: `Competence ${skill.id} : prerequis ${skill.prerequisite} inconnu.` });
        }
      }
      const data = { resourceName: resource, prefix, startingPoints, adminAce, command, skills };

      const schema = `CREATE TABLE IF NOT EXISTS ${prefix}_points (
  identifier VARCHAR(80) NOT NULL PRIMARY KEY,
  points INT NOT NULL DEFAULT ${startingPoints},
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ${prefix}_ranks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  identifier VARCHAR(80) NOT NULL,
  skill VARCHAR(64) NOT NULL,
  rank INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_${prefix}_skill (identifier, skill),
  INDEX idx_${prefix}_identifier (identifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

      const fxmanifest = `fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name '${resource}'
description 'Arbre de competences genere par FiveM DevManager'
version '1.0.0'

dependencies {
  'oxmysql',
}

shared_scripts {
  'skill-tree.lua',
}

server_scripts {
  'server/skills.lua',
}

client_scripts {
  'client/suggestions.lua',
}
`;

      const server = `local prefix = Config.SkillTree.prefix
local skills = Config.SkillTree.skills
local startingPoints = Config.SkillTree.startingPoints
local adminAce = Config.SkillTree.adminAce
local cooldowns = {}

local function identifier(source)
  return GetPlayerIdentifierByType(source, 'license')
end

local function skillById(id)
  for _, skill in ipairs(skills) do
    if skill.id == id then return skill end
  end
  return nil
end

local function ensurePlayer(actor)
  MySQL.insert.await(
    ('INSERT INTO %s_points (identifier, points) VALUES (?, ?) ON DUPLICATE KEY UPDATE identifier = VALUES(identifier)'):format(prefix),
    { actor, startingPoints }
  )
end

function GetSkillPoints(source)
  local actor = identifier(source)
  if not actor then return 0 end
  ensurePlayer(actor)
  local points = MySQL.scalar.await(
    ('SELECT points FROM %s_points WHERE identifier = ? LIMIT 1'):format(prefix),
    { actor }
  )
  return tonumber(points) or 0
end

function AddSkillPoints(source, amount, reason)
  local actor = identifier(source)
  amount = math.floor(tonumber(amount) or 0)
  if not actor or amount == 0 or math.abs(amount) > 1000 then return false end
  ensurePlayer(actor)
  MySQL.update.await(
    ('UPDATE %s_points SET points = GREATEST(0, points + ?) WHERE identifier = ?'):format(prefix),
    { amount, actor }
  )
  TriggerEvent('fdm:skills:points', source, actor, amount, reason or 'system')
  return true
end

function GetSkillRank(source, skillId)
  local actor = identifier(source)
  if not actor or not skillById(skillId) then return 0 end
  local rank = MySQL.scalar.await(
    ('SELECT rank FROM %s_ranks WHERE identifier = ? AND skill = ? LIMIT 1'):format(prefix),
    { actor, skillId }
  )
  return tonumber(rank) or 0
end

function UnlockSkill(source, skillId)
  local actor = identifier(source)
  local skill = skillById(skillId)
  if not actor or not skill then return false, 'competence_inconnue' end

  local now = os.time()
  if cooldowns[actor] and now - cooldowns[actor] < 1 then return false, 'trop_rapide' end
  cooldowns[actor] = now

  local rank = GetSkillRank(source, skill.id)
  if rank >= skill.maxRank then return false, 'rang_maximum' end

  if skill.prerequisite ~= '' and GetSkillRank(source, skill.prerequisite) < 1 then
    return false, 'prerequis_manquant'
  end

  local cost = skill.cost * (rank + 1)
  if GetSkillPoints(source) < cost then return false, 'points_insuffisants' end

  local affected = MySQL.update.await(
    ('UPDATE %s_points SET points = points - ? WHERE identifier = ? AND points >= ?'):format(prefix),
    { cost, actor, cost }
  )
  if (tonumber(affected) or 0) == 0 then
    return false, 'points_insuffisants'
  end

  local inserted, insertError = pcall(function()
    MySQL.insert.await(
      ('INSERT INTO %s_ranks (identifier, skill, rank) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE rank = rank + 1'):format(prefix),
      { actor, skill.id }
    )
  end)
  if not inserted then
    MySQL.update.await(
      ('UPDATE %s_points SET points = points + ? WHERE identifier = ?'):format(prefix),
      { cost, actor }
    )
    print(('[skills] deblocage impossible : %s'):format(tostring(insertError)))
    return false, 'transaction_impossible'
  end

  TriggerEvent('fdm:skills:unlocked', source, actor, skill.id, rank + 1)
  return true, 'ok'
end

exports('GetSkillPoints', GetSkillPoints)
exports('AddSkillPoints', AddSkillPoints)
exports('GetSkillRank', GetSkillRank)
exports('UnlockSkill', UnlockSkill)

RegisterCommand(Config.SkillTree.command, function(source)
  if source == 0 then return end
  local lines = { ('Points : %d'):format(GetSkillPoints(source)) }
  for _, skill in ipairs(skills) do
    lines[#lines + 1] = ('%s %d/%d'):format(skill.id, GetSkillRank(source, skill.id), skill.maxRank)
  end
  TriggerClientEvent('chat:addMessage', source, { args = { 'Competences', table.concat(lines, ' | ') } })
end, false)

RegisterCommand('skillunlock', function(source, args)
  if source == 0 or not args[1] then return end
  local ok, reason = UnlockSkill(source, args[1])
  if not ok then
    TriggerClientEvent('chat:addMessage', source, { args = { 'Competences', ('Deblocage refuse : %s'):format(reason) } })
  end
end, false)

RegisterCommand('skilladmin', function(source, args)
  if source ~= 0 and not IsPlayerAceAllowed(source, adminAce) then return end
  if args[1] ~= 'add' or not args[2] or not args[3] then
    print('[skills] usage : /skilladmin add <id> <points>')
    return
  end
  local target = tonumber(args[2])
  local amount = tonumber(args[3])
  if not target or not amount then return end
  print(('[skills] %s'):format(AddSkillPoints(target, amount, 'admin') and 'points ajoutes' or 'echec'))
end, false)
`;

      const client = `TriggerEvent('chat:addSuggestion', '/' .. Config.SkillTree.command, 'Affiche vos competences et vos points')
TriggerEvent('chat:addSuggestion', '/skillunlock', 'Debloque ou ameliore une competence', {
  { name = 'competence', help = table.concat((function()
    local names = {}
    for _, skill in ipairs(Config.SkillTree.skills) do names[#names + 1] = skill.id end
    return names
  end)(), ', ') },
})
`;

      const readme = `# ${resource}

Arbre de competences avec prerequis, couts croissants et points stockes en SQL.

## Installation

1. Importez \`schema.sql\`.
2. Ajoutez la ressource apres \`oxmysql\`.
3. Attribuez \`${adminAce}\` aux administrateurs.

## Commandes

- \`/${command}\` : affiche les points et les rangs.
- \`/skillunlock <competence>\` : debloque le rang suivant.
- \`/skilladmin add <id> <points>\` : ajoute des points.

## API serveur

\`\`\`lua
AddSkillPoints(source, 5, 'quete')
local rank = GetSkillRank(source, 'endurance')
local ok, reason = UnlockSkill(source, 'endurance')
\`\`\`

## Securite

- Les prerequis et les couts sont verifies cote serveur.
- Le debit de points est conditionnel et rembourse si l'ecriture du rang echoue.
- Le client ne peut pas modifier directement son rang.
- Le deblocage est limite a une operation par seconde et par joueur.
`;

      return {
        data,
        sql: schema,
        lua: `function GetSkillDefinition(id)
  for _, skill in ipairs(Config.SkillTree.skills) do
    if skill.id == id then return skill end
  end
  return nil
end
`,
        files: [
          file("fxmanifest.lua", fxmanifest, "lua"),
          file("server/skills.lua", server, "lua"),
          file("client/suggestions.lua", client, "lua"),
        ],
        readme,
        stats: [
          stat("Competences", String(skills.length), skills.length ? "success" : "danger"),
          stat("Points initiaux", String(startingPoints)),
          stat("Prefixe", prefix),
        ],
        diagnostics,
      };
    },
  }),
];
