export type DocsFrameworkId = "esx" | "qbcore" | "ox" | "core" | "systems";

export type DocsBadge = "primary" | "success" | "warning" | "danger" | "info" | "neutral";

export interface DocsFramework {
  id: DocsFrameworkId;
  label: string;
  description: string;
  accent: DocsBadge;
}

export interface DocsCodeBlock {
  title: string;
  language: string;
  code: string;
}

export interface DocsSection {
  title: string;
  text?: string;
  bullets?: string[];
  code?: DocsCodeBlock;
}

export interface DocsArticle {
  id: string;
  framework: DocsFrameworkId;
  category: string;
  title: string;
  summary: string;
  level: "Base" | "Intermédiaire" | "Avancé";
  tags: string[];
  sections: DocsSection[];
  tools?: Array<{ slug: string; label: string }>;
  links?: Array<{ label: string; href: string }>;
}

export const DOCS_FRAMEWORKS: DocsFramework[] = [
  {
    id: "esx",
    label: "ESX",
    description: "ESX Legacy, joueurs, argent, inventaire et callbacks.",
    accent: "primary",
  },
  {
    id: "qbcore",
    label: "QBCore",
    description: "QBCore, Player.Functions, callbacks et événements.",
    accent: "success",
  },
  {
    id: "ox",
    label: "ox",
    description: "ox_lib, ox_inventory, ox_target et oxmysql.",
    accent: "info",
  },
  {
    id: "core",
    label: "Client / Serveur",
    description: "Fondamentaux FiveM, événements, NUI et sécurité.",
    accent: "neutral",
  },
  {
    id: "systems",
    label: "Systèmes",
    description: "Métiers, véhicules, téléphone et logements.",
    accent: "warning",
  },
];

export const FIVEM_DOCS: DocsArticle[] = [
  {
    id: "esx-server",
    framework: "esx",
    category: "Serveur",
    title: "ESX Legacy côté serveur",
    summary:
      "Récupérer un joueur, protéger un achat et manipuler argent et inventaire depuis le serveur avec ESX Legacy.",
    level: "Intermédiaire",
    tags: ["ESX", "serveur", "callback", "argent", "inventaire"],
    sections: [
      {
        title: "Charger le noyau",
        text: "Le noyau ESX doit être récupéré côté serveur via l'export de la ressource es_extended. Ne créez jamais un joueur à partir d'un identifiant fourni par le client.",
        code: {
          title: "server/main.lua",
          language: "lua",
          code: `local ESX = exports["es_extended"]:getSharedObject()

local CATALOG = {
  bread = 12,
  water = 8,
}

ESX.RegisterServerCallback("shop:buy", function(source, cb, item)
  local xPlayer = ESX.GetPlayerFromId(source)
  local price = CATALOG[item]

  if not xPlayer or not price then
    return cb(false, "Article inconnu")
  end

  if xPlayer.getMoney() < price then
    return cb(false, "Fonds insuffisants")
  end

  if not xPlayer.canCarryItem(item, 1) then
    return cb(false, "Inventaire plein")
  end

  xPlayer.removeMoney(price)
  xPlayer.addInventoryItem(item, 1)
  cb(true)
end)`,
        },
      },
      {
        title: "Lire le joueur et son métier",
        text: "Les méthodes ESX renvoient les données du joueur connecté. Vérifiez toujours que le joueur existe encore au moment du callback.",
        code: {
          title: "server/main.lua",
          language: "lua",
          code: `local xPlayer = ESX.GetPlayerFromId(source)
if not xPlayer then return end

print(xPlayer.getIdentifier())
print(xPlayer.getJob().name, xPlayer.getJob().grade)
print(xPlayer.getAccount("bank").money)`,
        },
      },
      {
        title: "À vérifier",
        bullets: [
          "Le prix et l'article doivent venir d'une table serveur, jamais du client.",
          "Utilisez xPlayer.getMoney() pour l'argent liquide et getAccount('bank') pour le compte bancaire.",
          "Les callbacks ESX sont asynchrones : répondez toujours avec cb(...), même en cas d'erreur.",
          "Pour une action sensible, ajoutez une permission ACE en plus du callback.",
        ],
      },
    ],
    tools: [
      { slug: "resource-boilerplate", label: "Boilerplate ESX" },
      { slug: "oxmysql-query", label: "Requête oxmysql" },
      { slug: "ace-permissions", label: "Permissions ACE" },
    ],
    links: [{ label: "Documentation ESX", href: "https://documentation.esx-framework.org/" }],
  },
  {
    id: "esx-client",
    framework: "esx",
    category: "Client",
    title: "ESX côté client",
    summary:
      "Appeler un callback serveur, afficher une notification et écouter les événements ESX sans exposer de logique sensible côté client.",
    level: "Base",
    tags: ["ESX", "client", "callback", "notification"],
    sections: [
      {
        title: "Callback client vers serveur",
        text: "Le client déclenche le callback et reçoit le résultat. Il ne doit jamais décider seul qu'un achat est valide.",
        code: {
          title: "client/main.lua",
          language: "lua",
          code: `local ESX = exports["es_extended"]:getSharedObject()

RegisterCommand("acheterpain", function()
  ESX.TriggerServerCallback("shop:buy", function(ok, reason)
    if not ok then
      ESX.ShowNotification(reason or "Achat refuse")
      return
    end

    ESX.ShowNotification("Achat effectue")
  end, "bread")
end, false)`,
        },
      },
      {
        title: "Écouter un événement serveur",
        text: "Un événement serveur peut envoyer une mise à jour d'interface au client. Vérifiez la forme du payload avant de l'utiliser.",
        code: {
          title: "client/main.lua",
          language: "lua",
          code: `RegisterNetEvent("shop:client:update", function(payload)
  if type(payload) ~= "table" then return end
  if type(payload.message) ~= "string" then return end

  ESX.ShowNotification(payload.message)
end)`,
        },
      },
    ],
    tools: [
      { slug: "event-bridge", label: "Pont événements" },
      { slug: "nui-bridge", label: "Pont NUI" },
    ],
    links: [{ label: "Documentation ESX", href: "https://documentation.esx-framework.org/" }],
  },
  {
    id: "qbcore-server",
    framework: "qbcore",
    category: "Serveur",
    title: "QBCore côté serveur",
    summary:
      "Utiliser QBCore.Functions, Player.Functions et CreateCallback pour une action serveur autoritaire.",
    level: "Intermédiaire",
    tags: ["QBCore", "serveur", "callback", "argent", "inventaire"],
    sections: [
      {
        title: "Callback sécurisé",
        text: "QBCore expose un Player typé par QBCore.Functions.GetPlayer. Vérifiez l'argent et l'inventaire avant de modifier l'état.",
        code: {
          title: "server/main.lua",
          language: "lua",
          code: `local QBCore = exports["qb-core"]:GetCoreObject()

local CATALOG = {
  bread = 12,
  water = 8,
}

QBCore.Functions.CreateCallback("shop:buy", function(source, cb, item)
  local Player = QBCore.Functions.GetPlayer(source)
  local price = CATALOG[item]

  if not Player or not price then
    return cb(false, "Article inconnu")
  end

  if Player.PlayerData.money.cash < price then
    return cb(false, "Fonds insuffisants")
  end

  Player.Functions.RemoveMoney("cash", price, "shop")
  Player.Functions.AddItem(item, 1)
  cb(true)
end)`,
        },
      },
      {
        title: "Accéder aux données joueur",
        text: "Les données QBCore sont regroupées dans PlayerData. Les mutations passent par les fonctions du joueur pour conserver les hooks du framework.",
        code: {
          title: "server/main.lua",
          language: "lua",
          code: `local Player = QBCore.Functions.GetPlayer(source)
if not Player then return end

print(Player.PlayerData.citizenid)
print(Player.PlayerData.job.name)
print(Player.PlayerData.money.bank)

Player.Functions.SetJob("police", 2)
Player.Functions.AddMoney("bank", 250, "mission")`,
        },
      },
      {
        title: "À vérifier",
        bullets: [
          "Ne faites pas confiance au prix, au montant ou au nom d'objet envoyé par le client.",
          "Les callbacks QBCore reçoivent la source serveur en premier argument.",
          "Préférez Player.Functions.RemoveMoney et AddMoney pour déclencher les hooks.",
          "Pour les objets, validez le nom et la quantité avant AddItem.",
        ],
      },
    ],
    tools: [
      { slug: "resource-boilerplate", label: "Boilerplate QBCore" },
      { slug: "oxmysql-query", label: "Requête oxmysql" },
      { slug: "event-bridge", label: "Pont événements" },
    ],
    links: [{ label: "Documentation QBCore", href: "https://docs.qbcore.org/" }],
  },
  {
    id: "qbcore-client",
    framework: "qbcore",
    category: "Client",
    title: "QBCore côté client",
    summary:
      "Récupérer PlayerData, appeler un callback et afficher une notification avec les fonctions QBCore.",
    level: "Base",
    tags: ["QBCore", "client", "callback", "notification"],
    sections: [
      {
        title: "Callback et notification",
        text: "Le client peut lire PlayerData pour l'affichage, mais les décisions d'argent et d'inventaire restent côté serveur.",
        code: {
          title: "client/main.lua",
          language: "lua",
          code: `local QBCore = exports["qb-core"]:GetCoreObject()

local function buy(item)
  QBCore.Functions.TriggerCallback("shop:buy", function(ok, reason)
    if not ok then
      QBCore.Functions.Notify(reason or "Achat refuse", "error")
      return
    end

    QBCore.Functions.Notify("Achat effectue", "success")
  end, item)
end

RegisterCommand("acheterpain", function()
  buy("bread")
end, false)`,
        },
      },
      {
        title: "Lire les données locales",
        text: "GetPlayerData renvoie les données synchronisées du joueur. Elles peuvent être légèrement décalées après une mutation serveur : écoutez les événements de mise à jour.",
        code: {
          title: "client/main.lua",
          language: "lua",
          code: `local PlayerData = QBCore.Functions.GetPlayerData()

print(PlayerData.citizenid)
print(PlayerData.job.name)
print(PlayerData.money.cash)`,
        },
      },
    ],
    tools: [
      { slug: "nui-bridge", label: "Pont NUI" },
      { slug: "phone-app", label: "Application téléphone" },
    ],
    links: [{ label: "Documentation QBCore", href: "https://docs.qbcore.org/" }],
  },
  {
    id: "ox-lib",
    framework: "ox",
    category: "Framework",
    title: "ox_lib : callbacks, commandes et notifications",
    summary:
      "Utiliser les callbacks, commandes, notifications, context menus et zones d'ox_lib côté client et serveur.",
    level: "Intermédiaire",
    tags: ["ox_lib", "callback", "commande", "notification", "contexte"],
    sections: [
      {
        title: "Callback serveur",
        text: "ox_lib permet un callback court et lisible. La source est fournie côté serveur ; validez toujours les arguments et les permissions.",
        code: {
          title: "server/main.lua",
          language: "lua",
          code: `lib.callback.register("shop:buy", function(source, item)
  local price = ({ bread = 12, water = 8 })[item]
  if not price then return false, "Article inconnu" end

  local xPlayer = exports["es_extended"]:getSharedObject().GetPlayerFromId(source)
  if not xPlayer or xPlayer.getMoney() < price then
    return false, "Fonds insuffisants"
  end

  xPlayer.removeMoney(price)
  xPlayer.addInventoryItem(item, 1)
  return true
end)`,
        },
      },
      {
        title: "Callback client et notification",
        text: "Le callback await bloque le thread courant : utilisez-le dans une fonction dédiée plutôt que dans une boucle permanente.",
        code: {
          title: "client/main.lua",
          language: "lua",
          code: `local function buy(item)
  local ok, reason = lib.callback.await("shop:buy", false, item)
  if not ok then
    lib.notify({ title = "Boutique", description = reason, type = "error" })
    return
  end

  lib.notify({ title = "Boutique", description = "Achat effectue", type = "success" })
end

RegisterCommand("acheterpain", function()
  buy("bread")
end, false)`,
        },
      },
      {
        title: "Commande et menu contextuel",
        text: "ox_lib fournit aussi les commandes avec aide intégrée et les menus contextuels.",
        code: {
          title: "client/main.lua",
          language: "lua",
          code: `lib.addCommand("boutique", {
  help = "Ouvrir la boutique",
  restricted = false,
}, function()
  lib.registerContext({
    id = "shop_menu",
    title = "Boutique",
    options = {
      {
        title = "Pain",
        description = "12 $",
        onSelect = function() buy("bread") end,
      },
    },
  })
  lib.showContext("shop_menu")
end)`,
        },
      },
    ],
    tools: [
      { slug: "event-bridge", label: "Pont événements" },
      { slug: "command-generator", label: "Générateur de commande" },
      { slug: "oxmysql-query", label: "Requête oxmysql" },
    ],
    links: [{ label: "Documentation ox_lib", href: "https://overextended.dev/ox_lib" }],
  },
  {
    id: "ox-inventory",
    framework: "ox",
    category: "Données",
    title: "ox_inventory : objets et inventaires",
    summary:
      "Ajouter, retirer et compter des objets avec les exports ox_inventory, sans oublier les métadonnées et les hooks.",
    level: "Intermédiaire",
    tags: ["ox_inventory", "inventaire", "objet", "metadata", "serveur"],
    sections: [
      {
        title: "Manipuler un objet côté serveur",
        text: "Les exports ox_inventory sont serveur pour les mutations. Vérifiez le résultat avant d'accorder une récompense ou de valider un paiement.",
        code: {
          title: "server/main.lua",
          language: "lua",
          code: `local count = exports.ox_inventory:GetItemCount(source, "bread")
if count >= 10 then return false, "Limite atteinte" end

local added = exports.ox_inventory:AddItem(source, "bread", 1)
if not added then return false, "Inventaire plein" end

exports.ox_inventory:RemoveItem(source, "bread", 1)`,
        },
      },
      {
        title: "Métadonnées et objets uniques",
        text: "Les métadonnées permettent de conserver un propriétaire, une durabilité ou un identifiant unique. Ne les construisez pas à partir de données client non validées.",
        code: {
          title: "server/main.lua",
          language: "lua",
          code: `exports.ox_inventory:AddItem(source, "phone", 1, {
  owner = "citizen-id",
  number = "555-0102",
})

local item = exports.ox_inventory:GetItem(source, "phone")
print(item and item.metadata.number)`,
        },
      },
      {
        title: "À vérifier",
        bullets: [
          "Un item ajouté côté client ne doit jamais déclencher seul une récompense serveur.",
          "Utilisez des noms d'objets whitelistés dans une table serveur.",
          "Les exports ox_inventory ne remplacent pas la validation d'identité du joueur.",
          "Pour un stash ou une boutique, vérifiez les permissions avant d'ouvrir l'inventaire.",
        ],
      },
    ],
    tools: [
      { slug: "shop-generator", label: "Générateur de boutique" },
      { slug: "loot-table", label: "Table de loot" },
      { slug: "resource-boilerplate", label: "Boilerplate ox" },
    ],
    links: [{ label: "Documentation ox_inventory", href: "https://overextended.dev/ox_inventory" }],
  },
  {
    id: "ox-target",
    framework: "ox",
    category: "Systèmes",
    title: "ox_target : interactions et zones",
    summary:
      "Créer des options de ciblage sur une zone, un modèle ou une entité, avec des actions serveur autoritaires.",
    level: "Base",
    tags: ["ox_target", "zone", "entité", "interaction", "client"],
    sections: [
      {
        title: "Ajouter une zone",
        text: "Les options ox_target sont déclarées côté client. L'action doit envoyer un événement au serveur, qui vérifie la distance, l'identité et la permission.",
        code: {
          title: "client/main.lua",
          language: "lua",
          code: `exports.ox_target:addBoxZone({
  coords = vec3(25.7, -1347.6, 29.5),
  size = vec3(1.5, 1.5, 2.0),
  rotation = 0,
  debug = false,
  options = {
    {
      name = "shop_open",
      icon = "fa-solid fa-store",
      label = "Ouvrir la boutique",
      onSelect = function()
        TriggerServerEvent("shop:server:open")
      end,
    },
  },
})`,
        },
      },
      {
        title: "Cibler un modèle ou une entité",
        text: "Pour les véhicules et objets dynamiques, ajoutez l'option sur l'entité et nettoyez-la lorsque l'entité est supprimée.",
        code: {
          title: "client/main.lua",
          language: "lua",
          code: `local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
local option = exports.ox_target:addEntity(vehicle, {
  {
    name = "vehicle_lock",
    icon = "fa-solid fa-lock",
    label = "Verrouiller",
    onSelect = function()
      TriggerServerEvent("garage:server:toggleLock", VehToNet(vehicle))
    end,
  },
})`,
        },
      },
    ],
    tools: [
      { slug: "ox-target-zone", label: "Générateur de zone" },
      { slug: "garage-config", label: "Configuration garage" },
      { slug: "event-bridge", label: "Pont événements" },
    ],
    links: [{ label: "Documentation ox_target", href: "https://overextended.dev/ox_target" }],
  },
  {
    id: "oxmysql",
    framework: "ox",
    category: "Données",
    title: "oxmysql : requêtes paramétrées",
    summary:
      "Écrire des requêtes SQL sûres avec les helpers await d'oxmysql et garder les accès base uniquement côté serveur.",
    level: "Intermédiaire",
    tags: ["oxmysql", "SQL", "base de données", "serveur", "sécurité"],
    sections: [
      {
        title: "Lire une ligne",
        text: "Utilisez toujours des paramètres ? et un tableau de valeurs. Ne concaténez jamais une entrée client dans la requête.",
        code: {
          title: "server/database.lua",
          language: "lua",
          code: `local identifier = "license:xxxx"

local row = MySQL.single.await(
  "SELECT identifier, name, money FROM players WHERE identifier = ?",
  { identifier }
)

if row then
  print(row.name, row.money)
end`,
        },
      },
      {
        title: "Écrire et mettre à jour",
        text: "Les helpers insert, update et prepare renvoient le résultat de l'opération. Gérez les erreurs pour ne pas laisser un état incohérent.",
        code: {
          title: "server/database.lua",
          language: "lua",
          code: `local id = MySQL.insert.await(
  "INSERT INTO player_notes (identifier, note) VALUES (?, ?)",
  { identifier, "Note interne" }
)

local updated = MySQL.update.await(
  "UPDATE players SET money = money + ? WHERE identifier = ?",
  { 250, identifier }
)

print(id, updated)`,
        },
      },
      {
        title: "Règles",
        bullets: [
          "La base ne doit être accessible que depuis le serveur.",
          "Une requête lente ne doit pas bloquer une boucle de jeu : utilisez les helpers await dans un thread dédié.",
          "Indexez les colonnes utilisées dans les WHERE et les jointures.",
          "Les secrets de connexion restent dans les variables d'environnement, jamais dans un fichier public.",
        ],
      },
    ],
    tools: [
      { slug: "oxmysql-query", label: "Générateur oxmysql" },
      { slug: "resource-audit", label: "Audit de ressource" },
    ],
    links: [{ label: "Documentation oxmysql", href: "https://overextended.dev/oxmysql" }],
  },
  {
    id: "core-events",
    framework: "core",
    category: "Fondamentaux",
    title: "Événements et fonctions client / serveur",
    summary:
      "Comprendre source, TriggerClientEvent, RegisterNetEvent, threads et natives essentielles pour structurer une ressource.",
    level: "Base",
    tags: ["événement", "source", "natives", "client", "serveur", "thread"],
    sections: [
      {
        title: "Un événement serveur fiable",
        text: "Un événement réseau est une entrée non fiable. Vérifiez le type, les champs et les permissions avant de modifier l'état du serveur.",
        code: {
          title: "server/main.lua",
          language: "lua",
          code: `RegisterNetEvent("resource:server:reward", function(payload)
  local src = source

  if type(payload) ~= "table" then return end
  if type(payload.taskId) ~= "string" then return end
  if not IsPlayerAceAllowed(src, "resource.reward") then return end

  TriggerClientEvent("resource:client:rewarded", src, {
    taskId = payload.taskId,
    message = "Recompense accordee",
  })
end)`,
        },
      },
      {
        title: "Threads client",
        text: "Wait suspend le thread courant. Évitez les boucles à 0 ms et préférez un événement quand c'est possible.",
        code: {
          title: "client/main.lua",
          language: "lua",
          code: `CreateThread(function()
  while true do
    Wait(1000)
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    -- utiliser coords sans bloquer la boucle chaque frame
  end
end)

RegisterNetEvent("resource:client:rewarded", function(data)
  if type(data) ~= "table" then return end
  BeginTextCommandThefeedPost("STRING")
  AddTextComponentSubstringPlayerName(data.message or "Recompense")
  EndTextCommandThefeedPostTicker(false, true)
end)`,
        },
      },
      {
        title: "Natives à connaître",
        bullets: [
          "Client : PlayerPedId, GetEntityCoords, GetVehiclePedIsIn, CreateThread, Wait, SetNuiFocus.",
          "Serveur : GetPlayers, GetPlayerName, DropPlayer, IsPlayerAceAllowed, GetPlayerPed.",
          "Réseau : TriggerClientEvent, TriggerServerEvent, RegisterNetEvent, source.",
          "État partagé : les state bags doivent rester petits et ne pas contenir de secrets.",
        ],
      },
    ],
    tools: [
      { slug: "event-bridge", label: "Pont événements" },
      { slug: "ace-permissions", label: "Permissions ACE" },
      { slug: "command-generator", label: "Générateur de commande" },
    ],
    links: [{ label: "Référence des natives FiveM", href: "https://docs.fivem.net/natives/" }],
  },
  {
    id: "core-nui",
    framework: "core",
    category: "NUI",
    title: "NUI : interface et callbacks",
    summary:
      "Ouvrir une interface, envoyer des données au navigateur et recevoir des callbacks NUI sans exposer d'actions sensibles.",
    level: "Intermédiaire",
    tags: ["NUI", "interface", "callback", "fetch", "client"],
    sections: [
      {
        title: "Ouvrir et fermer l'interface",
        text: "SetNuiFocus contrôle le focus clavier/souris. Les callbacks NUI sont côté client et doivent être validés avant de déclencher une action serveur.",
        code: {
          title: "client/main.lua",
          language: "lua",
          code: `local isOpen = false

RegisterCommand("ouvririnterface", function()
  isOpen = true
  SetNuiFocus(true, true)
  SendNUIMessage({ action = "open", data = { title = "Mon interface" } })
end, false)

RegisterNUICallback("close", function(_, cb)
  isOpen = false
  SetNuiFocus(false, false)
  cb({ ok = true })
end)`,
        },
      },
      {
        title: "Appeler le client depuis le navigateur",
        text: "Le navigateur NUI appelle des callbacks avec fetch. Utilisez GetParentResourceName pour construire l'URL et ne faites jamais confiance à la valeur reçue.",
        code: {
          title: "ui/script.js",
          language: "javascript",
          code: `const resource = typeof GetParentResourceName === "function"
  ? GetParentResourceName()
  : "mon_resource";

async function close() {
  await fetch("https://" + resource + "/close", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

window.addEventListener("message", (event) => {
  if (event.data.action === "open") {
    console.log(event.data.data);
  }
});`,
        },
      },
      {
        title: "Sécurité NUI",
        bullets: [
          "Un callback NUI ne prouve pas que l'action est autorisée côté serveur.",
          "Validez la source, les permissions et les distances avant toute mutation.",
          "N'envoyez jamais de clé API, de token ou de secret dans SendNUIMessage.",
          "Fermez le focus NUI dès que l'interface est masquée.",
        ],
      },
    ],
    tools: [
      { slug: "nui-bridge", label: "Pont NUI" },
      { slug: "phone-app", label: "Application téléphone" },
    ],
    links: [{ label: "Guide NUI FiveM", href: "https://docs.fivem.net/docs/scripting-manual/nui-development/" }],
  },
  {
    id: "core-security",
    framework: "core",
    category: "Sécurité",
    title: "Sécuriser les événements et les actions sensibles",
    summary:
      "Appliquer la validation serveur, les permissions ACE, les limites de débit et la journalisation sur les actions critiques.",
    level: "Avancé",
    tags: ["sécurité", "événement", "ACE", "rate limit", "serveur"],
    sections: [
      {
        title: "Un événement ne fait jamais confiance au client",
        text: "La source est fournie par le serveur, mais le payload vient du client. Validez chaque champ et limitez la fréquence des appels.",
        code: {
          title: "server/main.lua",
          language: "lua",
          code: `local lastCall = {}

RegisterNetEvent("shop:server:buy", function(item)
  local src = source
  local now = GetGameTimer()

  if lastCall[src] and now - lastCall[src] < 500 then return end
  lastCall[src] = now

  if type(item) ~= "string" or #item > 40 then return end

  local player = exports["es_extended"]:getSharedObject().GetPlayerFromId(src)
  if not player then return end

  -- verifier le catalogue, le prix et l'inventaire cote serveur
end)`,
        },
      },
      {
        title: "Permissions ACE",
        text: "Pour les commandes et actions administratives, vérifiez ACE côté serveur. Le client peut cacher un bouton, mais ce n'est pas une sécurité.",
        code: {
          title: "server/main.lua",
          language: "lua",
          code: `if src == 0 or not IsPlayerAceAllowed(src, "fdm.admin") then
  return
end

-- cote server.cfg
-- add_ace group.admin fdm.admin allow`,
        },
      },
      {
        title: "Checklist",
        bullets: [
          "Les montants, objets et identifiants sont validés côté serveur.",
          "Les secrets restent dans les variables d'environnement ou un coffre-fort.",
          "Les actions sensibles sont journalisées avec source, cible et résultat.",
          "Les callbacks NUI et les événements réseau ont une limite de débit.",
        ],
      },
    ],
    tools: [
      { slug: "ace-permissions", label: "Permissions ACE" },
      { slug: "event-bridge", label: "Pont événements" },
      { slug: "resource-audit", label: "Audit de ressource" },
    ],
    links: [{ label: "Guide de sécurité FiveM", href: "https://docs.fivem.net/docs/scripting-manual/introduction/" }],
  },
  {
    id: "systems-jobs",
    framework: "systems",
    category: "Systèmes",
    title: "Systèmes de métiers et d'économie",
    summary:
      "Structurer les métiers, grades, salaires et transactions avec une autorité serveur et un adaptateur framework.",
    level: "Avancé",
    tags: ["métier", "économie", "salaire", "grade", "framework"],
    sections: [
      {
        title: "Séparer les règles des frameworks",
        text: "Un adaptateur Bridge permet de garder les règles métier indépendantes d'ESX ou QBCore. La ressource serveur reste la seule à décider du paiement.",
        code: {
          title: "server/jobs.lua",
          language: "lua",
          code: `local function paySalary(source, amount)
  amount = math.floor(tonumber(amount) or 0)
  if amount < 1 or amount > 5000 then return false end

  local ok = Bridge.AddMoney(source, amount, "bank", "salaire")
  if not ok then return false end

  TriggerClientEvent("jobs:client:paid", source, amount)
  return true
end`,
        },
      },
      {
        title: "Modèle de données",
        bullets: [
          "jobs : nom, label, grades, salaire de base, permissions.",
          "player_jobs : identifiant joueur, job, grade, dernier paiement.",
          "transactions : source, montant, type, référence, date, statut.",
          "Un paiement doit être idempotent pour éviter le double crédit après un retry.",
        ],
      },
      {
        title: "Points d'attention",
        bullets: [
          "Le client ne choisit jamais son salaire ni son grade.",
          "Les grades sont vérifiés côté serveur à chaque action.",
          "Les paiements automatiques utilisent un timestamp serveur, pas l'heure du client.",
          "Journalisez les transactions et surveillez les écarts anormaux.",
        ],
      },
    ],
    tools: [
      { slug: "job-generator", label: "Générateur de métier" },
      { slug: "shop-generator", label: "Générateur de boutique" },
      { slug: "xp-curve", label: "Courbe XP" },
      { slug: "framework-bridge", label: "Pont framework" },
    ],
  },
  {
    id: "systems-vehicles",
    framework: "systems",
    category: "Systèmes",
    title: "Garages, clés et propriété des véhicules",
    summary:
      "Relier un véhicule à son propriétaire, contrôler le stockage et éviter les duplications de plaque ou de clés.",
    level: "Intermédiaire",
    tags: ["véhicule", "garage", "clé", "propriété", "plaque"],
    sections: [
      {
        title: "Enregistrer un véhicule",
        text: "La plaque est une donnée d'identification, pas une preuve de propriété. Le serveur doit associer le véhicule à un identifiant joueur en base.",
        code: {
          title: "server/garage.lua",
          language: "lua",
          code: `local plate = string.upper(GetVehicleNumberPlateText(vehicle))
local owner = Bridge.GetPlayer(source)
if not owner or #plate < 2 then return end

MySQL.insert.await(
  "INSERT INTO vehicle_ownership (plate, owner, stored) VALUES (?, ?, 1)",
  { plate, owner.identifier }
)`,
        },
      },
      {
        title: "Sortir et ranger un véhicule",
        text: "Vérifiez la propriété, l'état du garage et la position avant de créer l'entité. Supprimez l'entité côté serveur lors du stockage.",
        code: {
          title: "server/garage.lua",
          language: "lua",
          code: `RegisterNetEvent("garage:server:take", function(plate)
  local src = source
  if type(plate) ~= "string" then return end

  local row = MySQL.single.await(
    "SELECT * FROM vehicle_ownership WHERE plate = ? AND stored = 1",
    { string.upper(plate) }
  )
  if not row or row.owner ~= Bridge.GetPlayer(src).identifier then return end

  MySQL.update.await("UPDATE vehicle_ownership SET stored = 0 WHERE plate = ?", { plate })
  TriggerClientEvent("garage:client:spawn", src, plate)
end)`,
        },
      },
      {
        title: "À vérifier",
        bullets: [
          "Les clés doivent être stockées côté serveur et révoquées à la vente.",
          "Une plaque peut être changée : utilisez aussi un identifiant de véhicule si votre système le permet.",
          "Ne faites pas confiance au modèle ou à la position envoyés par le client pour un remboursement.",
          "Nettoyez les entités et les clés lors d'un changement de propriétaire.",
        ],
      },
    ],
    tools: [
      { slug: "vehicle-keys", label: "Système de clés" },
      { slug: "garage-config", label: "Configuration garage" },
      { slug: "vehicle-spawn", label: "Spawn véhicule" },
      { slug: "vehicle-plate", label: "Générateur de plaque" },
      { slug: "vehicle-shop", label: "Concession" },
    ],
  },
  {
    id: "systems-phone",
    framework: "systems",
    category: "Systèmes",
    title: "Téléphone, apps et dispatch",
    summary:
      "Construire des apps téléphone et un dispatch avec des événements validés, des permissions et des limites de débit.",
    level: "Intermédiaire",
    tags: ["téléphone", "NUI", "dispatch", "app", "événement"],
    sections: [
      {
        title: "Un appel téléphonique",
        text: "Le numéro composé est une donnée client. Le serveur vérifie le format, les permissions et l'existence du destinataire avant de router l'appel.",
        code: {
          title: "server/phone.lua",
          language: "lua",
          code: `RegisterNetEvent("phone:server:call", function(number)
  local src = source
  if type(number) ~= "string" or #number > 20 then return end
  if not number:match("^[%d%-%+]+$") then return end

  local target = exports.ox_inventory:GetItem(source, "phone")
  if not target then return end

  TriggerClientEvent("phone:client:incoming", src, number)
end)`,
        },
      },
      {
        title: "Dispatch serveur",
        text: "Le dispatch doit être calculé côté serveur à partir d'une position validée et d'un type d'alerte autorisé.",
        code: {
          title: "server/dispatch.lua",
          language: "lua",
          code: `RegisterNetEvent("dispatch:server:alert", function(kind, coords)
  local src = source
  if kind ~= "police" and kind ~= "ambulance" then return end
  if type(coords) ~= "vector3" and type(coords) ~= "table" then return end

  local x, y, z = table.unpack(coords)
  TriggerClientEvent("dispatch:client:alert", -1, {
    kind = kind,
    source = src,
    coords = { x = x, y = y, z = z },
  })
end)`,
        },
      },
      {
        title: "À vérifier",
        bullets: [
          "Un numéro de téléphone n'est pas une preuve d'identité.",
          "Limitez les appels, SMS et alertes par joueur.",
          "Ne diffusez pas les coordonnées exactes à tous les métiers sans contrôle.",
          "Les données d'appel doivent être persistées avec une politique de conservation claire.",
        ],
      },
    ],
    tools: [
      { slug: "phone-app", label: "Application téléphone" },
      { slug: "dispatch-preset", label: "Preset dispatch" },
      { slug: "nui-bridge", label: "Pont NUI" },
    ],
  },
  {
    id: "systems-housing",
    framework: "systems",
    category: "Systèmes",
    title: "Logements et instances",
    summary:
      "Gérer les propriétés, les buckets de routage et la persistance des objets sans mélanger les joueurs dans une même instance.",
    level: "Avancé",
    tags: ["logement", "routing bucket", "instance", "propriété", "MLO"],
    sections: [
      {
        title: "Entrer dans une instance",
        text: "Le routing bucket isole les joueurs et les entités. Le serveur doit vérifier que le joueur possède bien le logement avant de changer son bucket.",
        code: {
          title: "server/housing.lua",
          language: "lua",
          code: `local BASE_BUCKET = 1000

RegisterNetEvent("housing:server:enter", function(propertyId)
  local src = source
  propertyId = tonumber(propertyId)
  if not propertyId then return end

  local owner = Bridge.GetPlayer(src)
  if not owner then return end

  local property = MySQL.single.await(
    "SELECT id, owner FROM properties WHERE id = ?",
    { propertyId }
  )
  if not property or property.owner ~= owner.identifier then return end

  local bucket = BASE_BUCKET + propertyId
  SetPlayerRoutingBucket(src, bucket)
  SetEntityRoutingBucket(GetPlayerPed(src), bucket)
  TriggerClientEvent("housing:client:enter", src, propertyId)
end)`,
        },
      },
      {
        title: "Sortir proprement",
        text: "Remettez le bucket à zéro et nettoyez les entités du logement. Prévoyez aussi la déconnexion et le redémarrage serveur.",
        code: {
          title: "server/housing.lua",
          language: "lua",
          code: `RegisterNetEvent("housing:server:leave", function()
  local src = source
  SetPlayerRoutingBucket(src, 0)
  SetEntityRoutingBucket(GetPlayerPed(src), 0)
  TriggerClientEvent("housing:client:leave", src)
end)`,
        },
      },
      {
        title: "Checklist propriété",
        bullets: [
          "Le propriétaire et les invités sont vérifiés côté serveur.",
          "Le bucket est libéré à la déconnexion et au redémarrage.",
          "Les objets persistants sont chargés depuis la base, pas depuis le client.",
          "Un shell MLO doit être validé avant d'être déployé en production.",
        ],
      },
    ],
    tools: [
      { slug: "housing-config", label: "Configuration logement" },
      { slug: "mlo-scaffold", label: "Scaffold MLO" },
      { slug: "mapping-manifest", label: "Manifest mapping" },
    ],
  },
  {
    id: "systems-anticheat",
    framework: "systems",
    category: "Systèmes",
    title: "Anticheat serveur et alertes",
    summary:
      "Détecter les comportements anormaux côté serveur, envoyer des preuves au panel et traiter les alertes sans punition automatique.",
    level: "Avancé",
    tags: ["anticheat", "sécurité", "explosion", "entité", "rapport"],
    sections: [
      {
        title: "Principe : serveur autoritaire, mode rapport",
        text: "Un anticheat fiable ne dépend pas d'un client modifiable. L'agent écoute les événements serveur (dégâts, explosions, projectiles, création d'entités, déplacements), horodate les faits et les transmet au panel. Par défaut, il ne punit pas : l'équipe vérifie le contexte et décide.",
        bullets: [
          "Aucune ressource cliente ni injection mémoire : rien à contourner côté joueur.",
          "Les seuils sont configurables et les faux positifs sont attendus (scripts admin, courses, RP).",
          "Chaque alerte conserve les données techniques et l'identifiant du joueur pour l'analyse.",
          "Le token d'ingestion reste dans une convar serveur, jamais dans un fichier client.",
        ],
      },
      {
        title: "Installer l'agent",
        text: "La ressource fdm-anticheat fournie avec le DevManager s'installe comme une ressource serveur classique. Le token doit être identique à ANTICHEAT_INGEST_TOKEN côté panel.",
        code: {
          title: "server.cfg",
          language: "cfg",
          code: `set fdm_anticheat_endpoint "https://votre-panel.example.com/api/anticheat/ingest"
set fdm_anticheat_token "LE_MEME_TOKEN_QUE_LE_PANEL"
set fdm_anticheat_server_id "mon-serveur"

add_ace group.admin fdm.anticheat.admin allow

ensure fdm-anticheat`,
        },
      },
      {
        title: "Panel et serveur sur la même machine",
        text: "Lorsque le panel et le serveur FiveM tournent sur le même hôte, l'agent peut utiliser l'adresse privée et le port alloué au panel au lieu de l'URL publique. Le trafic reste sur la machine, avec moins de latence et sans exposer l'endpoint à Internet.",
        bullets: [
          "Utilisez http://IP_PRIVEE:PORT_DU_PANEL/api/anticheat/ingest, jamais une URL publique si le trafic peut rester interne.",
          "Gardez le token Bearer : l'absence de TLS sur le réseau interne ne dispense pas d'authentification.",
          "Restreignez le port du panel au serveur FiveM via le pare-feu de l'hôte.",
          "L'agent envoie un heartbeat toutes les 60 s : le dashboard indique s'il est en ligne, sa file et sa version.",
        ],
      },
      {
        title: "Événements surveillés",
        bullets: [
          "explosionEvent : rafales et damageScale anormal.",
          "entityCreating : cadence globale, plus un seuil spécifique aux véhicules.",
          "startProjectileEvent : rafales de projectiles.",
          "weaponDamageEvent : dégâts par impact au-delà du maximum attendu.",
          "Mesures périodiques : vitesse et écart de position côté serveur.",
        ],
      },
      {
        title: "Traiter une alerte",
        text: "Dans /anticheat, ouvrez l'alerte pour consulter les données techniques, puis prenez-la en compte. La clôture exige une note : sanction appliquée manuellement, correction de seuil ou faux positif confirmé. Aucune sanction n'est créée automatiquement.",
        bullets: [
          "Vérifiez la ressource et le contexte avant de conclure.",
          "Ajustez les seuils dans config.lua si une ressource légitime déclenche des alertes.",
          "Réservez l'ACE fdm.anticheat.exempt aux comptes de confiance.",
          "Les détections répétées sont agrégées pendant 10 minutes (occurrences) pour éviter de saturer la file.",
          "Ne supprimez pas les alertes : elles constituent l'historique de preuve.",
        ],
      },
    ],
    links: [
      { label: "explosionEvent (FiveM)", href: "https://docs.fivem.net/docs/scripting-reference/events/list/explosionEvent/" },
      { label: "weaponDamageEvent (FiveM)", href: "https://docs.fivem.net/docs/scripting-reference/events/list/weaponDamageEvent/" },
    ],
  },
];
