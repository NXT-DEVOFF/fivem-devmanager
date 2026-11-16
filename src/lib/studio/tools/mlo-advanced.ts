import {
  file,
  num,
  safeSlug,
  sqlIdentifier,
  stat,
  str,
} from "../helpers";
import { coordParts, moduleTool, rows } from "./modules-shared";
import type { StudioDiagnostic, StudioTool } from "../types";

interface CameraEntry {
  name: string;
  label: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  pitch: number;
}

interface RoomEntry {
  name: string;
  label: string;
  model: string;
  coords: { x: number; y: number; z: number };
  heading: number;
  ace: string;
}

interface ParkingSpot {
  name: string;
  x: number;
  y: number;
  z: number;
  heading: number;
}

const DEFAULT_CAMERAS = `entree,Entree principale,10,20,30,180,-8
coffre,Coffre,-10,20,30,0,-5
parking,Parking,25,35,29,270,-12`;

const DEFAULT_ROOMS = `entree,Entree principale,v_ilev_aptdoor01,0,0,0,0,fdm.mlo.entrance
bureau,Bureau securise,v_ilev_aptdoor01,8,0,0,90,fdm.mlo.office`;

const DEFAULT_SPOTS = `A1,0,0,0,0\nA2,2.5,0,0,0\nA3,5,0,0,0\nA4,7.5,0,0,0`;

export const mloAdvancedTools: StudioTool[] = [
  moduleTool({
    slug: "mlo-camera-network",
    name: "Reseau de cameras MLO",
    category: "mlo",
    description:
      "Genere un reseau de cameras de securite avec permission ACE, commande, activation client et sortie securisee.",
    icon: "Siren",
    tags: ["mlo", "camera", "securite", "surveillance"],
    fields: [
      { name: "resourceName", label: "Ressource", type: "text", default: "fdm_mlo_cameras", required: true },
      { name: "networkName", label: "Nom du reseau", type: "text", default: "Reseau securite", required: true },
      { name: "camerasCsv", label: "Cameras (name,label,x,y,z,rotation,pitch)", type: "textarea", rows: 7, default: DEFAULT_CAMERAS, required: true },
      { name: "viewDistance", label: "Distance de vue (m)", type: "number", default: 150, min: 20, max: 1000 },
      { name: "fov", label: "Champ de vision", type: "number", default: 50, min: 15, max: 120 },
      { name: "permission", label: "Permission ACE", type: "text", default: "fdm.mlo.cameras" },
      { name: "command", label: "Commande", type: "text", default: "camera" },
    ],
    build: (input) => {
      const resource = safeSlug(str(input, "resourceName", "fdm_mlo_cameras"), "fdm_mlo_cameras");
      const networkName = str(input, "networkName", "Reseau securite");
      const permission = str(input, "permission", "fdm.mlo.cameras").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80) || "fdm.mlo.cameras";
      const command = safeSlug(str(input, "command", "camera"), "camera").replace(/_/g, "");
      const viewDistance = Math.max(20, Math.min(1000, num(input, "viewDistance", 150)));
      const fov = Math.max(15, Math.min(120, num(input, "fov", 50)));
      const cameras: CameraEntry[] = rows(input, "camerasCsv", ["name", "label", "x", "y", "z", "rotation", "pitch"]).map((row) => ({
        name: safeSlug(row.name, "camera"),
        label: row.label || row.name || "Camera",
        x: Number(row.x) || 0,
        y: Number(row.y) || 0,
        z: Number(row.z) || 0,
        rotation: Number(row.rotation) || 0,
        pitch: Number(row.pitch) || 0,
      }));
      const diagnostics: StudioDiagnostic[] = cameras.length === 0 ? [{ level: "error", message: "Aucune camera definie.", field: "camerasCsv" }] : [];
      const data = { resourceName: resource, networkName, cameras, viewDistance, fov, permission, command };

      const server = `local cameras = Config.MloCameraNetwork.cameras
local permission = Config.MloCameraNetwork.permission
local command = Config.MloCameraNetwork.command
local cooldowns = {}
local byName = {}

for index, camera in ipairs(cameras) do
  byName[camera.name] = camera
  byName[tostring(index)] = camera
end

local function canUse(source)
  return source == 0 or IsPlayerAceAllowed(source, permission)
end

local function notify(source, message)
  TriggerClientEvent('chat:addMessage', source, { args = { 'Cameras', message } })
end

local function openCamera(source, camera)
  if not camera then
    notify(source, 'Camera inconnue.')
    return
  end

  local now = GetGameTimer()
  if cooldowns[source] and now - cooldowns[source] < 750 then
    return
  end
  cooldowns[source] = now
  TriggerClientEvent('mlo_camera:activate', source, camera, Config.MloCameraNetwork.viewDistance, Config.MloCameraNetwork.fov)
end

RegisterCommand(command, function(source, args)
  if not canUse(source) then
    if source ~= 0 then notify(source, 'Acces refuse.') end
    return
  end

  if source == 0 then
    for index, camera in ipairs(cameras) do
      print(('[camera] %d. %s (%s)'):format(index, camera.label, camera.name))
    end
    return
  end

  local requested = args[1]
  if not requested then
    openCamera(source, cameras[1])
    return
  end
  openCamera(source, byName[requested])
end, false)

RegisterNetEvent('mlo_camera:server:request', function(cameraName)
  local source = source
  if not canUse(source) then return end
  openCamera(source, byName[tostring(cameraName)])
end)

`;

      const client = `local active = false
local activeCamera = 0

local function cleanup()
  if activeCamera ~= 0 then
    RenderScriptCams(false, false, 0, true, true)
    DestroyCam(activeCamera, false)
  end
  active = false
  activeCamera = 0
  ClearFocus()
end

RegisterNetEvent('mlo_camera:activate', function(camera, viewDistance, fov)
  if active then cleanup() end

  activeCamera = CreateCamWithParams(
    'DEFAULT_SCRIPTED_CAMERA',
    camera.x, camera.y, camera.z,
    camera.pitch, 0.0, camera.rotation,
    fov + 0.0,
    false,
    0
  )
  if activeCamera == 0 then return end

  SetCamFarClip(activeCamera, viewDistance + 0.0)
  SetCamActive(activeCamera, true)
  RenderScriptCams(true, true, 350, true, true)
  active = true

  CreateThread(function()
    while active do
      Wait(0)
      DisableAllControlActions(0)
      if IsControlJustPressed(0, 202) or IsControlJustPressed(0, 177) or IsControlJustPressed(0, 194) then
        cleanup()
        break
      end
    end
  end)
end)

RegisterCommand('cameraexit', function()
  if active then cleanup() end
end, false)

TriggerEvent('chat:addSuggestion', '/' .. Config.MloCameraNetwork.command, 'Ouvre une camera du reseau ${networkName}', {
  { name = 'camera', help = 'Nom ou numero de la camera' },
})
`;

      const fxmanifest = `fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name '${resource}'
description 'Reseau de cameras MLO genere par FiveM DevManager'
version '1.0.0'

shared_scripts {
  'mlo-camera-network.lua',
}

server_scripts {
  'server/cameras.lua',
}

client_scripts {
  'client/cameras.lua',
}
`;

      const readme = `# ${resource}

Reseau de cameras de securite : **${networkName}**.

## Installation

1. Ajoutez \`ensure ${resource}\` dans \`server.cfg\`.
2. Attribuez la permission ACE \`${permission}\` aux metiers ou grades autorises.
3. Adaptez les coordonnees et orientations dans la configuration.
4. Testez chaque camera en jeu.

## Commandes

- \`/${command}\` : ouvre la premiere camera.
- \`/${command} <nom|numero>\` : ouvre une camera precise.
- \`/cameraexit\` : quitte la camera.
- \`Echap\`, \`Retour\` ou \`Backspace\` quitte aussi la camera.

## Securite

- L'acces est verifie cote serveur avec la permission ACE.
- Le client recoit uniquement la camera demandee.
- Le serveur limite les changements de camera a un toutes les 750 ms.
- Ne remplacez pas la verification ACE par un simple bouton NUI.
`;

      return {
        data,
        lua: `function GetMloCamera(name)
  for _, camera in ipairs(Config.MloCameraNetwork.cameras) do
    if camera.name == name then return camera end
  end
  return nil
end
`,
        files: [
          file("fxmanifest.lua", fxmanifest, "lua"),
          file("server/cameras.lua", server, "lua"),
          file("client/cameras.lua", client, "lua"),
        ],
        readme,
        stats: [
          stat("Cameras", String(cameras.length), cameras.length ? "success" : "danger"),
          stat("Champ de vision", `${fov}°`),
          stat("Portee", `${viewDistance} m`),
        ],
        diagnostics,
      };
    },
  }),
  moduleTool({
    slug: "mlo-access-control",
    name: "Controle d'acces MLO",
    category: "mlo",
    description:
      "Genere un systeme de portes securisees avec permissions ACE, autorisations par licence en base et verification de distance serveur.",
    icon: "KeyRound",
    tags: ["mlo", "porte", "acces", "sql", "securite"],
    fields: [
      { name: "resourceName", label: "Ressource", type: "text", default: "fdm_mlo_access", required: true },
      { name: "roomsCsv", label: "Portes (name,label,model,x,y,z,heading,ace)", type: "textarea", rows: 7, default: DEFAULT_ROOMS, required: true },
      { name: "table", label: "Table SQL", type: "text", default: "mlo_access", required: true },
      { name: "maxDistance", label: "Distance d'interaction (m)", type: "number", default: 4, min: 1, max: 15 },
      { name: "adminAce", label: "Permission admin", type: "text", default: "fdm.mlo.access.admin" },
      { name: "command", label: "Commande joueur", type: "text", default: "door" },
    ],
    build: (input) => {
      const resource = safeSlug(str(input, "resourceName", "fdm_mlo_access"), "fdm_mlo_access");
      const table = sqlIdentifier(str(input, "table", "mlo_access"), "mlo_access");
      const maxDistance = Math.max(1, Math.min(15, num(input, "maxDistance", 4)));
      const adminAce = str(input, "adminAce", "fdm.mlo.access.admin").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80) || "fdm.mlo.access.admin";
      const command = safeSlug(str(input, "command", "door"), "door").replace(/_/g, "");
      const rooms: RoomEntry[] = rows(input, "roomsCsv", ["name", "label", "model", "x", "y", "z", "heading", "ace"]).map((row) => {
        const coords = coordParts(`${row.x || 0}, ${row.y || 0}, ${row.z || 0}`);
        return {
          name: safeSlug(row.name, "room"),
          label: row.label || row.name || "Piece",
          model: row.model || "v_ilev_aptdoor01",
          coords,
          heading: Number(row.heading) || 0,
          ace: (row.ace || "fdm.mlo.access").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80) || "fdm.mlo.access",
        };
      });
      const diagnostics: StudioDiagnostic[] = rooms.length === 0 ? [{ level: "error", message: "Aucune porte definie.", field: "roomsCsv" }] : [];
      const data = { resourceName: resource, table, maxDistance, adminAce, command, rooms };

      const schema = `CREATE TABLE IF NOT EXISTS ${table} (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  room VARCHAR(64) NOT NULL,
  identifier VARCHAR(80) NOT NULL,
  granted_by VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_mlo_access (room, identifier),
  INDEX idx_mlo_access_identifier (identifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

      const server = `local rooms = Config.MloAccessControl.rooms
local maxDistance = Config.MloAccessControl.maxDistance
local adminAce = Config.MloAccessControl.adminAce
local tableName = Config.MloAccessControl.table
local cooldowns = {}
local byName = {}

for _, room in ipairs(rooms) do
  byName[room.name] = room
end

local function getIdentifier(source)
  return GetPlayerIdentifierByType(source, 'license')
end

local function distanceTo(source, room)
  local ped = GetPlayerPed(source)
  if ped == 0 then return 9999 end
  local coords = GetEntityCoords(ped)
  return #(coords - vector3(room.coords.x, room.coords.y, room.coords.z))
end

local function hasDatabaseAccess(identifier, roomName)
  local row = MySQL.single.await(
    ('SELECT id FROM %s WHERE room = ? AND identifier = ? LIMIT 1'):format(tableName),
    { roomName, identifier }
  )
  return row ~= nil
end

local function hasAccess(source, room)
  local identifier = getIdentifier(source)
  if not identifier then return false end
  if IsPlayerAceAllowed(source, room.ace) then return true end
  return hasDatabaseAccess(identifier, room.name)
end

local function toggleDoor(source, room)
  local now = GetGameTimer()
  if cooldowns[source] and now - cooldowns[source] < 1000 then return end
  cooldowns[source] = now

  if distanceTo(source, room) > maxDistance then
    TriggerClientEvent('mlo_access:notify', source, 'Vous etes trop loin de la porte.')
    return
  end

  if not hasAccess(source, room) then
    TriggerClientEvent('mlo_access:notify', source, 'Acces refuse a ' .. room.label .. '.')
    return
  end

  TriggerClientEvent('mlo_access:toggle', source, room)
end

RegisterCommand(Config.MloAccessControl.command, function(source)
  if source == 0 then return end

  local ped = GetPlayerPed(source)
  local coords = GetEntityCoords(ped)
  local nearest = nil
  local nearestDistance = maxDistance + 1

  for _, room in ipairs(rooms) do
    local distance = #(coords - vector3(room.coords.x, room.coords.y, room.coords.z))
    if distance < nearestDistance then
      nearest = room
      nearestDistance = distance
    end
  end

  if not nearest then
    TriggerClientEvent('mlo_access:notify', source, 'Aucune porte a proximite.')
    return
  end

  toggleDoor(source, nearest)
end, false)

RegisterNetEvent('mlo_access:server:toggle', function(roomName)
  local source = source
  local room = byName[tostring(roomName)]
  if not room then return end
  toggleDoor(source, room)
end)

RegisterCommand('access', function(source, args)
  if source ~= 0 and not IsPlayerAceAllowed(source, adminAce) then
    return
  end

  local action = args[1]
  local roomName = args[2]
  local identifier = args[3]
  local room = byName[roomName]

  if action == 'list' then
    local rows = MySQL.query.await(('SELECT room, identifier, granted_by FROM %s ORDER BY room, identifier'):format(tableName)) or {}
    for _, row in ipairs(rows) do
      print(('[access] %s -> %s (par %s)'):format(row.room, row.identifier, row.granted_by))
    end
    return
  end

  if not room or not identifier or not identifier:match('^[A-Za-z0-9:_-]{3,80}$') then
    print('[access] usage : /access grant|revoke <piece> <licence>')
    return
  end

  if action == 'grant' then
    MySQL.insert.await(
      ('INSERT INTO %s (room, identifier, granted_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE granted_by = VALUES(granted_by)'):format(tableName),
      { room.name, identifier, source == 0 and 'console' or getIdentifier(source) or 'admin' }
    )
    print(('[access] acces accorde a %s pour %s.'):format(identifier, room.name))
  elseif action == 'revoke' then
    MySQL.query.await(
      ('DELETE FROM %s WHERE room = ? AND identifier = ?'):format(tableName),
      { room.name, identifier }
    )
    print(('[access] acces retire a %s pour %s.'):format(identifier, room.name))
  else
    print('[access] action inconnue : grant, revoke ou list.')
  end
end, false)

`;

      const client = `RegisterNetEvent('mlo_access:notify', function(message)
  TriggerEvent('chat:addMessage', { args = { 'Acces', tostring(message) } })
end)

RegisterNetEvent('mlo_access:toggle', function(room)
  local hash = GetHashKey(room.model)
  local door = GetClosestObjectOfType(room.coords.x, room.coords.y, room.coords.z, 2.0, hash, false, true, true)
  if door == 0 then
    TriggerEvent('chat:addMessage', { args = { 'Acces', 'Porte introuvable a proximite.' } })
    return
  end

  local locked = DoorSystemGetDoorState(door) ~= 0
  if locked then
    DoorSystemSetDoorState(door, 0, false, true)
    TriggerEvent('chat:addMessage', { args = { 'Acces', room.label .. ' deverrouillee.' } })
  else
    DoorSystemSetDoorState(door, 1, false, true)
    TriggerEvent('chat:addMessage', { args = { 'Acces', room.label .. ' verrouillee.' } })
  end
end)

TriggerEvent('chat:addSuggestion', '/' .. Config.MloAccessControl.command, 'Ouvre la porte la plus proche')
`;

      const fxmanifest = `fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name '${resource}'
description "Controle d'acces MLO genere par FiveM DevManager"
version '1.0.0'

dependencies {
  'oxmysql',
}

shared_scripts {
  'mlo-access-control.lua',
}

server_scripts {
  'server/access.lua',
}

client_scripts {
  'client/access.lua',
}
`;

      const readme = `# ${resource}

Controle d'acces pour ${rooms.length} porte(s) MLO.

## Installation

1. Importez \`schema.sql\` dans la base.
2. Placez la ressource apres \`oxmysql\`.
3. Verifiez les modeles de portes et les coordonnees.
4. Attribuez \`${adminAce}\` aux administrateurs.

## Commandes

- \`/${command}\` : ouvre ou ferme la porte la plus proche.
- \`/access grant <piece> <licence>\` : autorise une licence.
- \`/access revoke <piece> <licence>\` : retire une autorisation.
- \`/access list\` : liste les autorisations.

## Securite

- La permission ACE de la piece est verifiee cote serveur.
- Les autorisations SQL sont verifiees a chaque ouverture.
- La distance joueur/porte est revalidee cote serveur.
- Un delai de 1 seconde limite les ouvertures repetees.
- Les commandes admin utilisent une permission ACE distincte.
`;

      return {
        data,
        sql: schema,
        lua: `function GetAccessRoom(name)
  for _, room in ipairs(Config.MloAccessControl.rooms) do
    if room.name == name then return room end
  end
  return nil
end
`,
        files: [
          file("fxmanifest.lua", fxmanifest, "lua"),
          file("server/access.lua", server, "lua"),
          file("client/access.lua", client, "lua"),
        ],
        readme,
        stats: [
          stat("Portes", String(rooms.length), rooms.length ? "success" : "danger"),
          stat("Table", table),
          stat("Distance", `${maxDistance} m`),
        ],
        diagnostics,
      };
    },
  }),
  moduleTool({
    slug: "mlo-parking",
    name: "Parking MLO",
    category: "mlo",
    description:
      "Genere un parking avec places reservees en SQL, controle de distance, limite par joueur, marqueurs et commandes.",
    icon: "Warehouse",
    tags: ["mlo", "parking", "sql", "vehicule", "reservation"],
    fields: [
      { name: "resourceName", label: "Ressource", type: "text", default: "fdm_mlo_parking", required: true },
      { name: "lotName", label: "Nom du parking", type: "text", default: "Parking central" },
      { name: "spotsCsv", label: "Places (name,x,y,z,heading)", type: "textarea", rows: 7, default: DEFAULT_SPOTS, required: true },
      { name: "table", label: "Table SQL", type: "text", default: "mlo_parking", required: true },
      { name: "maxDistance", label: "Distance de reservation (m)", type: "number", default: 6, min: 1, max: 30 },
      { name: "maxPerPlayer", label: "Places par joueur", type: "number", default: 2, min: 1, max: 10 },
      { name: "adminAce", label: "Permission admin", type: "text", default: "fdm.mlo.parking.admin" },
    ],
    build: (input) => {
      const resource = safeSlug(str(input, "resourceName", "fdm_mlo_parking"), "fdm_mlo_parking");
      const lotName = str(input, "lotName", "Parking central");
      const table = sqlIdentifier(str(input, "table", "mlo_parking"), "mlo_parking");
      const maxDistance = Math.max(1, Math.min(30, num(input, "maxDistance", 6)));
      const maxPerPlayer = Math.max(1, Math.min(10, num(input, "maxPerPlayer", 2)));
      const adminAce = str(input, "adminAce", "fdm.mlo.parking.admin").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80) || "fdm.mlo.parking.admin";
      const spots: ParkingSpot[] = rows(input, "spotsCsv", ["name", "x", "y", "z", "heading"]).map((row) => ({
        name: row.name || "spot",
        x: Number(row.x) || 0,
        y: Number(row.y) || 0,
        z: Number(row.z) || 0,
        heading: Number(row.heading) || 0,
      }));
      const diagnostics: StudioDiagnostic[] = spots.length === 0 ? [{ level: "error", message: "Aucune place de parking definie.", field: "spotsCsv" }] : [];
      const data = { resourceName: resource, lotName, table, maxDistance, maxPerPlayer, adminAce, spots };

      const schema = `CREATE TABLE IF NOT EXISTS ${table} (
  spot VARCHAR(64) NOT NULL PRIMARY KEY,
  owner VARCHAR(80) NOT NULL,
  reserved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mlo_parking_owner (owner)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

      const server = `local spots = Config.MloParking.spots
local byName = {}
local maxDistance = Config.MloParking.maxDistance
local maxPerPlayer = Config.MloParking.maxPerPlayer
local tableName = Config.MloParking.table
local adminAce = Config.MloParking.adminAce
local cooldowns = {}

for _, spot in ipairs(spots) do
  byName[spot.name] = spot
end

local function getIdentifier(source)
  return GetPlayerIdentifierByType(source, 'license')
end

local function distanceTo(source, spot)
  local ped = GetPlayerPed(source)
  if ped == 0 then return 9999 end
  local coords = GetEntityCoords(ped)
  return #(coords - vector3(spot.x, spot.y, spot.z))
end

local function snapshot()
  local rows = MySQL.query.await(('SELECT spot, owner FROM %s'):format(tableName)) or {}
  local occupied = {}
  for _, row in ipairs(rows) do
    occupied[row.spot] = true
  end
  TriggerClientEvent('mlo_parking:sync', -1, occupied)
end

local function countFor(identifier)
  local count = MySQL.scalar.await(
    ('SELECT COUNT(*) FROM %s WHERE owner = ?'):format(tableName),
    { identifier }
  )
  return tonumber(count) or 0
end

local function reserve(source, spotName)
  local spot = byName[tostring(spotName)]
  if not spot then return false, 'Place inconnue.' end

  local identifier = getIdentifier(source)
  if not identifier then return false, 'Identifiant introuvable.' end

  if distanceTo(source, spot) > maxDistance then
    return false, 'Vous etes trop loin de cette place.'
  end

  local existing = MySQL.single.await(
    ('SELECT owner FROM %s WHERE spot = ?'):format(tableName),
    { spot.name }
  )
  if existing then
    if existing.owner == identifier then
      return false, 'Vous avez deja cette place.'
    end
    return false, 'Cette place est deja reservee.'
  end

  if countFor(identifier) >= maxPerPlayer then
    return false, 'Limite de places atteinte.'
  end

  MySQL.insert.await(
    ('INSERT INTO %s (spot, owner) VALUES (?, ?)'):format(tableName),
    { spot.name, identifier }
  )
  snapshot()
  return true, ('Place %s reservee.'):format(spot.name)
end

local function release(source, spotName)
  local identifier = getIdentifier(source)
  if not identifier then return false end

  local existing = MySQL.single.await(
    ('SELECT owner FROM %s WHERE spot = ?'):format(tableName),
    { tostring(spotName) }
  )
  if not existing then return false, 'Place libre.' end
  if existing.owner ~= identifier and not IsPlayerAceAllowed(source, adminAce) then
    return false, 'Cette place ne vous appartient pas.'
  end

  MySQL.query.await(
    ('DELETE FROM %s WHERE spot = ?'):format(tableName),
    { tostring(spotName) }
  )
  snapshot()
  return true, 'Place liberee.'
end

RegisterNetEvent('mlo_parking:server:reserve', function(spotName)
  local source = source
  local now = GetGameTimer()
  if cooldowns[source] and now - cooldowns[source] < 750 then return end
  cooldowns[source] = now

  local ok, message = reserve(source, spotName)
  TriggerClientEvent('mlo_parking:notify', source, message, ok)
end)

RegisterNetEvent('mlo_parking:server:release', function(spotName)
  local source = source
  local ok, message = release(source, spotName)
  TriggerClientEvent('mlo_parking:notify', source, message or 'Place liberee.', ok)
end)

RegisterNetEvent('mlo_parking:server:refresh', function()
  snapshot()
  local rows = MySQL.query.await(('SELECT spot, owner FROM %s'):format(tableName)) or {}
  local mine = {}
  local identifier = getIdentifier(source)
  for _, row in ipairs(rows) do
    if row.owner == identifier then mine[row.spot] = true end
  end
  TriggerClientEvent('mlo_parking:mine', source, mine)
end)

RegisterCommand('parkingadmin', function(source, args)
  if source ~= 0 and not IsPlayerAceAllowed(source, adminAce) then return end
  if args[1] ~= 'release' or not args[2] then
    print('[parking] usage : /parkingadmin release <place>')
    return
  end
  MySQL.query.await(
    ('DELETE FROM %s WHERE spot = ?'):format(tableName),
    { args[2] }
  )
  snapshot()
  print(('[parking] place %s liberee.'):format(args[2]))
end, false)

CreateThread(function()
  Wait(1000)
  snapshot()
end)
`;

      const client = `local occupied = {}
local mine = {}

local function notify(message, success)
  TriggerEvent('chat:addMessage', {
    args = { 'Parking', tostring(message) },
    color = success and { 80, 220, 140 } or { 240, 120, 120 },
  })
end

local function nearestSpot()
  local coords = GetEntityCoords(PlayerPedId())
  local nearest = nil
  local best = Config.MloParking.maxDistance + 1
  for _, spot in ipairs(Config.MloParking.spots) do
    local distance = #(coords - vector3(spot.x, spot.y, spot.z))
    if distance < best then
      best = distance
      nearest = spot
    end
  end
  return nearest
end

RegisterNetEvent('mlo_parking:sync', function(state)
  occupied = type(state) == 'table' and state or {}
end)

RegisterNetEvent('mlo_parking:mine', function(state)
  mine = type(state) == 'table' and state or {}
end)

RegisterNetEvent('mlo_parking:notify', function(message, success)
  notify(message, success)
end)

RegisterCommand('parking', function(_, args)
  if args[1] == 'release' then
    local spot = args[2] and args[2] or nil
    if not spot then
      for name in pairs(mine) do spot = name break end
    end
    if spot then
      TriggerServerEvent('mlo_parking:server:release', spot)
    else
      notify('Aucune place vous appartenant.', false)
    end
    return
  end

  local spot = nearestSpot()
  if not spot then
    notify('Aucune place a proximite.', false)
    return
  end
  TriggerServerEvent('mlo_parking:server:reserve', spot.name)
end, false)

RegisterCommand('parkinglist', function()
  TriggerServerEvent('mlo_parking:server:refresh')
  Wait(250)
  local lines = {}
  for _, spot in ipairs(Config.MloParking.spots) do
    lines[#lines + 1] = ('%s : %s'):format(spot.name, occupied[spot.name] and 'occupee' or 'libre')
  end
  notify(table.concat(lines, ' | '), true)
end, false)

CreateThread(function()
  while true do
    Wait(0)
    local coords = GetEntityCoords(PlayerPedId())
    for _, spot in ipairs(Config.MloParking.spots) do
      local distance = #(coords - vector3(spot.x, spot.y, spot.z))
      if distance < 35.0 then
        local color = occupied[spot.name] and 240 or 80
        DrawMarker(1, spot.x, spot.y, spot.z - 1.0, 0, 0, 0, 0, 0, 0, 2.2, 2.2, 0.35, color, 220, 255 - color, 160, false, false, 2, false, nil, nil, false)
        if distance < 6.0 then
          SetTextScale(0.35, 0.35)
          SetTextFont(4)
          SetTextCentre(true)
          SetTextEntry('STRING')
          AddTextComponentString(('%s · %s'):format(spot.name, occupied[spot.name] and 'Occupee' or 'Libre'))
          DrawText(spot.x, spot.y, spot.z + 0.2)
        end
      end
    end
  end
end)

TriggerEvent('chat:addSuggestion', '/parking', 'Reserve la place la plus proche (/parking release pour liberer)')
TriggerEvent('chat:addSuggestion', '/parkinglist', 'Affiche l etat des places')
`;

      const fxmanifest = `fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name '${resource}'
description 'Parking MLO genere par FiveM DevManager'
version '1.0.0'

dependencies {
  'oxmysql',
}

shared_scripts {
  'mlo-parking.lua',
}

server_scripts {
  'server/parking.lua',
}

client_scripts {
  'client/parking.lua',
}
`;

      const readme = `# ${resource}

Parking **${lotName}** avec ${spots.length} place(s) reserveables.

## Installation

1. Importez \`schema.sql\`.
2. Placez la ressource apres \`oxmysql\`.
3. Adaptez les coordonnees des places.
4. Attribuez \`${adminAce}\` aux administrateurs.

## Commandes

- \`/parking\` : reserve la place la plus proche.
- \`/parking release [place]\` : libere une place.
- \`/parkinglist\` : affiche l'etat des places.
- \`/parkingadmin release <place>\` : liberation administrative.

## Securite

- La distance est verifiee cote serveur.
- La limite de ${maxPerPlayer} place(s) par joueur est appliquee en base.
- Une place ne peut appartenir qu'a un seul joueur.
- Le client ne peut pas liberer une place qui ne lui appartient pas.
`;

      return {
        data,
        sql: schema,
        lua: `function GetParkingSpot(name)
  for _, spot in ipairs(Config.MloParking.spots) do
    if spot.name == name then return spot end
  end
  return nil
end
`,
        files: [
          file("fxmanifest.lua", fxmanifest, "lua"),
          file("server/parking.lua", server, "lua"),
          file("client/parking.lua", client, "lua"),
        ],
        readme,
        stats: [
          stat("Places", String(spots.length), spots.length ? "success" : "danger"),
          stat("Limite / joueur", String(maxPerPlayer)),
          stat("Table", table),
        ],
        diagnostics,
      };
    },
  }),
];
