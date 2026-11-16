import {
  file,
  luaString,
  num,
  parseNumberList,
  parseTable,
  result,
  safeSlug,
  splitList,
  stat,
  str,
} from "../helpers";
import type { StudioTool } from "../types";

const frameworkOptions = [
  { value: "standalone", label: "Standalone" },
  { value: "qb", label: "QBCore" },
  { value: "esx", label: "ESX" },
  { value: "ox", label: "ox_lib / oxmysql" },
];

export const devTools: StudioTool[] = [
  {
    slug: "fxmanifest",
    name: "Generateur fxmanifest",
    category: "dev",
    description: "Genere un fxmanifest.lua complet : scripts, dependances, lua54 et escrow.",
    icon: "FileCode2",
    tags: ["manifest", "ressource", "fxmanifest"],
    fields: [
      { name: "resourceName", label: "Ressource", type: "text", default: "mon_resource", required: true },
      { name: "author", label: "Auteur", type: "text", default: "ChicagoRP" },
      { name: "version", label: "Version", type: "text", default: "1.0.0" },
      { name: "description", label: "Description", type: "text", default: "Ressource FiveM" },
      { name: "clientScripts", label: "Scripts client", type: "text", default: "client/main.lua" },
      { name: "serverScripts", label: "Scripts serveur", type: "text", default: "server/main.lua" },
      { name: "sharedScripts", label: "Scripts partages", type: "text", default: "shared/config.lua" },
      { name: "dependencies", label: "Dependances", type: "text", default: "" },
      { name: "lua54", label: "Lua 5.4", type: "switch", default: true },
      { name: "escrow", label: "Escrow ignore", type: "switch", default: false },
    ],
    run: (input) => {
      const lines = [
        "fx_version 'cerulean'",
        "game 'gta5'",
        "",
        `author ${luaString(str(input, "author", "ChicagoRP"))}`,
        `description ${luaString(str(input, "description", "Ressource FiveM"))}`,
        `version ${luaString(str(input, "version", "1.0.0"))}`,
      ];
      if (str(input, "lua54", "true") === "true") lines.push("lua54 'yes'");
      if (str(input, "escrow", "false") === "true") lines.push("escrow_ignore { '**/*.lua' }");
      const dependencies = splitList(str(input, "dependencies", ""));
      if (dependencies.length) lines.push("", `dependencies { ${dependencies.map((dep) => luaString(dep)).join(", ")} }`);
      const client = splitList(str(input, "clientScripts", ""));
      const server = splitList(str(input, "serverScripts", ""));
      const shared = splitList(str(input, "sharedScripts", ""));
      if (shared.length) lines.push("", "shared_scripts {", ...shared.map((script) => `  ${luaString(script)},`), "}");
      if (client.length) lines.push("", "client_scripts {", ...client.map((script) => `  ${luaString(script)},`), "}");
      if (server.length) lines.push("", "server_scripts {", ...server.map((script) => `  ${luaString(script)},`), "}");
      return result("fxmanifest.lua genere.", [file("fxmanifest.lua", `${lines.join("\n")}\n`, "lua")], {
        notes: ["Adaptez les chemins de scripts a votre arborescence reelle."],
      });
    },
  },
  {
    slug: "resource-boilerplate",
    name: "Boilerplate de ressource",
    category: "dev",
    description: "Cree la structure client/server/shared avec un framework et des locales.",
    icon: "FolderTree",
    tags: ["boilerplate", "ressource", "framework"],
    fields: [
      { name: "resourceName", label: "Ressource", type: "text", default: "mon_resource", required: true },
      { name: "framework", label: "Framework", type: "select", options: frameworkOptions, default: "standalone" },
      { name: "includeClient", label: "Client", type: "switch", default: true },
      { name: "includeServer", label: "Serveur", type: "switch", default: true },
      { name: "includeLocales", label: "Locales", type: "switch", default: true },
      { name: "includeCommand", label: "Commande /resource", type: "switch", default: true },
    ],
    run: (input) => {
      const name = safeSlug(str(input, "resourceName", "mon_resource"), "mon_resource");
      const framework = str(input, "framework", "standalone");
      const files = [
        file("fxmanifest.lua", `fx_version 'cerulean'\ngame 'gta5'\n\nauthor 'FiveM DevManager'\ndescription ${luaString(name)}\nversion '1.0.0'\nlua54 'yes'\n\nshared_scripts {\n  'shared/config.lua',\n}\n\nclient_scripts {\n  'client/main.lua',\n}\n\nserver_scripts {\n  'server/main.lua',\n}\n`, "lua"),
        file("shared/config.lua", `Config = Config or {}\nConfig.ResourceName = ${luaString(name)}\nConfig.Framework = ${luaString(framework)}\nConfig.Command = ${luaString(name)}\n`, "lua"),
      ];
      if (str(input, "includeClient", "true") === "true") {
        files.push(file("client/main.lua", `local function notify(message, kind)\n  TriggerEvent('chat:addMessage', { args = { ${luaString(name)}, message } })\nend\n\nRegisterNetEvent('${name}:client', function(payload)\n  if type(payload) ~= 'table' then return end\n  notify(tostring(payload.message or ''), payload.kind)\nend)\n`, "lua"));
      }
      if (str(input, "includeServer", "true") === "true") {
        files.push(file("server/main.lua", `local resourceName = GetCurrentResourceName()\n\nif ${str(input, "includeCommand", "true") === "true" ? "true" : "false"} then\n  RegisterCommand(Config.Command, function(source, args)\n    if source == 0 then return end\n    TriggerClientEvent(resourceName .. ':client', source, { message = 'Commande executee', kind = 'info' })\n  end, false)\nend\n`, "lua"));
      }
      if (str(input, "includeLocales", "true") === "true") {
        files.push(file("locales/fr.lua", `Locales = Locales or {}\nLocales.fr = {\n  welcome = 'Bienvenue sur ${name}',\n  command_usage = '/${name}',\n}\n`, "lua"));
        files.push(file("locales/en.lua", `Locales = Locales or {}\nLocales.en = {\n  welcome = 'Welcome to ${name}',\n  command_usage = '/${name}',\n}\n`, "lua"));
      }
      files.push(file("README.md", `# ${name}\n\nStructure generee pour un framework ${framework}.\n\n- Verifiez les chemins dans fxmanifest.lua.\n- Branchez vos evenements serveur sur votre framework.\n- Ne faites jamais confiance aux donnees client.\n`, "markdown"));
      return result(`Boilerplate ${name} genere (${files.length} fichiers).`, files, { stats: [stat("Fichiers", String(files.length)), stat("Framework", framework)] });
    },
  },
  {
    slug: "server-cfg",
    name: "Generateur server.cfg",
    category: "dev",
    description: "Prepare un server.cfg avec endpoints, ressources et limites, sans secret.",
    icon: "ServerCog",
    tags: ["server.cfg", "serveur", "configuration"],
    fields: [
      { name: "serverName", label: "Nom du serveur", type: "text", default: "ChicagoRP" },
      { name: "port", label: "Port", type: "number", default: 30120, min: 1024, max: 65535 },
      { name: "maxClients", label: "Slots", type: "number", default: 64, min: 1, max: 1024 },
      { name: "resourcesCsv", label: "Ressources (ensure, une par ligne)", type: "textarea", rows: 6, default: "ensure oxmysql\nensure ox_lib\nensure chat\nensure spawnmanager" },
      { name: "endpoints", label: "Endpoints / secrets", type: "text", default: "sv_licenseKey \"COLLEZ_VOTRE_CLE_ICI\"" },
    ],
    run: (input) => {
      const resources = str(input, "resourcesCsv", "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const config = `# Configuration generee par FiveM DevManager\n# Ne commitez jamais vos vraies cles dans un depot public.\nsv_hostname ${luaString(str(input, "serverName", "ChicagoRP"))}\nsv_maxclients ${num(input, "maxClients", 64)}\nsv_port ${num(input, "port", 30120)}\n${str(input, "endpoints", "")}\n\nsetr sv_licenseKey "COLLEZ_VOTRE_CLE_ICI"\n\n${resources.join("\n")}\n`;
      return result("server.cfg prepare.", [file("server.cfg", config, "ini"), file("resources.txt", resources.join("\n"), "text")], {
        warnings: ["Les cles et licences doivent rester hors du depot. Remplacez les placeholders avant demarrage."],
        diagnostics: config.includes("COLLEZ_VOTRE_CLE") ? [{ level: "warning", message: "La licence FiveM est un placeholder." }] : [],
      });
    },
  },
  {
    slug: "ace-permissions",
    name: "Permissions ACE",
    category: "dev",
    description: "Genere les groupes, principals et permissions ACE pour les commandes sensibles.",
    icon: "KeyRound",
    tags: ["ace", "permissions", "securite"],
    fields: [
      { name: "group", label: "Groupe", type: "text", default: "admin" },
      { name: "principalsCsv", label: "Principals (identifier)", type: "textarea", rows: 4, default: "license:CHANGE_ME" },
      { name: "permissionsCsv", label: "Permissions (nom,allow)", type: "textarea", rows: 5, default: "fdm.vehicle,allow\nfdm.mlo,allow\nfdm.admin,allow" },
    ],
    run: (input) => {
      const group = safeSlug(str(input, "group", "admin"), "admin");
      const principals = splitList(str(input, "principalsCsv", ""));
      const permissions = parseTable(str(input, "permissionsCsv", ""), ["name", "allow"]);
      const lines = [
        `# ACE genere pour le groupe ${group}`,
        ...principals.map((principal) => `add_principal identifier.${principal} group.${group}`),
        "",
        ...permissions.map((permission) => `add_ace group.${group} ${permission.name} ${permission.allow || "allow"}`),
      ];
      return result(`Permissions ACE pour ${group} generees.`, [file("permissions.cfg", `${lines.join("\n")}\n`, "ini")], {
        stats: [stat("Principals", String(principals.length)), stat("Permissions", String(permissions.length))],
        warnings: ["Ne partagez pas les identifiants de licence reels dans un fichier public."],
      });
    },
  },
  {
    slug: "oxmysql-query",
    name: "Requete oxmysql",
    category: "dev",
    description: "Genere une requete SQL parametree et son wrapper Lua oxmysql.",
    icon: "Database",
    tags: ["oxmysql", "sql", "lua"],
    fields: [
      { name: "table", label: "Table", type: "text", default: "players", required: true },
      { name: "columnsCsv", label: "Colonnes", type: "text", default: "identifier, name, money" },
      { name: "whereClause", label: "Condition", type: "text", default: "identifier = ?" },
      { name: "orderBy", label: "Tri", type: "text", default: "id DESC" },
      { name: "limit", label: "Limite", type: "number", default: 1, min: 1, max: 1000 },
      { name: "functionName", label: "Fonction Lua", type: "text", default: "GetPlayerRow" },
    ],
    run: (input) => {
      const table = safeSlug(str(input, "table", "players"), "players");
      const columns = splitList(str(input, "columnsCsv", "*")).join(", ") || "*";
      const where = str(input, "whereClause", "").trim();
      const order = str(input, "orderBy", "").trim();
      const limit = Math.max(1, Math.min(1000, num(input, "limit", 1)));
      const sql = `SELECT ${columns} FROM \`${table}\`${where ? ` WHERE ${where}` : ""}${order ? ` ORDER BY ${order}` : ""} LIMIT ${limit};`;
      const functionName = safeSlug(str(input, "functionName", "GetRow"), "GetRow");
      const lua = `--- Requete generee : ${sql}\nfunction ${functionName}(...)\n  local params = { ... }\n  local row = MySQL.single.await(${luaString(sql)}, params)\n  return row\nend\n`;
      return result("Requete SQL et wrapper oxmysql generes.", [file("query.sql", sql, "sql"), file("query.lua", lua, "lua")], {
        warnings: ["Utilisez toujours des parametres (?) et validez les entrees avant la requete."],
      });
    },
  },
  {
    slug: "event-bridge",
    name: "Pont d'evenements",
    category: "dev",
    description: "Genere un pont client/serveur avec validation de payload et limitation de debit.",
    icon: "ArrowLeftRight",
    tags: ["events", "securite", "lua"],
    fields: [
      { name: "eventName", label: "Evenement", type: "text", default: "resource:action", required: true },
      { name: "direction", label: "Direction", type: "select", options: [{ value: "client-server", label: "Client -> Serveur" }, { value: "server-client", label: "Serveur -> Client" }, { value: "both", label: "Les deux" }], default: "client-server" },
      { name: "payloadFieldsCsv", label: "Champs payload", type: "text", default: "id, amount" },
      { name: "rateLimitMs", label: "Rate limit (ms)", type: "number", default: 1000, min: 0 },
    ],
    run: (input) => {
      const eventName = safeSlug(str(input, "eventName", "resource:action"), "resource:action");
      const fields = splitList(str(input, "payloadFieldsCsv", ""));
      const rate = Math.max(0, num(input, "rateLimitMs", 1000));
      const server = `local lastCall = {}\n\nRegisterNetEvent(${luaString(eventName)}, function(payload)\n  local src = source\n  if lastCall[src] and (GetGameTimer() - lastCall[src]) < ${rate} then return end\n  lastCall[src] = GetGameTimer()\n  if type(payload) ~= 'table' then return end\n${fields.map((field) => `  if payload.${field} == nil then return end`).join("\n")}\n  -- TODO: verifier les permissions et les valeurs cote serveur\nend)\n`;
      const client = `--- Envoi valide\nlocal function Send(payload)\n  TriggerServerEvent(${luaString(eventName)}, payload)\nend\n`;
      return result("Pont d'evenements genere.", [file("server.lua", server, "lua"), file("client.lua", client, "lua")], {
        warnings: ["Ne faites jamais confiance au client : revalidez chaque champ et les permissions cote serveur."],
      });
    },
  },
  {
    slug: "nui-bridge",
    name: "Pont NUI",
    category: "dev",
    description: "Cree une interface NUI minimale avec messages, callbacks et securite de base.",
    icon: "PanelTop",
    tags: ["nui", "ui", "lua"],
    fields: [
      { name: "appName", label: "Application", type: "text", default: "mon_app" },
      { name: "messagesCsv", label: "Messages (nom,description)", type: "textarea", rows: 4, default: "open,Ouvrir l'interface\nclose,Fermer l'interface\nsubmit,Envoyer le formulaire" },
      { name: "framework", label: "Framework", type: "select", options: frameworkOptions, default: "standalone" },
    ],
    run: (input) => {
      const app = safeSlug(str(input, "appName", "mon_app"), "mon_app");
      const messages = parseTable(str(input, "messagesCsv", ""), ["name", "description"]);
      const files = [
        file("fxmanifest.lua", `fx_version 'cerulean'\ngame 'gta5'\n\nui_page 'ui/index.html'\n\nfiles {\n  'ui/index.html',\n  'ui/style.css',\n  'ui/script.js',\n}\n\nclient_script 'client.lua'\n`, "lua"),
        file("client.lua", `local appName = ${luaString(app)}\n\nRegisterNUICallback('submit', function(data, cb)\n  cb({ ok = true })\n  TriggerEvent(appName .. ':submitted', data)\nend)\n\nRegisterCommand(appName, function()\n  SetNuiFocus(true, true)\n  SendNUIMessage({ type = 'open' })\nend, false)\n`, "lua"),
        file("ui/index.html", `<!doctype html>\n<html lang="fr">\n<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="style.css"><title>${app}</title></head>\n<body>\n  <main id="app"><h1>${app}</h1><button id="submit">Envoyer</button></main>\n  <script src="script.js"></script>\n</body>\n</html>\n`, "html"),
        file("ui/script.js", `const submit = document.getElementById('submit')\nsubmit.addEventListener('click', () => {\n  fetch('https://${app}/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: 'test' }) })\n})\n\nwindow.addEventListener('message', (event) => {\n  if (event.data.type === 'open') document.body.classList.add('visible')\n})\n`, "javascript"),
        file("ui/style.css", `body { margin: 0; font-family: system-ui, sans-serif; background: transparent; color: #fff; }\n#app { display: none; max-width: 420px; margin: 12vh auto; padding: 24px; border-radius: 16px; background: #0f1420; border: 1px solid #263247; }\nbody.visible #app { display: block; }\nbutton { padding: 10px 14px; border-radius: 8px; border: 0; background: #5865f2; color: white; cursor: pointer; }\n`, "css"),
      ];
      return result(`Interface NUI ${app} generee.`, files, {
        stats: [stat("Messages", String(messages.length)), stat("Fichiers", String(files.length))],
        warnings: ["Validez les callbacks NUI cote client et limitez SetNuiFocus aux moments necessaires."],
      });
    },
  },
  {
    slug: "framework-bridge",
    name: "Pont framework unifie",
    category: "dev",
    description: "Genere un pont client/serveur pour ESX, QBCore, ox ou standalone : joueur, permissions, argent, inventaire et notifications.",
    icon: "ArrowLeftRight",
    tags: ["framework", "esx", "qbcore", "ox", "bridge"],
    fields: [
      { name: "resourceName", label: "Ressource", type: "text", default: "mon_resource", required: true },
      { name: "framework", label: "Framework cible", type: "select", options: frameworkOptions, default: "esx" },
      { name: "prefix", label: "Prefixe Lua", type: "text", default: "Bridge" },
      { name: "command", label: "Commande de test", type: "text", default: "bridge" },
      { name: "adminOnly", label: "Commande reservee aux admins", type: "switch", default: true },
    ],
    run: (input) => {
      const resource = safeSlug(str(input, "resourceName", "mon_resource"), "mon_resource");
      const requestedFramework = str(input, "framework", "esx");
      const framework = ["esx", "qb", "ox", "standalone"].includes(requestedFramework)
        ? requestedFramework
        : "standalone";
      const frameworkLabel =
        frameworkOptions.find((option) => option.value === framework)?.label ?? "Standalone";
      const prefix =
        str(input, "prefix", "Bridge")
          .replace(/[^A-Za-z0-9_]/g, "")
          .replace(/^[^A-Za-z_]+/, "")
          .slice(0, 40) || "Bridge";
      const command = safeSlug(str(input, "command", "bridge"), "bridge");
      const adminOnly = str(input, "adminOnly", "true") === "true";
      const adminCheck = adminOnly
        ? `not ${prefix}.HasPermission(source, 'fdm.bridge.test')`
        : "false";

      const dependencies =
        framework === "esx"
          ? "dependencies { 'es_extended' }"
          : framework === "qb"
            ? "dependencies { 'qb-core' }"
            : framework === "ox"
              ? "dependencies { 'ox_lib', 'ox_inventory' }"
              : "";
      const manifest = `fx_version 'cerulean'\ngame 'gta5'\nlua54 'yes'\n${dependencies ? `\n${dependencies}\n` : ""}\nshared_scripts {\n  'shared/config.lua',\n}\n\nserver_scripts {\n  'server/bridge.lua',\n}\n\nclient_scripts {\n  'client/bridge.lua',\n}\n`;
      const config = `Config = Config or {}\nConfig.ResourceName = ${luaString(resource)}\nConfig.Framework = ${luaString(framework)}\nConfig.TestCommand = ${luaString(command)}\n`;
      const server = `local Config = Config or {}\nlocal Framework = Config.Framework\nlocal ESX, QBCore\n\nif Framework == 'esx' then\n  ESX = exports['es_extended']:getSharedObject()\nelseif Framework == 'qb' then\n  QBCore = exports['qb-core']:GetCoreObject()\nend\n\n${prefix} = ${prefix} or {}\n\nfunction ${prefix}.GetPlayer(source)\n  if Framework == 'esx' and ESX then\n    return ESX.GetPlayerFromId(source)\n  end\n  if Framework == 'qb' and QBCore then\n    return QBCore.Functions.GetPlayer(source)\n  end\n  return nil\nend\n\nfunction ${prefix}.HasPermission(source, ace)\n  return source == 0 or IsPlayerAceAllowed(source, ace)\nend\n\nfunction ${prefix}.Notify(source, message, kind)\n  TriggerClientEvent(Config.ResourceName .. ':notify', source, message, kind)\nend\n\nfunction ${prefix}.AddMoney(source, amount, account, reason)\n  amount = math.floor(tonumber(amount) or 0)\n  account = account == 'bank' and 'bank' or 'cash'\n  if amount < 1 or amount > 100000 then return false, 'invalid_amount' end\n\n  if Framework == 'esx' and ESX then\n    local player = ESX.GetPlayerFromId(source)\n    if not player then return false, 'player_not_found' end\n    if account == 'bank' then\n      player.addAccountMoney('bank', amount)\n    else\n      player.addMoney(amount)\n    end\n    return true\n  end\n\n  if Framework == 'qb' and QBCore then\n    local player = QBCore.Functions.GetPlayer(source)\n    if not player then return false, 'player_not_found' end\n    player.Functions.AddMoney(account, amount, reason or 'bridge')\n    return true\n  end\n\n  return false, 'not_supported'\nend\n\nfunction ${prefix}.AddItem(source, item, count)\n  item = tostring(item or '')\n  count = math.floor(tonumber(count) or 0)\n  if not item:match('^[%w_%-]+$') or count < 1 or count > 1000 then\n    return false, 'invalid_item'\n  end\n\n  if Framework == 'esx' and ESX then\n    local player = ESX.GetPlayerFromId(source)\n    if not player then return false, 'player_not_found' end\n    player.addInventoryItem(item, count)\n    return true\n  end\n\n  if Framework == 'qb' and QBCore then\n    local player = QBCore.Functions.GetPlayer(source)\n    if not player then return false, 'player_not_found' end\n    player.Functions.AddItem(item, count)\n    return true\n  end\n\n  if Framework == 'ox' then\n    return exports.ox_inventory:AddItem(source, item, count) == true\n  end\n\n  return false, 'not_supported'\nend\n\nfunction ${prefix}.RemoveItem(source, item, count)\n  item = tostring(item or '')\n  count = math.floor(tonumber(count) or 0)\n  if not item:match('^[%w_%-]+$') or count < 1 or count > 1000 then\n    return false, 'invalid_item'\n  end\n\n  if Framework == 'esx' and ESX then\n    local player = ESX.GetPlayerFromId(source)\n    if not player then return false, 'player_not_found' end\n    player.removeInventoryItem(item, count)\n    return true\n  end\n\n  if Framework == 'qb' and QBCore then\n    local player = QBCore.Functions.GetPlayer(source)\n    if not player then return false, 'player_not_found' end\n    player.Functions.RemoveItem(item, count)\n    return true\n  end\n\n  if Framework == 'ox' then\n    return exports.ox_inventory:RemoveItem(source, item, count) == true\n  end\n\n  return false, 'not_supported'\nend\n\nRegisterCommand(Config.TestCommand, function(source)\n  if ${adminCheck} then return end\n  ${prefix}.Notify(source, ${luaString(`Pont ${frameworkLabel} operationnel.`)}, 'success')\nend, false)\n`;
      const client = `local Config = Config or {}\nlocal Framework = Config.Framework\nlocal ESX, QBCore\n\nif Framework == 'esx' then\n  ESX = exports['es_extended']:getSharedObject()\nelseif Framework == 'qb' then\n  QBCore = exports['qb-core']:GetCoreObject()\nend\n\nRegisterNetEvent(Config.ResourceName .. ':notify', function(message, kind)\n  if type(message) ~= 'string' then return end\n\n  if Framework == 'esx' and ESX then\n    ESX.ShowNotification(message)\n  elseif Framework == 'qb' and QBCore then\n    QBCore.Functions.Notify(message, kind or 'primary')\n  elseif Framework == 'ox' then\n    exports.ox_lib:notify({ description = message, type = kind or 'inform' })\n  else\n    TriggerEvent('chat:addMessage', { args = { ${luaString(prefix)}, message } })\n  end\nend)\n\nCreateThread(function()\n  Wait(1000)\n  print(('[%s] pont ${frameworkLabel} pret (%s)'):format(Config.ResourceName, Framework))\nend)\n`;
      const readme = `# ${resource}\n\nPont ${frameworkLabel} genere par FiveM DevManager.\n\n## Fonctions serveur\n\n- ${prefix}.GetPlayer(source)\n- ${prefix}.HasPermission(source, ace)\n- ${prefix}.Notify(source, message, kind)\n- ${prefix}.AddMoney(source, amount, account, reason)\n- ${prefix}.AddItem(source, item, count)\n- ${prefix}.RemoveItem(source, item, count)\n\n## Exemple\n\n\`\`\`lua\nlocal ok, reason = ${prefix}.AddMoney(source, 250, 'bank', 'salaire')\nif ok then\n  ${prefix}.Notify(source, 'Salaire recu', 'success')\nend\n\`\`\`\n\n## Limites\n\n- ox et standalone ne fournissent pas de compte bancaire : AddMoney retourne not_supported.\n- Le pont ne remplace pas les regles metier de votre serveur.\n- Validez toujours la source, les permissions et les quantites cote serveur.\n- Ne placez aucun secret dans shared/config.lua.\n`;

      return result(`Pont ${frameworkLabel} genere pour ${resource}.`, [
        file("fxmanifest.lua", manifest, "lua"),
        file("shared/config.lua", config, "lua"),
        file("server/bridge.lua", server, "lua"),
        file("client/bridge.lua", client, "lua"),
        file("README.md", readme, "markdown"),
      ], {
        stats: [
          stat("Framework", frameworkLabel),
          stat("Fonctions", "6"),
          stat("Fichiers", "5"),
        ],
        notes: [
          "Le pont normalise joueur, permissions, notifications et inventaire pour limiter les branches framework dans vos ressources.",
          "La commande de test est enregistree cote serveur et peut etre protegee par ACE.",
        ],
        warnings: [
          "AddMoney n'est pas disponible pour ox ou standalone : branchez votre economie sur votre base ou votre ressource financiere.",
          "Ne faites jamais confiance a un montant, un objet ou une source envoyes par le client.",
        ],
      });
    },
  },
  {
    slug: "ox-target-zone",
    name: "Zone ox_target",
    category: "dev",
    description: "Genere une zone ox_target cote client et un evenement serveur avec permission et verification de distance.",
    icon: "MapPin",
    tags: ["ox_target", "zone", "interaction", "client", "serveur"],
    fields: [
      { name: "zoneName", label: "Nom de la zone", type: "text", default: "shop_main", required: true },
      { name: "label", label: "Libelle", type: "text", default: "Ouvrir la boutique" },
      { name: "coords", label: "Coordonnees (x, y, z)", type: "text", default: "25.7, -1347.6, 29.5" },
      { name: "size", label: "Taille (x, y, z)", type: "text", default: "1.5, 1.5, 2.0" },
      { name: "rotation", label: "Rotation", type: "number", default: 0, min: -360, max: 360 },
      { name: "eventName", label: "Evenement serveur", type: "text", default: "shop:server:open" },
      { name: "permission", label: "Permission ACE", type: "text", default: "fdm.target.use" },
      { name: "icon", label: "Icone Font Awesome", type: "text", default: "fa-solid fa-store" },
    ],
    run: (input) => {
      const zoneName = safeSlug(str(input, "zoneName", "shop_main"), "shop_main");
      const label = str(input, "label", "Ouvrir la boutique");
      const icon = str(input, "icon", "fa-solid fa-store").replace(/[^A-Za-z0-9 _-]/g, "") || "fa-solid fa-store";
      const eventName = str(input, "eventName", "shop:server:open").replace(/[^A-Za-z0-9:_-]/g, "").slice(0, 80) || "target:server:action";
      const permission = str(input, "permission", "fdm.target.use").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80) || "fdm.target.use";
      const rawCoords = parseNumberList(str(input, "coords", "25.7, -1347.6, 29.5"));
      const rawSize = parseNumberList(str(input, "size", "1.5, 1.5, 2.0"));
      const coords = [rawCoords[0] ?? 0, rawCoords[1] ?? 0, rawCoords[2] ?? 0];
      const size = [
        Math.max(0.1, rawSize[0] ?? 1.5),
        Math.max(0.1, rawSize[1] ?? 1.5),
        Math.max(0.1, rawSize[2] ?? 2),
      ];
      const rotation = num(input, "rotation", 0);
      const radius = Math.max(2, Math.max(...size) + 1.5);
      const distance = Math.max(1.5, Math.max(...size) + 0.5);
      const manifest = `fx_version 'cerulean'\ngame 'gta5'\nlua54 'yes'\n\ndependencies {\n  'ox_lib',\n  'ox_target',\n}\n\nshared_scripts {\n  'shared/config.lua',\n}\n\nclient_scripts {\n  'client/target.lua',\n}\n\nserver_scripts {\n  'server/target.lua',\n}\n`;
      const config = `Config = Config or {}\nConfig.ResourceName = ${luaString(zoneName)}\nConfig.TargetEvent = ${luaString(eventName)}\nConfig.Permission = ${luaString(permission)}\n`;
      const client = `local Config = Config or {}\nlocal zoneName = ${luaString(zoneName)}\n\nexports.ox_target:addBoxZone({\n  name = zoneName,\n  coords = vec3(${coords.map((value) => Number(value).toFixed(2)).join(", ")}),\n  size = vec3(${size.map((value) => Number(value).toFixed(2)).join(", ")}),\n  rotation = ${rotation},\n  debug = false,\n  options = {\n    {\n      name = zoneName .. '_action',\n      icon = ${luaString(icon)},\n      label = ${luaString(label)},\n      distance = ${distance.toFixed(2)},\n      onSelect = function()\n        TriggerServerEvent(Config.TargetEvent)\n      end,\n    },\n  },\n})\n\nlocal NOTIFY_EVENT = zoneName .. ':client:success'\n\nRegisterNetEvent(NOTIFY_EVENT, function(message)\n  if type(message) ~= 'string' then return end\n  BeginTextCommandThefeedPost('STRING')\n  AddTextComponentSubstringPlayerName(message)\n  EndTextCommandThefeedPostTicker(false, true)\nend)\n`;
      const server = `local Config = Config or {}\nlocal ZONE_COORDS = vector3(${coords.map((value) => Number(value).toFixed(2)).join(", ")})\nlocal ZONE_RADIUS = ${radius.toFixed(2)}\nlocal NOTIFY_EVENT = ${luaString(zoneName)} .. ':client:success'\n\nRegisterNetEvent(Config.TargetEvent, function()\n  local src = source\n  if not IsPlayerAceAllowed(src, Config.Permission) then return end\n\n  local ped = GetPlayerPed(src)\n  if ped == 0 then return end\n\n  local coords = GetEntityCoords(ped)\n  if #(coords - ZONE_COORDS) > ZONE_RADIUS then return end\n\n  -- TODO: brancher ici l'action serveur reelle.\n  TriggerClientEvent(NOTIFY_EVENT, src, ${luaString(`Zone ${label} validee.`)})\nend)\n`;
      const readme = `# ${zoneName}\n\nZone ox_target generee par FiveM DevManager.\n\n## Installation\n\n- Ajoutez la ressource dans votre serveur.\n- Verifiez que ox_lib et ox_target sont demarres avant elle.\n- Adaptez l'evenement serveur et la permission ACE.\n\n## Securite\n\n- L'evenement serveur verifie la permission ACE.\n- Le serveur verifie la distance entre le joueur et la zone.\n- Ne remplacez pas cette verification par une simple condition cote client.\n- La permission par defaut doit etre attribuee avec une commande ACE.\n`;

      return result(`Zone ox_target ${zoneName} generee.`, [
        file("fxmanifest.lua", manifest, "lua"),
        file("shared/config.lua", config, "lua"),
        file("client/target.lua", client, "lua"),
        file("server/target.lua", server, "lua"),
        file("README.md", readme, "markdown"),
      ], {
        stats: [
          stat("Zone", zoneName),
          stat("Permission", permission),
          stat("Rayon serveur", `${radius.toFixed(1)} m`),
        ],
        notes: ["La zone est creee avec ox_target.addBoxZone et expose une option de ciblage."],
        warnings: ["Ne faites pas confiance a l'evenement client : gardez la verification ACE et la distance cote serveur."],
      });
    },
  },
  {
    slug: "command-generator",
    name: "Generateur de commande",
    category: "dev",
    description: "Genere RegisterCommand avec suggestions, permission ACE et cooldown.",
    icon: "Terminal",
    tags: ["commande", "lua", "permissions"],
    fields: [
      { name: "command", label: "Commande", type: "text", default: "monoutil", required: true },
      { name: "description", label: "Description", type: "text", default: "Commande de developpement" },
      { name: "paramsCsv", label: "Parametres", type: "text", default: "action, target" },
      { name: "permission", label: "Permission ACE", type: "text", default: "fdm.command" },
      { name: "cooldown", label: "Cooldown (secondes)", type: "number", default: 3, min: 0 },
      { name: "adminOnly", label: "Reserve aux admins", type: "switch", default: true },
    ],
    run: (input) => {
      const command = safeSlug(str(input, "command", "monoutil"), "monoutil").replace(/_/g, "");
      const params = splitList(str(input, "paramsCsv", ""));
      const permission = str(input, "permission", "fdm.command");
      const cooldown = Math.max(0, num(input, "cooldown", 3));
      const lua = `local cooldowns = {}\n\nRegisterCommand(${luaString(command)}, function(source, args)\n  local src = source\n  if ${str(input, "adminOnly", "true") === "true" ? "src == 0 or not IsPlayerAceAllowed(src, " + luaString(permission) + ")" : "false"} then\n    return\n  end\n  local now = os.time()\n  if cooldowns[src] and now - cooldowns[src] < ${cooldown} then return end\n  cooldowns[src] = now\n  local action, target = args[1], args[2]\n  print(('[${command}] %s -> action=%s target=%s'):format(GetPlayerName(src), tostring(action), tostring(target)))\nend, false)\n\nTriggerEvent('chat:addSuggestion', ${luaString("/" + command)}, ${luaString(str(input, "description", "Commande"))}, {\n${params.map((param) => `  { name = ${luaString(param)}, help = ${luaString("Parametre " + param)} },`).join("\n")}\n})\n`;
      return result(`Commande /${command} generee.`, [file("command.lua", lua, "lua")], {
        stats: [stat("Cooldown", `${cooldown}s`), stat("Params", String(params.length))],
      });
    },
  },
  {
    slug: "locale-generator",
    name: "Generateur de locales",
    category: "dev",
    description: "Convertit des entrees CSV en fichiers de traduction Lua et un chargeur.",
    icon: "Languages",
    tags: ["locales", "traduction", "lua"],
    fields: [
      { name: "locale", label: "Langue", type: "select", options: [{ value: "fr", label: "Francais" }, { value: "en", label: "Anglais" }, { value: "es", label: "Espagnol" }], default: "fr" },
      { name: "entriesCsv", label: "Entrees (cle,valeur)", type: "textarea", rows: 7, default: "welcome,Bienvenue\nno_permission,Acces refuse\nsuccess,Operation reussie" },
    ],
    run: (input) => {
      const locale = str(input, "locale", "fr");
      const entries = parseTable(str(input, "entriesCsv", ""), ["key", "value"]);
      const lines = entries.map((entry) => `  ${safeSlug(entry.key, "key")} = ${luaString(entry.value)},`);
      return result(`Locale ${locale} generee avec ${entries.length} entree(s).`, [
        file(`locales/${locale}.lua`, `Locales = Locales or {}\nLocales.${locale} = {\n${lines.join("\n")}\n}\n`, "lua"),
        file("locales/loader.lua", `Locales = Locales or {}\n\nfunction L(key)\n  local locale = Config and Config.Locale or 'fr'\n  return (Locales[locale] and Locales[locale][key]) or key\nend\n`, "lua"),
      ], { stats: [stat("Entrees", String(entries.length)), stat("Langue", locale)] });
    },
  },
  {
    slug: "version-checker",
    name: "Verificateur de version",
    category: "dev",
    description: "Ajoute une verification de version via une URL JSON et une notification console.",
    icon: "GitCompare",
    tags: ["version", "update", "github"],
    fields: [
      { name: "resourceName", label: "Ressource", type: "text", default: "mon_resource" },
      { name: "currentVersion", label: "Version actuelle", type: "text", default: "1.0.0" },
      { name: "versionUrl", label: "URL JSON", type: "text", default: "https://raw.githubusercontent.com/owner/repo/main/version.json" },
      { name: "checkInterval", label: "Intervalle (minutes)", type: "number", default: 60, min: 1 },
    ],
    run: (input) => {
      const resource = safeSlug(str(input, "resourceName", "mon_resource"), "mon_resource");
      const current = str(input, "currentVersion", "1.0.0");
      const url = str(input, "versionUrl", "https://raw.githubusercontent.com/owner/repo/main/version.json");
      const minutes = Math.max(1, num(input, "checkInterval", 60));
      const lua = `local resourceName = ${luaString(resource)}\nlocal currentVersion = ${luaString(current)}\nlocal versionUrl = ${luaString(url)}\n\nCreateThread(function()\n  while true do\n    Wait(${minutes} * 60 * 1000)\n    PerformHttpRequest(versionUrl, function(status, body)\n      if status ~= 200 or not body then return end\n      local ok, payload = pcall(json.decode, body)\n      if not ok or type(payload) ~= 'table' or not payload.version then return end\n      if payload.version ~= currentVersion then\n        print(('[%s] mise a jour disponible : %s -> %s'):format(resourceName, currentVersion, payload.version))\n      end\n    end, 'GET', '', { ['Accept'] = 'application/json' })\n  end\nend)\n`;
      return result("Verificateur de version genere.", [
        file("version-check.lua", lua, "lua"),
        file("version.json", JSON.stringify({ version: current, resource }, null, 2), "json"),
      ], {
        notes: ["Hebergez version.json a l'URL indiquee et mettez-la a jour a chaque release."],
        warnings: ["Une verification de version ne doit jamais bloquer le demarrage de la ressource."],
      });
    },
  },
];
