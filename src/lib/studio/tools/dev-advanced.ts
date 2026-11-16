import { file, luaString, mdTable, num, safeSlug, sqlIdentifier, stat, str } from "../helpers";
import { list, moduleTool, rows } from "./modules-shared";
import type { StudioDiagnostic, StudioTool } from "../types";

interface CommandEntry {
  name: string;
  permission: string;
  cooldown: number;
  minArgs: number;
  maxArgs: number;
  event: string;
  description: string;
}

const DEFAULT_COMMANDS = `refresh,fdm.command.refresh,10,0,0,fdm:command:refresh,Recharge les donnees
status,fdm.command.status,5,0,1,fdm:command:status,Affiche le statut
reload,fdm.command.reload,30,1,1,fdm:command:reload,Recharge une ressource`;

export const devAdvancedTools: StudioTool[] = [
  moduleTool({
    slug: "secure-api-client",
    name: "Client API securise",
    category: "dev",
    description:
      "Genere un client HTTP serveur avec liste blanche d'hotes, HTTPS obligatoire, timeout, retries, cache et limite de taille.",
    icon: "Network",
    tags: ["api", "http", "securite", "retry", "cache"],
    fields: [
      { name: "resourceName", label: "Ressource", type: "text", default: "fdm_api_client", required: true },
      { name: "allowedHostsCsv", label: "Hotes autorises", type: "text", default: "api.github.com, api.fivem.net", required: true },
      { name: "timeoutMs", label: "Timeout (ms)", type: "number", default: 5000, min: 500, max: 60000 },
      { name: "retries", label: "Tentatives supplementaires", type: "number", default: 2, min: 0, max: 5 },
      { name: "maxBytes", label: "Taille max de reponse (octets)", type: "number", default: 262144, min: 1024, max: 4194304 },
      { name: "cacheSeconds", label: "Cache GET (s)", type: "number", default: 30, min: 0, max: 3600 },
      { name: "userAgent", label: "User-Agent", type: "text", default: "fdm-resource/1.0" },
      { name: "testUrl", label: "URL de test", type: "text", default: "https://api.github.com/zen" },
      { name: "permission", label: "Permission de test", type: "text", default: "fdm.api.test" },
    ],
    build: (input) => {
      const resource = safeSlug(str(input, "resourceName", "fdm_api_client"), "fdm_api_client");
      const allowedHosts = list(input, "allowedHostsCsv", "api.github.com").map((host) => host.toLowerCase());
      const timeoutMs = Math.max(500, Math.min(60000, num(input, "timeoutMs", 5000)));
      const retries = Math.max(0, Math.min(5, num(input, "retries", 2)));
      const maxBytes = Math.max(1024, Math.min(4194304, num(input, "maxBytes", 262144)));
      const cacheSeconds = Math.max(0, Math.min(3600, num(input, "cacheSeconds", 30)));
      const userAgent = str(input, "userAgent", "fdm-resource/1.0").replace(/[^\w./ -]/g, "").slice(0, 120) || "fdm-resource/1.0";
      const testUrl = str(input, "testUrl", "https://api.github.com/zen");
      const permission = str(input, "permission", "fdm.api.test").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80) || "fdm.api.test";
      const diagnostics: StudioDiagnostic[] = [];
      if (allowedHosts.length === 0) diagnostics.push({ level: "error", message: "La liste blanche est vide : aucune requete ne sera possible.", field: "allowedHostsCsv" });
      if (!/^https:\/\//i.test(testUrl)) diagnostics.push({ level: "warning", message: "L'URL de test doit utiliser HTTPS.", field: "testUrl" });
      const data = { resourceName: resource, allowedHosts, timeoutMs, retries, maxBytes, cacheSeconds, userAgent, testUrl, permission };

      const fxmanifest = `fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name '${resource}'
description 'Client HTTP serveur securise genere par FiveM DevManager'
version '1.0.0'

shared_scripts {
  'secure-api-client.lua',
}

server_scripts {
  'server/http.lua',
}
`;

      const server = `local allowedHosts = {}
local cache = {}
local timeoutMs = Config.SecureApiClient.timeoutMs
local retries = Config.SecureApiClient.retries
local maxBytes = Config.SecureApiClient.maxBytes
local cacheSeconds = Config.SecureApiClient.cacheSeconds
local userAgent = Config.SecureApiClient.userAgent
local permission = Config.SecureApiClient.permission

for _, host in ipairs(Config.SecureApiClient.allowedHosts) do
  allowedHosts[host:lower()] = true
end

local function parseUrl(url)
  if type(url) ~= 'string' or #url > 2048 then return nil end
  local scheme, host, path = url:match('^(https)://([^/]+)(/.*)$')
  if scheme ~= 'https' or not host then return nil end
  local hostname = host:lower():gsub(':%d+$', '')
  if not allowedHosts[hostname] then return nil end
  return hostname, path
end

local function cleanHeaders(headers)
  local result = { ['Accept'] = 'application/json', ['User-Agent'] = userAgent }
  if type(headers) ~= 'table' then return result end
  for key, value in pairs(headers) do
    if type(key) == 'string' and type(value) == 'string' and #key <= 80 and #value <= 500 then
      result[key] = value
    end
  end
  return result
end

local function cacheKey(method, url)
  return method .. ':' .. url
end

local function readCache(key)
  local entry = cache[key]
  if not entry then return nil end
  if cacheSeconds <= 0 or os.time() - entry.time > cacheSeconds then
    cache[key] = nil
    return nil
  end
  return entry.data
end

local function writeCache(key, data)
  if cacheSeconds > 0 then
    cache[key] = { time = os.time(), data = data }
  end
end

local function report(source, message, ok)
  if source and source ~= 0 then
    TriggerClientEvent('chat:addMessage', source, {
      args = { 'API', tostring(message) },
      color = ok and { 80, 220, 140 } or { 240, 120, 120 },
    })
  else
    print(('[api] %s'):format(tostring(message)))
  end
end

local function perform(url, options, source, attempt, callback)
  local method = string.upper(tostring(options.method or 'GET'))
  if method ~= 'GET' and method ~= 'POST' and method ~= 'PATCH' and method ~= 'DELETE' then
    callback(nil, 'methode_non_autorisee')
    return
  end

  local body = options.body
  if body ~= nil and type(body) ~= 'string' then
    body = json.encode(body)
  end
  if body and #body > maxBytes then
    callback(nil, 'corps_trop_volumineux')
    return
  end

  local headers = cleanHeaders(options.headers)
  if body then headers['Content-Type'] = 'application/json' end

  local done = false
  local timer = SetTimeout(timeoutMs, function()
    if done then return end
    done = true
    callback(nil, 'timeout')
  end)

  PerformHttpRequest(url, function(status, responseBody, responseHeaders)
    if done then return end
    done = true
    ClearTimeout(timer)

    if status == 0 or status == 429 or status >= 500 then
      if attempt < retries then
        local delay = math.min(8000, 400 * (2 ^ attempt))
        SetTimeout(delay, function()
          perform(url, options, source, attempt + 1, callback)
        end)
        return
      end
      callback(nil, ('http_%d'):format(status), status)
      return
    end

    if status < 200 or status >= 300 then
      callback(nil, ('http_%d'):format(status), status)
      return
    end
    if type(responseBody) ~= 'string' or #responseBody > maxBytes then
      callback(nil, 'reponse_trop_volumineuse', status)
      return
    end

    local ok, decoded = pcall(json.decode, responseBody)
    if not ok or decoded == nil then
      callback(nil, 'json_invalide', status)
      return
    end
    callback(decoded, nil, status)
  end, method, body or '', headers)
end

function FetchJson(url, options, callback)
  if type(options) == 'function' then
    callback = options
    options = {}
  end
  options = options or {}
  if type(callback) ~= 'function' then
    error('FetchJson exige une fonction callback')
  end

  local host, path = parseUrl(url)
  if not host then
    callback(nil, 'url_non_autorisee')
    return false
  end

  local method = string.upper(tostring(options.method or 'GET'))
  local key = cacheKey(method, url)
  if method == 'GET' then
    local cached = readCache(key)
    if cached ~= nil then
      callback(cached, nil, 200)
      return true
    end
  end

  perform(url, options, options.source, 0, function(data, err, status)
    if data ~= nil and method == 'GET' then writeCache(key, data) end
    callback(data, err, status)
  end)
  return true
end

exports('FetchJson', FetchJson)

RegisterCommand('apihealth', function(source)
  if source ~= 0 and not IsPlayerAceAllowed(source, permission) then return end
  FetchJson(Config.SecureApiClient.testUrl, { source = source }, function(data, err, status)
    if err then
      report(source, ('echec : %s'):format(err), false)
      return
    end
    local preview = type(data) == 'table' and (data.message or data.zen or data.status or 'ok') or tostring(data)
    report(source, ('HTTP %s · %s'):format(tostring(status), tostring(preview)), true)
  end)
end, false)
`;

      const readme = `# ${resource}

Client HTTP serveur securise genere par FiveM DevManager.

## Installation

1. Ajoutez \`ensure ${resource}\` apres vos dependances.
2. Verifiez la liste blanche : ${allowedHosts.join(", ") || "aucun hote"}.
3. Attribuez \`${permission}\` aux personnes autorisees a tester.

## Utilisation

\`\`\`lua
FetchJson('https://api.github.com/zen', { method = 'GET' }, function(data, err, status)
  if err then
    print(('Erreur API : %s'):format(err))
    return
  end
  print(json.encode(data))
end)
\`\`\`

## Securite

- Seules les URL HTTPS des hotes autorises sont acceptees.
- Les methodes sont limitees a GET, POST, PATCH et DELETE.
- La taille du corps et de la reponse est plafonnee a ${maxBytes} octets.
- Les erreurs 429 et 5xx sont retentees ${retries} fois avec backoff exponentiel.
- Les GET peuvent etre caches ${cacheSeconds} secondes.
- Aucun secret ne doit etre place dans cette ressource ou dans un fichier client.
`;

      return {
        data,
        lua: `function IsSecureApiHost(host)
  host = tostring(host or ''):lower():gsub(':%d+$', '')
  for _, allowed in ipairs(Config.SecureApiClient.allowedHosts) do
    if allowed:lower() == host then return true end
  end
  return false
end
`,
        files: [
          file("fxmanifest.lua", fxmanifest, "lua"),
          file("server/http.lua", server, "lua"),
        ],
        readme,
        stats: [
          stat("Hotes", String(allowedHosts.length), allowedHosts.length ? "success" : "danger"),
          stat("Timeout", `${timeoutMs} ms`),
          stat("Retries", String(retries)),
          stat("Cache", `${cacheSeconds} s`),
        ],
        diagnostics,
      };
    },
  }),
  moduleTool({
    slug: "statebag-sync",
    name: "Synchronisation statebags",
    category: "dev",
    description:
      "Genere une couche serveur autoritaire pour les statebags joueur, avec liste blanche, taille limitee et synchronisation client.",
    icon: "ArrowLeftRight",
    tags: ["statebag", "sync", "serveur", "securite"],
    fields: [
      { name: "resourceName", label: "Ressource", type: "text", default: "fdm_statebag_sync", required: true },
      { name: "keysCsv", label: "Cles autorisees", type: "text", default: "job, duty, metadata, reputation", required: true },
      { name: "intervalMs", label: "Intervalle de sync (ms)", type: "number", default: 1500, min: 500, max: 10000 },
      { name: "maxBytes", label: "Taille max par valeur (octets)", type: "number", default: 4096, min: 256, max: 16384 },
      { name: "permission", label: "Permission d'ecriture admin", type: "text", default: "fdm.statebag.write" },
    ],
    build: (input) => {
      const resource = safeSlug(str(input, "resourceName", "fdm_statebag_sync"), "fdm_statebag_sync");
      const keys = list(input, "keysCsv", "job,duty").map((key) => safeSlug(key, "key"));
      const intervalMs = Math.max(500, Math.min(10000, num(input, "intervalMs", 1500)));
      const maxBytes = Math.max(256, Math.min(16384, num(input, "maxBytes", 4096)));
      const permission = str(input, "permission", "fdm.statebag.write").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80) || "fdm.statebag.write";
      const diagnostics: StudioDiagnostic[] = keys.length === 0 ? [{ level: "error", message: "Aucune cle autorisee.", field: "keysCsv" }] : [];
      const data = { resourceName: resource, keys, intervalMs, maxBytes, permission };

      const fxmanifest = `fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name '${resource}'
description 'Synchronisation statebags generee par FiveM DevManager'
version '1.0.0'

shared_scripts {
  'statebag-sync.lua',
}

server_scripts {
  'server/statebags.lua',
}

client_scripts {
  'client/statebags.lua',
}
`;

      const server = `local allowed = {}
local maxBytes = Config.StatebagSync.maxBytes
local intervalMs = Config.StatebagSync.intervalMs
local permission = Config.StatebagSync.permission

for _, key in ipairs(Config.StatebagSync.keys) do
  allowed[key] = true
end

local function encodeSize(value)
  local ok, encoded = pcall(json.encode, value)
  if not ok then return nil end
  return #encoded
end

local function validateValue(value)
  local kind = type(value)
  if kind ~= 'string' and kind ~= 'number' and kind ~= 'boolean' and kind ~= 'table' then
    return false, 'type_non_autorise'
  end
  local size = encodeSize(value)
  if not size or size > maxBytes then return false, 'valeur_trop_volumineuse' end
  return true
end

local function player(source)
  if type(source) ~= 'number' or source <= 0 then return nil end
  local target = Player(source)
  if not target or not target.state then return nil end
  return target
end

local function snapshot(target)
  local values = {}
  for key in pairs(allowed) do
    local value = target.state[key]
    if value ~= nil then values[key] = value end
  end
  return values
end

function SetPlayerState(source, key, value)
  if not allowed[key] then return false, 'cle_non_autorisee' end
  local ok, reason = validateValue(value)
  if not ok then return false, reason end

  local target = player(source)
  if not target then return false, 'joueur_introuvable' end

  target.state:set(key, value, true)
  TriggerClientEvent('statebag:client:update', source, key, value)
  return true
end

function GetPlayerState(source, key)
  if not allowed[key] then return nil end
  local target = player(source)
  if not target then return nil end
  return target.state[key]
end

exports('SetPlayerState', SetPlayerState)
exports('GetPlayerState', GetPlayerState)

RegisterNetEvent('statebag:server:request', function()
  local source = source
  local target = player(source)
  if not target then return end
  TriggerClientEvent('statebag:client:sync', source, snapshot(target))
end)

RegisterCommand('statebag', function(source, args)
  if source ~= 0 and not IsPlayerAceAllowed(source, permission) then return end
  if not args[1] or not args[2] or not args[3] then
    print('[statebag] usage : /statebag <id> <cle> <json>')
    return
  end

  local target = tonumber(args[1])
  local key = tostring(args[2])
  local ok, decoded = pcall(json.decode, table.concat(args, ' ', 3))
  if not ok then
    print('[statebag] JSON invalide.')
    return
  end

  local saved, reason = SetPlayerState(target, key, decoded)
  print(('[statebag] %s : %s'):format(saved and 'ok' or 'echec', reason or 'valeur appliquee'))
end, false)

CreateThread(function()
  while true do
    Wait(intervalMs)
    for _, playerId in ipairs(GetPlayers()) do
      local target = player(tonumber(playerId))
      if target then
        TriggerClientEvent('statebag:client:sync', tonumber(playerId), snapshot(target))
      end
    end
  end
end)
`;

      const client = `local values = {}

RegisterNetEvent('statebag:client:sync', function(snapshot)
  if type(snapshot) ~= 'table' then return end
  values = {}
  for key, value in pairs(snapshot) do
    if type(key) == 'string' then
      values[key] = value
      LocalPlayer.state:set(key, value, false)
    end
  end
end)

RegisterNetEvent('statebag:client:update', function(key, value)
  if type(key) ~= 'string' then return end
  values[key] = value
  LocalPlayer.state:set(key, value, false)
end)

RegisterCommand('state', function()
  local lines = {}
  for key, value in pairs(values) do
    local ok, encoded = pcall(json.encode, value)
    lines[#lines + 1] = ('%s=%s'):format(key, ok and encoded or tostring(value))
  end
  table.sort(lines)
  TriggerEvent('chat:addMessage', { args = { 'StateBag', table.concat(lines, ' | ') } })
end, false)

CreateThread(function()
  Wait(1000)
  TriggerServerEvent('statebag:server:request')
end)
`;

      const readme = `# ${resource}

Synchronisation de statebags joueur, pilotee par le serveur.

## Installation

1. Ajoutez \`ensure ${resource}\`.
2. Adaptez la liste blanche : ${keys.join(", ") || "aucune cle"}.
3. Attribuez \`${permission}\` aux administrateurs.

## API serveur

\`\`\`lua
SetPlayerState(source, 'duty', true)
local duty = GetPlayerState(source, 'duty')
\`\`\`

## Securite

- Seules les cles listees sont acceptees.
- Les valeurs sont limitees a ${maxBytes} octets.
- Aucune ecriture client n'est acceptee.
- La commande admin verifie une permission ACE.
- La synchronisation periodique est de ${intervalMs} ms.
`;

      return {
        data,
        lua: `function IsAllowedStatebagKey(key)
  for _, allowed in ipairs(Config.StatebagSync.keys) do
    if allowed == key then return true end
  end
  return false
end
`,
        files: [
          file("fxmanifest.lua", fxmanifest, "lua"),
          file("server/statebags.lua", server, "lua"),
          file("client/statebags.lua", client, "lua"),
        ],
        readme,
        stats: [
          stat("Cles", String(keys.length), keys.length ? "success" : "danger"),
          stat("Taille max", `${maxBytes} o`),
          stat("Intervalle", `${intervalMs} ms`),
        ],
        diagnostics,
      };
    },
  }),
  moduleTool({
    slug: "command-registry",
    name: "Registre de commandes",
    category: "dev",
    description:
      "Genere un registre de commandes avec ACE, cooldowns, validation d'arguments, audit SQL et suggestions de chat.",
    icon: "Terminal",
    tags: ["commande", "ace", "audit", "permissions", "sql"],
    fields: [
      { name: "resourceName", label: "Ressource", type: "text", default: "fdm_commands", required: true },
      { name: "commandsCsv", label: "Commandes (name,permission,cooldown,minArgs,maxArgs,event,description)", type: "textarea", rows: 8, default: DEFAULT_COMMANDS, required: true },
      { name: "auditTable", label: "Table d'audit", type: "text", default: "command_audit" },
      { name: "logToSql", label: "Journaliser en SQL", type: "switch", default: true },
    ],
    build: (input) => {
      const resource = safeSlug(str(input, "resourceName", "fdm_commands"), "fdm_commands");
      const auditTable = sqlIdentifier(str(input, "auditTable", "command_audit"), "command_audit");
      const logToSql = input.logToSql === undefined ? true : input.logToSql === true || input.logToSql === "true";
      const commands: CommandEntry[] = rows(input, "commandsCsv", ["name", "permission", "cooldown", "minArgs", "maxArgs", "event", "description"]).map((row) => {
        const name = safeSlug(row.name, "command").replace(/_/g, "");
        const event = (row.event || `fdm:command:${name}`).replace(/[^A-Za-z0-9:_-]/g, "").slice(0, 100) || `fdm:command:${name}`;
        return {
          name,
          permission: (row.permission || "").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80),
          cooldown: Math.max(0, Number(row.cooldown) || 0),
          minArgs: Math.max(0, Number(row.minArgs) || 0),
          maxArgs: Math.max(0, Number(row.maxArgs) || 0),
          event,
          description: row.description || name,
        };
      });
      const diagnostics: StudioDiagnostic[] = commands.length === 0 ? [{ level: "error", message: "Aucune commande definie.", field: "commandsCsv" }] : [];
      const duplicate = commands.filter((command, index) => commands.findIndex((entry) => entry.name === command.name) !== index);
      if (duplicate.length > 0) diagnostics.push({ level: "error", message: `Commande(s) en doublon : ${duplicate.map((command) => command.name).join(", ")}.` });

      const fxmanifest = `fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name '${resource}'
description 'Registre de commandes genere par FiveM DevManager'
version '1.0.0'
${logToSql ? "\ndependencies {\n  'oxmysql',\n}\n" : ""}
shared_scripts {
  'command-registry.lua',
}

server_scripts {
  'server/commands.lua',
  'server/actions.lua',
}

client_scripts {
  'client/suggestions.lua',
}
`;

      const schema = `CREATE TABLE IF NOT EXISTS ${auditTable} (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  command_name VARCHAR(64) NOT NULL,
  actor VARCHAR(80) NOT NULL,
  args JSON NULL,
  success TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_command_audit_name (command_name, created_at),
  INDEX idx_command_audit_actor (actor, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

      const server = `local commands = Config.CommandRegistry.commands
local cooldowns = {}
local auditTable = Config.CommandRegistry.auditTable
local logToSql = Config.CommandRegistry.logToSql

local function identifier(source)
  if source == 0 then return 'console' end
  return GetPlayerIdentifierByType(source, 'license') or ('player:%d'):format(source)
end

local function sanitizeArgs(args)
  local clean = {}
  for index, value in ipairs(args or {}) do
    if index > 10 then break end
    clean[index] = tostring(value):sub(1, 200)
  end
  return clean
end

local function audit(command, source, args, success)
  if not logToSql then return end
  local ok, err = pcall(function()
    MySQL.insert.await(
      ('INSERT INTO %s (command_name, actor, args, success) VALUES (?, ?, ?, ?)'):format(auditTable),
      { command.name, identifier(source), json.encode(args), success and 1 or 0 }
    )
  end)
  if not ok then
    print(('[command] audit impossible : %s'):format(tostring(err)))
  end
end

for _, command in ipairs(commands) do
  RegisterCommand(command.name, function(source, args)
    local clean = sanitizeArgs(args)
    if command.permission ~= '' and source ~= 0 and not IsPlayerAceAllowed(source, command.permission) then
      audit(command, source, clean, false)
      return
    end

    if #clean < command.minArgs or (command.maxArgs > 0 and #clean > command.maxArgs) then
      if source ~= 0 then
        TriggerClientEvent('chat:addMessage', source, {
          args = { 'Commande', ('Usage : /%s (%d a %d arguments)'):format(command.name, command.minArgs, command.maxArgs) },
        })
      end
      audit(command, source, clean, false)
      return
    end

    local key = ('%s:%s'):format(source, command.name)
    local now = os.time()
    if command.cooldown > 0 and cooldowns[key] and now - cooldowns[key] < command.cooldown then
      if source ~= 0 then
        TriggerClientEvent('chat:addMessage', source, { args = { 'Commande', 'Patientez avant de reessayer.' } })
      end
      audit(command, source, clean, false)
      return
    end
    cooldowns[key] = now

    audit(command, source, clean, true)
    TriggerEvent(command.event, source, clean, command.name)
  end, false)
end

function GetRegisteredCommand(name)
  for _, command in ipairs(commands) do
    if command.name == name then return command end
  end
  return nil
end

exports('GetRegisteredCommand', GetRegisteredCommand)
`;

      const actions = commands
        .map(
          (command) => `AddEventHandler(${luaString(command.event)}, function(source, args, commandName)
  print(('[command] %s execute par %s avec %d argument(s)'):format(commandName, tostring(source), #args))
  -- Branchez ici l'action reelle de la commande.
end)`,
        )
        .join("\n\n");

      const client = `local commands = Config.CommandRegistry.commands

for _, command in ipairs(commands) do
  local params = {}
  if command.maxArgs > 0 then
    for index = 1, command.maxArgs do
      params[#params + 1] = { name = ('arg%d'):format(index), help = ('Argument %d'):format(index) }
    end
  end
  TriggerEvent('chat:addSuggestion', '/' .. command.name, command.description, params)
end
`;

      const readme = `# ${resource}

Registre de commandes avec permissions, cooldowns et audit.

## Installation

1. ${logToSql ? `Importez \`schema.sql\` dans la base et placez la ressource apres \`oxmysql\`.` : "Ajoutez la ressource au serveur."}
2. Adaptez les commandes dans la configuration.
3. Attribuez les permissions ACE necessaires.

## Commandes generees

${mdTable(["Commande", "Permission", "Cooldown", "Arguments"], commands.map((command) => [`/${command.name}`, command.permission || "aucune", `${command.cooldown}s`, `${command.minArgs}-${command.maxArgs}`]))}

## Branchement

Chaque commande emet son evenement \`event\` apres validation. Le fichier \`server/actions.lua\`
contient un recepteur de demonstration pour chaque evenement. Remplacez son contenu par
l'action metier reelle.

## Securite

- La permission ACE est verifiee cote serveur.
- Les arguments sont limites a 10 entrees de 200 caracteres.
- Le cooldown est applique par joueur et par commande.
- Les refus et succes sont journalises lorsque l'audit SQL est actif.
`;

      return {
        data: { resourceName: resource, auditTable, logToSql, commands },
        ...(logToSql ? { sql: schema } : {}),
        lua: `function IsRegisteredCommand(name)
  for _, command in ipairs(Config.CommandRegistry.commands) do
    if command.name == name then return true end
  end
  return false
end
`,
        files: [
          file("fxmanifest.lua", fxmanifest, "lua"),
          file("server/commands.lua", server, "lua"),
          file("server/actions.lua", actions, "lua"),
          file("client/suggestions.lua", client, "lua"),
        ],
        readme,
        stats: [
          stat("Commandes", String(commands.length), commands.length ? "success" : "danger"),
          stat("Audit SQL", logToSql ? "Actif" : "Desactive", logToSql ? "success" : "warning"),
          stat("Doublons", String(duplicate.length), duplicate.length ? "danger" : "success"),
        ],
        diagnostics,
      };
    },
  }),
];
