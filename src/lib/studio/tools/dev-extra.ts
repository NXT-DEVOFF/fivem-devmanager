import {
  bool,
  file,
  luaString,
  mdTable,
  num,
  safeSlug,
  sqlString,
  stat,
  str,
} from "../helpers";
import { list, moduleTool, rows } from "./modules-shared";
import type { StudioTool } from "../types";

function sqlIdentifier(value: string, fallback: string): string {
  return safeSlug(value, fallback).replace(/[^a-z0-9_]/g, "_");
}

export const devExtraTools: StudioTool[] = [
  moduleTool({
    slug: "oxmysql-migration",
    name: "Migration oxmysql",
    category: "dev",
    description: "Genere une migration SQL oxmysql a partir de colonnes decrites.",
    icon: "Database",
    tags: ["oxmysql", "sql", "migration"],
    fields: [
      { name: "table", label: "Table", type: "text", default: "player_stats", required: true },
      { name: "columnsCsv", label: "Colonnes (name,type,nullable,default)", type: "textarea", rows: 6, default: "identifier,VARCHAR(64),0,\nlevel,INT,0,1\nxp,INT,0,0\nupdated_at,TIMESTAMP,1,CURRENT_TIMESTAMP" },
    ],
    build: (input) => {
      const table = sqlIdentifier(str(input, "table", "player_stats"), "player_stats");
      const columns = rows(input, "columnsCsv", ["name", "type", "nullable", "default"]).map((row) => ({
        name: sqlIdentifier(row.name, "column"),
        type: (row.type || "VARCHAR(255)").toUpperCase().replace(/[^A-Z0-9(), ]/g, ""),
        nullable: row.nullable === "1" || row.nullable.toLowerCase() === "true",
        defaultValue: row.default,
      }));
      const lines = columns
        .filter((column) => column.name !== "id")
        .map((column) => `  \`${column.name}\` ${column.type} ${column.nullable ? "NULL" : "NOT NULL"}${column.defaultValue ? ` DEFAULT ${sqlString(column.defaultValue)}` : ""}`);
      return {
        data: { table, columns },
        sql: `CREATE TABLE IF NOT EXISTS \`${table}\` (\n  \`id\` INT AUTO_INCREMENT PRIMARY KEY,\n${lines.join(",\n")}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n`,
        stats: [stat("Table", table), stat("Colonnes", String(columns.length))],
        diagnostics: columns.length === 0 ? [{ level: "warning", message: "Aucune colonne definie : seule la cle primaire sera creee." }] : [],
      };
    },
  }),
  moduleTool({
    slug: "server-rate-limit",
    name: "Limiteur de debit serveur",
    category: "dev",
    description: "Ajoute un limiteur de debit par joueur pour proteger un evenement.",
    icon: "Code2",
    tags: ["securite", "rate-limit", "serveur"],
    fields: [
      { name: "eventName", label: "Evenement", type: "text", default: "inventory:useItem" },
      { name: "limit", label: "Actions autorisees", type: "number", default: 5, min: 1, max: 100 },
      { name: "windowMs", label: "Fenetre (ms)", type: "number", default: 1000, min: 100, max: 60000 },
      { name: "message", label: "Message", type: "text", default: "Trop de requetes, patientez." },
    ],
    build: (input) => {
      const eventName = str(input, "eventName", "action");
      const limit = num(input, "limit", 5);
      const windowMs = num(input, "windowMs", 1000);
      return {
        data: { eventName, limit, windowMs, message: str(input, "message", "Trop de requetes.") },
        lua: `local buckets = {}\n\nfunction AllowAction(src, action)\n  local key = ('%s:%s'):format(src, action)\n  local now = GetGameTimer()\n  local bucket = buckets[key]\n  if not bucket or now - bucket.start >= Config.ServerRateLimit.windowMs then\n    buckets[key] = { start = now, count = 1 }\n    return true\n  end\n  if bucket.count >= Config.ServerRateLimit.limit then return false end\n  bucket.count = bucket.count + 1\n  return true\nend\n\nRegisterNetEvent(${luaString(eventName)}, function()\n  local src = source\n  if not AllowAction(src, ${luaString(eventName)}) then\n    DropPlayer(src, Config.ServerRateLimit.message)\n    return\n  end\n  -- Traiter l'action ici.\nend)\n`,
        stats: [stat("Evenement", eventName), stat("Limite", `${limit} / ${windowMs} ms`)],
      };
    },
  }),
  moduleTool({
    slug: "server-logger",
    name: "Logger serveur",
    category: "dev",
    description: "Genere un logger commun avec niveau, fichier et relais Discord optionnel.",
    icon: "TerminalSquare",
    tags: ["logs", "debug", "serveur"],
    fields: [
      { name: "prefix", label: "Prefixe", type: "text", default: "[fdm]" },
      { name: "level", label: "Niveau", type: "select", options: [{ value: "debug", label: "Debug" }, { value: "info", label: "Info" }, { value: "warn", label: "Warning" }, { value: "error", label: "Error" }], default: "info" },
      { name: "file", label: "Fichier", type: "text", default: "logs/server.log" },
      { name: "discord", label: "Relais Discord", type: "switch", default: false },
    ],
    build: (input) => {
      const level = str(input, "level", "info");
      return {
        data: { prefix: str(input, "prefix", "[fdm]"), level, file: str(input, "file", "logs/server.log"), discord: bool(input, "discord") },
        lua: `local levels = { debug = 10, info = 20, warn = 30, error = 40 }\nlocal threshold = levels[Config.ServerLogger.level] or 20\n\nfunction Log(level, ...)\n  if (levels[level] or 20) < threshold then return end\n  local message = table.concat({ ... }, ' ')\n  local line = ('%s [%s] %s'):format(Config.ServerLogger.prefix, level:upper(), message)\n  print(line)\n  if Config.ServerLogger.discord and level == 'error' then\n    TriggerEvent('fdm:logger:discord', line)\n  end\nend\n`,
        stats: [stat("Niveau", level), stat("Discord", bool(input, "discord") ? "Oui" : "Non")],
      };
    },
  }),
  moduleTool({
    slug: "config-loader",
    name: "Chargeur de configuration",
    category: "dev",
    description: "Valide les cles obligatoires d'une configuration et applique des valeurs par defaut.",
    icon: "Settings",
    tags: ["config", "validation", "dev"],
    fields: [
      { name: "resource", label: "Ressource", type: "text", default: "mon_resource" },
      { name: "requiredKeysCsv", label: "Cles obligatoires", type: "text", default: "locale, debug" },
      { name: "defaultsCsv", label: "Defauts (key,value)", type: "textarea", rows: 4, default: "locale,fr\ndebug,false" },
      { name: "strict", label: "Mode strict", type: "switch", default: true },
    ],
    build: (input) => {
      const required = list(input, "requiredKeysCsv", "locale");
      const defaults = rows(input, "defaultsCsv", ["key", "value"]);
      return {
        data: { resource: safeSlug(str(input, "resource", "mon_resource")), requiredKeys: required, defaults: Object.fromEntries(defaults.map((row) => [row.key, row.value])), strict: bool(input, "strict", true) },
        lua: `local required = ${JSON.stringify(required)}\nlocal defaults = ${JSON.stringify(Object.fromEntries(defaults.map((row) => [row.key, row.value])))}\n\nfunction ValidateConfig(config)\n  for _, key in ipairs(required) do\n    if config[key] == nil then\n      if Config.ConfigLoader.strict then error(('Configuration manquante : %s'):format(key)) end\n      config[key] = defaults[key]\n    end\n  end\n  return config\nend\n`,
        stats: [stat("Obligatoires", String(required.length)), stat("Defauts", String(defaults.length))],
      };
    },
  }),
  moduleTool({
    slug: "permission-matrix",
    name: "Matrice de permissions",
    category: "dev",
    description: "Genere une matrice de roles et de permissions avec les ACE correspondantes.",
    icon: "Users",
    tags: ["permissions", "ace", "roles"],
    fields: [
      { name: "rolesCsv", label: "Roles", type: "text", default: "admin, mod, support, joueur" },
      { name: "permissionsCsv", label: "Permissions", type: "text", default: "vehicle.spawn, vehicle.delete, report.read, admin.menu" },
      { name: "acePrefix", label: "Prefixe ACE", type: "text", default: "fdm" },
    ],
    build: (input) => {
      const roles = list(input, "rolesCsv", "joueur").map((role) => safeSlug(role, "role"));
      const permissions = list(input, "permissionsCsv", "admin.menu").map((permission) => safeSlug(permission, "permission"));
      const prefix = safeSlug(str(input, "acePrefix", "fdm"), "fdm");
      const matrix = mdTable(["Permission", ...roles], permissions.map((permission) => [permission, ...roles.map((role) => `${prefix}.${role}.${permission}`)]));
      return {
        data: { roles, permissions, acePrefix: prefix },
        files: [file("permissions.md", `# Matrice de permissions\n\n${matrix}\n`, "markdown")],
        lua: `function HasPermission(src, permission)\n  for _, role in ipairs(Config.PermissionMatrix.roles) do\n    if IsPlayerAceAllowed(src, ('%s.%s.%s'):format(Config.PermissionMatrix.acePrefix, role, permission)) then\n      return true\n    end\n  end\n  return false\nend\n`,
        stats: [stat("Roles", String(roles.length)), stat("Permissions", String(permissions.length))],
      };
    },
  }),
  moduleTool({
    slug: "nui-store",
    name: "Store NUI",
    category: "dev",
    description: "Genere un petit store JavaScript pour une interface NUI avec actions.",
    icon: "Code2",
    tags: ["nui", "javascript", "interface"],
    fields: [
      { name: "appId", label: "Application", type: "text", default: "monapp" },
      { name: "initialStateCsv", label: "Etat initial (key,value)", type: "textarea", rows: 4, default: "page,home\nloading,false" },
      { name: "actionsCsv", label: "Actions (name,description)", type: "textarea", rows: 4, default: "setPage,Changer de page\nrefresh,Recharger les donnees" },
    ],
    build: (input) => {
      const appId = safeSlug(str(input, "appId", "monapp"), "monapp");
      const initialState = Object.fromEntries(rows(input, "initialStateCsv", ["key", "value"]).map((row) => [row.key, row.value]));
      const actions = rows(input, "actionsCsv", ["name", "description"]);
      return {
        data: { appId, initialState, actions },
        files: [file("ui/store.js", `export function createStore(initial = ${JSON.stringify(initialState, null, 2)}) {\n  let state = { ...initial }\n  const listeners = new Set()\n  return {\n    getState: () => state,\n    setState(patch) { state = { ...state, ...patch }; listeners.forEach((listener) => listener(state)) },\n    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },\n  }\n}\n\nexport const store = createStore()\n`, "javascript")],
        stats: [stat("Actions", String(actions.length)), stat("Cles", String(Object.keys(initialState).length))],
      };
    },
  }),
  moduleTool({
    slug: "sql-transaction",
    name: "Transaction SQL",
    category: "dev",
    description: "Genere un helper de transaction oxmysql avec rollback et tentatives.",
    icon: "Database",
    tags: ["sql", "transaction", "oxmysql"],
    fields: [
      { name: "table", label: "Table", type: "text", default: "player_inventory" },
      { name: "queriesCsv", label: "Requetes", type: "textarea", rows: 4, default: "SELECT * FROM player_inventory WHERE identifier = ?\nUPDATE player_inventory SET updated_at = NOW() WHERE identifier = ?" },
      { name: "retries", label: "Tentatives", type: "number", default: 2, min: 0, max: 10 },
    ],
    build: (input) => {
      const queries = list(input, "queriesCsv", "SELECT 1");
      return {
        data: { table: safeSlug(str(input, "table", "player_inventory")), queries, retries: num(input, "retries", 2) },
        lua: `function RunTransaction(identifier)\n  local attempts = Config.SqlTransaction.retries + 1\n  for attempt = 1, attempts do\n    local ok, result = pcall(function()\n      return MySQL.transaction.await({\n        { query = 'SELECT * FROM ${safeSlug(str(input, "table", "player_inventory"))} WHERE identifier = ?', values = { identifier } },\n      })\n    end)\n    if ok then return result end\n    print(('[sql] transaction echouee (tentative %d/%d) : %s'):format(attempt, attempts, result))\n  end\n  return nil\nend\n`,
        stats: [stat("Requetes", String(queries.length)), stat("Tentatives", String(num(input, "retries", 2) + 1))],
      };
    },
  }),
  moduleTool({
    slug: "event-validator",
    name: "Validateur d'evenements",
    category: "dev",
    description: "Valide les champs d'un evenement serveur et bloque les payloads invalides.",
    icon: "Code2",
    tags: ["securite", "evenement", "validation"],
    fields: [
      { name: "eventName", label: "Evenement", type: "text", default: "shop:buy" },
      { name: "fieldsCsv", label: "Champs (name,type,required)", type: "textarea", rows: 4, default: "item,string,1\nquantity,number,1" },
      { name: "maxPayload", label: "Taille max (octets)", type: "number", default: 2048, min: 64, max: 65536 },
      { name: "logOnly", label: "Journaliser seulement", type: "switch", default: false },
    ],
    build: (input) => {
      const fields = rows(input, "fieldsCsv", ["name", "type", "required"]).map((row) => ({ name: safeSlug(row.name, "field"), type: row.type || "string", required: row.required === "1" || row.required.toLowerCase() === "true" }));
      return {
        data: { eventName: str(input, "eventName", "event"), fields, maxPayload: num(input, "maxPayload", 2048), logOnly: bool(input, "logOnly") },
        lua: `local schema = ${JSON.stringify(fields, null, 2)}\n\nfunction ValidatePayload(payload)\n  if type(payload) ~= 'table' then return false, 'payload invalide' end\n  for _, field in ipairs(schema) do\n    local value = payload[field.name]\n    if field.required and value == nil then return false, field.name .. ' requis' end\n    if value ~= nil and type(value) ~= field.type then return false, field.name .. ' doit etre ' .. field.type end\n  end\n  return true\nend\n\nRegisterNetEvent(${luaString(str(input, "eventName", "event"))}, function(payload)\n  local src = source\n  local ok, reason = ValidatePayload(payload)\n  if not ok then\n    print(('[event] %s rejete pour %s : %s'):format(GetPlayerName(src), ${luaString(str(input, "eventName", "event"))}, reason))\n    return\n  end\n  -- Traiter le payload valide.\nend)\n`,
        stats: [stat("Champs", String(fields.length)), stat("Mode", bool(input, "logOnly") ? "Journal" : "Blocage")],
      };
    },
  }),
  moduleTool({
    slug: "resource-metrics",
    name: "Metriques de ressource",
    category: "dev",
    description: "Genere une boucle de collecte de metriques serveur (joueurs, entites, temps).",
    icon: "TerminalSquare",
    tags: ["metriques", "performance", "monitoring"],
    fields: [
      { name: "resource", label: "Ressource", type: "text", default: "mon_resource" },
      { name: "intervalMs", label: "Intervalle (ms)", type: "number", default: 30000, min: 1000, max: 300000 },
      { name: "logFile", label: "Fichier", type: "text", default: "metrics.jsonl" },
      { name: "samplePlayers", label: "Echantillonner les joueurs", type: "switch", default: true },
    ],
    build: (input) => ({
      data: { resource: safeSlug(str(input, "resource", "mon_resource")), intervalMs: num(input, "intervalMs", 30000), logFile: str(input, "logFile", "metrics.jsonl"), samplePlayers: bool(input, "samplePlayers", true) },
      lua: `CreateThread(function()\n  while true do\n    local sample = {\n      resource = ${luaString(safeSlug(str(input, "resource", "mon_resource")))},\n      players = #GetPlayers(),\n      entities = #GetAllVehicles() + #GetAllPeds() + #GetAllObjects(),\n      timestamp = os.time(),\n    }\n    SaveResourceFile(GetCurrentResourceName(), Config.ResourceMetrics.logFile, json.encode(sample) .. '\\n', -1)\n    Wait(Config.ResourceMetrics.intervalMs)\n  end\nend)\n`,
      stats: [stat("Intervalle", `${num(input, "intervalMs", 30000)} ms`), stat("Joueurs", bool(input, "samplePlayers", true) ? "Oui" : "Non")],
    }),
  }),
  moduleTool({
    slug: "convar-config",
    name: "Convars de ressource",
    category: "dev",
    description: "Prepare les convars d'une ressource avec valeurs par defaut et validation.",
    icon: "Settings",
    tags: ["convars", "config", "serveur"],
    fields: [
      { name: "resource", label: "Ressource", type: "text", default: "mon_resource" },
      { name: "convarsCsv", label: "Convars (name,default,description)", type: "textarea", rows: 5, default: "locale,fr,Langue de la ressource\ndebug,false,Active les logs de debug" },
      { name: "strict", label: "Strict", type: "switch", default: true },
    ],
    build: (input) => {
      const convars = rows(input, "convarsCsv", ["name", "default", "description"]);
      return {
        data: { resource: safeSlug(str(input, "resource", "mon_resource")), convars, strict: bool(input, "strict", true) },
        lua: `local convars = ${JSON.stringify(convars.map((row) => ({ name: row.name, default: row.default })), null, 2)}\n\nfunction LoadConvars()\n  local values = {}\n  for _, convar in ipairs(convars) do\n    local value = GetConvar(convar.name, '')\n    if value == '' and Config.ConvarConfig.strict then\n      error(('Convar manquante : %s'):format(convar.name))\n    end\n    values[convar.name] = value ~= '' and value or convar.default\n  end\n  return values\nend\n`,
        stats: [stat("Convars", String(convars.length)), stat("Strict", bool(input, "strict", true) ? "Oui" : "Non")],
      };
    },
  }),
];
