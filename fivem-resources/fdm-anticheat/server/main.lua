--[[
    fdm-anticheat - agent serveur (v2)

    Detecte des comportements anormaux a partir des evenements serveur FiveM et
    les envoie au panel par lots. Mode rapport par defaut : aucune punition
    automatique, aucune annulation d'evenement, aucune injection cliente.

    Modules nommes comme Electron (antiExplosion, antiTeleport, antiNoclip...).
    Bypass par module : ACE fdm.anticheat.bypass.<module> ou Bypass.<module>.
    Bans persistants (bans.json), menu admin /fdmac, exports et evenements.
]]

local queue = {}
local bans = {}
local tempWhitelist = {}
local sending = false
local reportCounter = 0
local banCounter = 0
local lastReport = {}
local windows = {}
local lastPosition = {}
local retryBackoff = 0
local nextAttemptAt = 0
local nextPersistAt = 0
local lastError = nil
local disabledNoticeShown = false

local flush
local report
local banPlayerInternal
local kickPlayerInternal

-- ---------------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------------

local function log(message, ...)
  if Config.Debug then
    print(("[fdm-anticheat] " .. message):format(...))
  end
end

local function warn(message, ...)
  print(("[fdm-anticheat] " .. message):format(...))
end

local function isoNow()
  return os.date("!%Y-%m-%dT%H:%M:%SZ")
end

local function trimQueue()
  while #queue > Config.MaxQueue do
    table.remove(queue, 1)
  end
end

local function getIdentifiers(src)
  if src <= 0 then return {} end
  return GetPlayerIdentifiers(src) or {}
end

local function getLicense(src)
  if src <= 0 then return nil end
  local identifiers = getIdentifiers(src)
  for _, identifier in ipairs(identifiers) do
    if type(identifier) == "string" and identifier:sub(1, 8) == "license:" then
      return identifier
    end
  end
  return nil
end

local function getDiscord(src)
  if src <= 0 then return nil end
  local identifiers = getIdentifiers(src)
  for _, identifier in ipairs(identifiers) do
    if type(identifier) == "string" and identifier:sub(1, 8) == "discord:" then
      return identifier
    end
  end
  return nil
end

local function getIp(src)
  if src <= 0 then return nil end
  local endpoint = GetPlayerEndpoint(src)
  if type(endpoint) ~= "string" then return nil end
  local ip = endpoint:match("^([^:]+)")
  return ip
end

local function invokingResource()
  local ok, resource = pcall(GetInvokingResource)
  if ok then return resource end
  return nil
end

local function contains(list, value)
  for _, item in ipairs(list or {}) do
    if item == value then return true end
  end
  return false
end

local function isOn(moduleConfig)
  return moduleConfig ~= nil and moduleConfig.enabled ~= false
end

local function isExempt(src)
  if src <= 0 then return false end
  if IsPlayerAceAllowed(src, Config.ExemptAce) then return true end
  local license = getLicense(src)
  if not license then return false end
  for _, exempt in ipairs(Config.ExemptLicenses or {}) do
    if exempt == license then return true end
  end
  return false
end

local function isModuleBypassed(src, module)
  if src <= 0 then return false end
  if isExempt(src) then return true end
  if IsPlayerAceAllowed(src, "fdm.anticheat.bypass." .. module) then return true end
  if IsPlayerAceAllowed(src, "Bypass." .. module) then return true end
  local list = tempWhitelist[src]
  return list ~= nil and list[module] == true
end

local function isWhitelistedResource(moduleConfig, resource)
  if not resource then return false end
  for _, name in ipairs(moduleConfig.whitelistResources or {}) do
    if name == resource then return true end
  end
  return false
end

--- Compteur glissant par joueur et par detection.
local function bump(src, key, windowMs)
  local id = ("%d:%s"):format(src, key)
  local now = GetGameTimer()
  local entry = windows[id]
  if not entry or now - entry.startedAt > windowMs then
    entry = { startedAt = now, count = 0 }
    windows[id] = entry
  end
  entry.count = entry.count + 1
  return entry.count
end

-- ---------------------------------------------------------------------------
-- File persistante (survit a un redemarrage de la ressource)
-- ---------------------------------------------------------------------------

local function persistQueue(force)
  local now = os.time()
  if not force and now < nextPersistAt then return end
  nextPersistAt = now + math.max(1, math.floor(Config.PersistInterval / 1000))
  SaveResourceFile(GetCurrentResourceName(), Config.PersistFile, json.encode(queue), -1)
end

local function loadQueue()
  local raw = LoadResourceFile(GetCurrentResourceName(), Config.PersistFile)
  if not raw or raw == "" then return end

  local ok, decoded = pcall(json.decode, raw)
  if not ok or type(decoded) ~= "table" then
    warn("file persistante illisible, elle est ignoree")
    return
  end

  local restored = 0
  for _, event in ipairs(decoded) do
    if type(event) == "table" and type(event.eventId) == "string" and type(event.detection) == "string" then
      queue[#queue + 1] = event
      restored = restored + 1
    end
  end

  trimQueue()
  if restored > 0 then
    warn("%d evenement(s) restaure(s) depuis la file persistante", restored)
  end
end

loadQueue()

-- ---------------------------------------------------------------------------
-- Bans persistants
-- ---------------------------------------------------------------------------

local function loadBans()
  bans = {}
  local raw = LoadResourceFile(GetCurrentResourceName(), Config.BanFile)
  if not raw or raw == "" then return end

  local ok, decoded = pcall(json.decode, raw)
  if not ok or type(decoded) ~= "table" then
    warn("liste de bans illisible, elle est ignoree")
    return
  end

  for _, ban in ipairs(decoded) do
    if type(ban) == "table" and type(ban.banId) == "string" then
      bans[#bans + 1] = ban
    end
  end
end

local function saveBans()
  SaveResourceFile(GetCurrentResourceName(), Config.BanFile, json.encode(bans), -1)
end

local function banExpired(ban)
  local expiresAt = tonumber(ban.expiresAt) or 0
  return expiresAt > 0 and expiresAt <= os.time()
end

local function banMatches(ban, identifiers, ip, license, discord)
  if banExpired(ban) then return false end
  if license and ban.license == license then return true end
  if discord and ban.discord == discord then return true end
  if ip and ban.ip == ip then return true end
  for _, storedId in ipairs(ban.identifiers or {}) do
    for _, identifier in ipairs(identifiers or {}) do
      if storedId == identifier then return true end
    end
  end
  return false
end

local function findBanForIdentifiers(identifiers, ip, license, discord)
  for _, ban in ipairs(bans) do
    if banMatches(ban, identifiers, ip, license, discord) then return ban end
  end
  return nil
end

local function formatBanMessage(ban)
  local expiry = "permanent"
  if tonumber(ban.expiresAt) and tonumber(ban.expiresAt) > 0 then
    expiry = os.date("%d/%m/%Y %H:%M", tonumber(ban.expiresAt))
  end
  return ("Vous etes banni de ce serveur. Raison: %s. ID: %s. Expiration: %s. Contactez le staff pour faire appel."):format(
    ban.reason or "non precisee",
    ban.banId or "?",
    expiry
  )
end

local function createBan(src, reason, details, admin)
  banCounter = banCounter + 1
  local record = {
    banId = ("%d-%04d"):format(os.time(), banCounter),
    name = GetPlayerName(src) or "Inconnu",
    license = getLicense(src),
    discord = getDiscord(src),
    ip = getIp(src),
    identifiers = getIdentifiers(src),
    reason = reason or "Non precisee",
    details = details or "",
    admin = admin or "Console",
    createdAt = os.time(),
    expiresAt = 0,
  }
  bans[#bans + 1] = record
  saveBans()
  return record
end

banPlayerInternal = function(src, reason, details, automatic, overrideWhitelist, admin)
  src = tonumber(src) or 0
  if src <= 0 then return nil end
  if not overrideWhitelist and isExempt(src) then return nil end

  local record = createBan(src, reason, details, admin or (automatic and "Anticheat" or "Console"))
  DropPlayer(src, formatBanMessage(record))
  TriggerEvent("fdm-anticheat:playerBanned", src, record.reason, details, automatic == true)
  warn("joueur %s banni (%s)", record.name, record.banId)
  return record
end

kickPlayerInternal = function(src, reason, details, automatic, overrideWhitelist)
  src = tonumber(src) or 0
  if src <= 0 then return false end
  if not overrideWhitelist and isExempt(src) then return false end

  local message = reason or "Non precisee"
  DropPlayer(src, ("Expulse du serveur. Raison: %s"):format(message))
  TriggerEvent("fdm-anticheat:playerKicked", src, message, details)
  warn("joueur %s expulse (%s)", GetPlayerName(src) or tostring(src), message)
  return true
end

local function removeBanRecord(key)
  if not key or key == "" then return false end
  for index = #bans, 1, -1 do
    local ban = bans[index]
    if ban.banId == key or ban.license == key or contains(ban.identifiers, key) then
      table.remove(bans, index)
      saveBans()
      return true
    end
  end
  return false
end

loadBans()

-- ---------------------------------------------------------------------------
-- Punitions (desactivees par defaut : mode rapport)
-- ---------------------------------------------------------------------------

local function applyPunishment(module, src, detection, details)
  if not Config.Punishments.enabled then return end
  if src <= 0 then return end

  local moduleConfig = Config.Modules[module]
  local action = (moduleConfig and moduleConfig.action) or Config.Punishments.defaultAction or "report"
  if action == "kick" then
    kickPlayerInternal(src, "Anticheat: " .. detection, details, true, false)
  elseif action == "ban" then
    banPlayerInternal(src, "Anticheat: " .. detection, details, true, false)
  end
end

-- ---------------------------------------------------------------------------
-- Enregistrement des detections
-- ---------------------------------------------------------------------------

report = function(module, detection, category, severity, src, details, force)
  if not Config.Enabled then return end
  if Config.Endpoint == "" or Config.Token == "" then return end
  if src > 0 and isModuleBypassed(src, module) then return end

  local now = GetGameTimer()
  local throttleKey = ("%d:%s"):format(src, detection)
  local previous = lastReport[throttleKey]
  if not force and previous and now - previous < Config.ReportThrottle then return end
  lastReport[throttleKey] = now

  reportCounter = reportCounter + 1
  local payload = details or {}
  payload.module = module

  local event = {
    eventId = ("%d-%d-%d"):format(os.time(), now, reportCounter),
    detection = detection,
    category = category,
    severity = severity,
    playerSource = src > 0 and src or nil,
    playerNetId = src > 0 and src or nil,
    playerName = src > 0 and GetPlayerName(src) or nil,
    playerLicense = getLicense(src),
    details = payload,
    occurredAt = isoNow(),
  }

  queue[#queue + 1] = event
  trimQueue()
  persistQueue()
  log("detection %s (module %s, source %d, file %d)", detection, module, src, #queue)

  applyPunishment(module, src, detection, payload)

  if #queue >= Config.BatchSize then
    flush()
  end
end

local function warnPlayerInternal(src, reason, details, automatic, overrideWhitelist)
  src = tonumber(src) or 0
  if src <= 0 then return false end
  if not overrideWhitelist and isExempt(src) then return false end

  report("antiAdmin", "admin_warning", "custom", "MEDIUM", src, {
    reason = reason or "Avertissement staff",
    details = details or "",
    automatic = automatic == true,
  }, true)
  TriggerEvent("fdm-anticheat:playerWarned", src, reason, details, automatic == true)
  return true
end

-- ---------------------------------------------------------------------------
-- Envoi par lots (retry avec backoff exponentiel)
-- ---------------------------------------------------------------------------

flush = function()
  if sending or #queue == 0 then return end
  if Config.Endpoint == "" or Config.Token == "" then return end
  if os.time() < nextAttemptAt then return end

  sending = true
  local size = math.min(#queue, Config.BatchSize)
  local batch = {}
  for index = 1, size do
    batch[index] = table.remove(queue, 1)
  end

  local payload = json.encode({
    serverId = Config.ServerId,
    events = batch,
  })

  PerformHttpRequest(Config.Endpoint, function(status, body)
    sending = false
    status = tonumber(status) or 0

    if status >= 200 and status < 300 then
      retryBackoff = 0
      nextAttemptAt = 0
      lastError = nil
      persistQueue(true)
      log("lot envoye (%d evenement(s))", #batch)
      return
    end

    -- Remet le lot en tete de file pour ne perdre aucune preuve.
    for index = #batch, 1, -1 do
      table.insert(queue, 1, batch[index])
    end
    trimQueue()

    lastError = ("HTTP %s"):format(tostring(status))
    retryBackoff = retryBackoff == 0 and Config.RetryDelay or math.min(retryBackoff * 2, 60000)
    nextAttemptAt = os.time() + math.ceil(retryBackoff / 1000)
    persistQueue(true)
    warn("envoi impossible (%s), nouvel essai dans %d s", lastError, math.ceil(retryBackoff / 1000))
    log("reponse: %s", tostring(body))
  end, "POST", payload, {
    ["Content-Type"] = "application/json",
    ["Authorization"] = "Bearer " .. Config.Token,
    ["User-Agent"] = "fdm-anticheat/2.0",
  })
end

CreateThread(function()
  while true do
    Wait(Config.FlushInterval)
    flush()
  end
end)

-- Nettoyage periodique des compteurs pour eviter une fuite memoire.
CreateThread(function()
  while true do
    Wait(60000)
    local now = GetGameTimer()
    for key, entry in pairs(windows) do
      if now - entry.startedAt > 60000 then windows[key] = nil end
    end
    for key, at in pairs(lastReport) do
      if now - at > 60000 then lastReport[key] = nil end
    end
  end
end)

-- ---------------------------------------------------------------------------
-- Heartbeat
-- ---------------------------------------------------------------------------

local function heartbeatUrl()
  if Config.HeartbeatEndpoint ~= "" then return Config.HeartbeatEndpoint end
  local url = Config.Endpoint:gsub("/ingest$", "/heartbeat")
  if url == Config.Endpoint then
    url = Config.Endpoint:gsub("/ingest/$", "/heartbeat")
  end
  if url == Config.Endpoint then return nil end
  return url
end

local function sendHeartbeat()
  if not Config.Enabled then return end
  if Config.Endpoint == "" or Config.Token == "" then return end

  local url = heartbeatUrl()
  if not url then return end

  PerformHttpRequest(url, function(status)
    status = tonumber(status) or 0
    if status >= 200 and status < 300 then
      log("heartbeat envoye")
    else
      log("heartbeat refuse (HTTP %s)", tostring(status))
    end
  end, "POST", json.encode({
    serverId = Config.ServerId,
    version = Config.Version,
    resourceName = GetCurrentResourceName(),
    queueSize = #queue,
    playerCount = #GetPlayers(),
    detectionsTotal = reportCounter,
    lastError = lastError,
  }), {
    ["Content-Type"] = "application/json",
    ["Authorization"] = "Bearer " .. Config.Token,
    ["User-Agent"] = "fdm-anticheat/2.0",
  })
end

CreateThread(function()
  Wait(3000)
  sendHeartbeat()
  while true do
    Wait(Config.HeartbeatInterval)
    sendHeartbeat()
  end
end)

-- ---------------------------------------------------------------------------
-- antiExplosion
-- ---------------------------------------------------------------------------

AddEventHandler("explosionEvent", function(sender, data)
  local moduleConfig = Config.Modules.antiExplosion
  if not Config.Enabled or not isOn(moduleConfig) or sender <= 0 or not data then return end

  local count = bump(sender, "explosion", moduleConfig.windowMs)
  if count == moduleConfig.max then
    report("antiExplosion", "explosion_spam", "explosion", moduleConfig.severity, sender, {
      count = count,
      windowMs = moduleConfig.windowMs,
    })
  end

  local scale = tonumber(data.damageScale) or 0
  if scale > moduleConfig.maxDamageScale then
    report("antiExplosion", "explosion_abnormal_scale", "explosion", moduleConfig.severity, sender, {
      damageScale = scale,
      explosionType = data.explosionType,
    })
  end
end)

-- ---------------------------------------------------------------------------
-- antiProjectile
-- ---------------------------------------------------------------------------

AddEventHandler("startProjectileEvent", function(sender, data)
  local moduleConfig = Config.Modules.antiProjectile
  if not Config.Enabled or not isOn(moduleConfig) or sender <= 0 or not data then return end

  local count = bump(sender, "projectile", moduleConfig.windowMs)
  if count == moduleConfig.max then
    report("antiProjectile", "projectile_spam", "projectile", moduleConfig.severity, sender, {
      count = count,
      windowMs = moduleConfig.windowMs,
      weaponHash = data.weaponHash,
      projectileHash = data.projectileHash,
    })
  end
end)

-- ---------------------------------------------------------------------------
-- antiWeaponDamage / antiGodmode
-- ---------------------------------------------------------------------------

AddEventHandler("weaponDamageEvent", function(sender, data)
  if not Config.Enabled or sender <= 0 or not data then return end

  local damageModule = Config.Modules.antiWeaponDamage
  if isOn(damageModule) then
    local damage = tonumber(data.weaponDamage) or 0
    if damage > damageModule.maxDamage then
      report("antiWeaponDamage", "weapon_damage_anomaly", "weapon", damageModule.severity, sender, {
        weaponType = data.weaponType,
        weaponDamage = damage,
        willKill = data.willKill,
      })
    end

    local count = bump(sender, "weapon_hits", damageModule.windowMs)
    if count == damageModule.maxHits then
      report("antiWeaponDamage", "weapon_damage_spam", "weapon", damageModule.spamSeverity, sender, {
        count = count,
        windowMs = damageModule.windowMs,
      })
    end
  end

  local godModule = Config.Modules.antiGodmode
  if not isOn(godModule) then return end

  local damage = tonumber(data.weaponDamage) or 0

  if damage <= 0 and data.willKill == true then
    local count = bump(sender, "godmode_zero", godModule.windowMs)
    if count == godModule.minZeroHits then
      report("antiGodmode", "godmode_suspected", "weapon", godModule.severity, sender, {
        kind = "zero_damage",
        hits = count,
        weaponType = data.weaponType,
      })
    end
    return
  end

  if damage >= godModule.healthCheckDamage then
    local ped = GetPlayerPed(sender)
    if not ped or ped == 0 then return end
    local health = GetEntityHealth(ped)
    local armour = GetPedArmour(ped)

    CreateThread(function()
      Wait(godModule.healthCheckDelayMs)
      if not GetPlayerName(sender) then return end
      local currentPed = GetPlayerPed(sender)
      if not currentPed or currentPed == 0 then return end
      local currentHealth = GetEntityHealth(currentPed)
      if currentHealth <= 0 then return end

      if currentHealth >= health and GetPedArmour(currentPed) >= armour then
        local count = bump(sender, "godmode_health", godModule.windowMs)
        if count == godModule.minHealthChecks then
          report("antiGodmode", "godmode_suspected", "weapon", godModule.severity, sender, {
            kind = "damage_ignored",
            damage = damage,
            health = health,
            armour = armour,
          })
        end
      end
    end)
  end
end)

-- ---------------------------------------------------------------------------
-- antiIllegalWeapon (giveWeaponEvent)
-- ---------------------------------------------------------------------------

AddEventHandler("giveWeaponEvent", function(sender, data)
  local moduleConfig = Config.Modules.antiIllegalWeapon
  if not Config.Enabled or not isOn(moduleConfig) or sender <= 0 or not data then return end

  local resource = invokingResource()
  if isWhitelistedResource(moduleConfig, resource) then return end

  local hash = tonumber(data.weaponType or data.weaponHash or data.weapon or data.hash or 0) or 0
  if hash == 0 then return end

  local blocked = contains(moduleConfig.blockedWeapons, hash)
  local allowed = moduleConfig.allowedWeapons or {}
  local notAllowed = #allowed > 0 and not contains(allowed, hash)

  if blocked or notAllowed then
    report("antiIllegalWeapon", "illegal_weapon", "weapon", moduleConfig.severity, sender, {
      weaponHash = hash,
      source = resource or "client",
      blocked = blocked,
    })
  end
end)

-- ---------------------------------------------------------------------------
-- antiEntitySpam / antiVehicle / antiIllegalEntity (entityCreating)
-- ---------------------------------------------------------------------------

AddEventHandler("entityCreating", function(entity)
  if not Config.Enabled or not entity or entity == 0 then return end

  local owner = NetworkGetEntityOwner(entity)
  if not owner or owner <= 0 then return end

  local entityType = GetEntityType(entity)
  local model = GetEntityModel(entity)
  local resource = invokingResource()

  local spamModule = Config.Modules.antiEntitySpam
  if isOn(spamModule) and not isWhitelistedResource(spamModule, resource) then
    local count = bump(owner, "entity", spamModule.windowMs)
    if count == spamModule.max then
      report("antiEntitySpam", "entity_spam", "entity", spamModule.severity, owner, {
        count = count,
        windowMs = spamModule.windowMs,
        entityType = entityType,
        model = model,
      })
    end
  end

  local vehicleModule = Config.Modules.antiVehicle
  if isOn(vehicleModule) and entityType == 2 and not isWhitelistedResource(vehicleModule, resource) then
    local count = bump(owner, "vehicle", vehicleModule.windowMs)
    if count == vehicleModule.max then
      report("antiVehicle", "vehicle_spawn_spam", "entity", vehicleModule.severity, owner, {
        count = count,
        windowMs = vehicleModule.windowMs,
        model = model,
      })
    end
  end

  local illegalModule = Config.Modules.antiIllegalEntity
  if isOn(illegalModule) and not isWhitelistedResource(illegalModule, resource) then
    if contains(illegalModule.blockedModels, model) then
      report("antiIllegalEntity", "illegal_entity", "entity", illegalModule.severity, owner, {
        model = model,
        entityType = entityType,
        source = resource or "client",
      })
    end
  end
end)

-- ---------------------------------------------------------------------------
-- antiClearTasks / antiPTFX / antiSyncedScene / antiFire
-- ---------------------------------------------------------------------------

AddEventHandler("clearPedTasksEvent", function(sender, data)
  local moduleConfig = Config.Modules.antiClearTasks
  if not Config.Enabled or not isOn(moduleConfig) or sender <= 0 then return end
  local count = bump(sender, "clear_tasks", moduleConfig.windowMs)
  if count == moduleConfig.max then
    report("antiClearTasks", "clear_tasks_spam", "event", moduleConfig.severity, sender, {
      count = count,
      windowMs = moduleConfig.windowMs,
    })
  end
end)

AddEventHandler("ptfxEvent", function(sender, data)
  local moduleConfig = Config.Modules.antiPTFX
  if not Config.Enabled or not isOn(moduleConfig) or sender <= 0 then return end
  local count = bump(sender, "ptfx", moduleConfig.windowMs)
  if count == moduleConfig.max then
    report("antiPTFX", "ptfx_spam", "event", moduleConfig.severity, sender, {
      count = count,
      windowMs = moduleConfig.windowMs,
      assetHash = data and data.assetHash,
      effectHash = data and data.effectHash,
    })
  end
end)

AddEventHandler("startNetworkSyncedSceneEvent", function(sender, data)
  local moduleConfig = Config.Modules.antiSyncedScene
  if not Config.Enabled or not isOn(moduleConfig) or sender <= 0 then return end
  local count = bump(sender, "synced_scene", moduleConfig.windowMs)
  if count == moduleConfig.max then
    report("antiSyncedScene", "synced_scene_spam", "event", moduleConfig.severity, sender, {
      count = count,
      windowMs = moduleConfig.windowMs,
    })
  end
end)

AddEventHandler("fireEvent", function(sender, data)
  local moduleConfig = Config.Modules.antiFire
  if not Config.Enabled or not isOn(moduleConfig) or sender <= 0 then return end
  local count = bump(sender, "fire", moduleConfig.windowMs)
  if count == moduleConfig.max then
    report("antiFire", "fire_spam", "event", moduleConfig.severity, sender, {
      count = count,
      windowMs = moduleConfig.windowMs,
    })
  end
end)

-- ---------------------------------------------------------------------------
-- Mouvement : antiTeleport / antiSpeed / antiNoclip / antiSuperJump
-- ---------------------------------------------------------------------------

CreateThread(function()
  while true do
    Wait(Config.MovementCheckInterval)
    if Config.Enabled then
      local now = GetGameTimer()
      for _, playerId in ipairs(GetPlayers()) do
        local src = tonumber(playerId)
        local ped = GetPlayerPed(src)
        if src and ped and ped ~= 0 and DoesEntityExist(ped) then
          local coords = GetEntityCoords(ped)
          local speed = GetEntitySpeed(ped) * 3.6
          local velocity = GetEntityVelocity(ped)
          local verticalSpeed = velocity and velocity.z or 0
          local inVehicle = GetVehiclePedIsIn(ped, false) ~= 0

          local speedModule = Config.Modules.antiSpeed
          if isOn(speedModule) then
            if inVehicle and speed > speedModule.maxVehicleKmh then
              report("antiSpeed", "speed_anomaly", "movement", speedModule.severity, src, {
                speedKmh = math.floor(speed),
                inVehicle = true,
              })
            elseif not inVehicle and speed > speedModule.maxFootKmh then
              report("antiSpeed", "speed_anomaly", "movement", speedModule.severity, src, {
                speedKmh = math.floor(speed),
                inVehicle = false,
              })
            end
          end

          local noclipModule = Config.Modules.antiNoclip
          if isOn(noclipModule) and not inVehicle then
            if verticalSpeed > noclipModule.maxUpwardSpeed or speed > noclipModule.maxFootKmh then
              report("antiNoclip", "noclip_suspected", "movement", noclipModule.severity, src, {
                speedKmh = math.floor(speed),
                verticalSpeed = math.floor(verticalSpeed),
              })
            end
          end

          local jumpModule = Config.Modules.antiSuperJump
          if isOn(jumpModule) and not inVehicle then
            local noclipLimit = (Config.Modules.antiNoclip and Config.Modules.antiNoclip.maxUpwardSpeed) or 25
            if verticalSpeed > jumpModule.maxUpwardSpeed and verticalSpeed <= noclipLimit then
              report("antiSuperJump", "superjump_suspected", "movement", jumpModule.severity, src, {
                verticalSpeed = math.floor(verticalSpeed),
              })
            end
          end

          local teleportModule = Config.Modules.antiTeleport
          if isOn(teleportModule) then
            local previous = lastPosition[src]
            if previous then
              local distance = #(coords - previous.coords)
              local limit = inVehicle and teleportModule.maxDistanceVehicle or teleportModule.maxDistanceFoot
              if distance > limit then
                report("antiTeleport", "teleport_anomaly", "movement", teleportModule.severity, src, {
                  distance = math.floor(distance),
                  elapsedMs = now - previous.at,
                  inVehicle = inVehicle,
                  fromX = previous.coords.x,
                  fromY = previous.coords.y,
                  fromZ = previous.coords.z,
                  toX = coords.x,
                  toY = coords.y,
                  toZ = coords.z,
                })
              end
            end
          end

          lastPosition[src] = { coords = coords, at = now }
        end
      end
    end
  end
end)

AddEventHandler("playerDropped", function()
  local src = source
  lastPosition[src] = nil
  tempWhitelist[src] = nil
  for key in pairs(windows) do
    if key:sub(1, #tostring(src) + 1) == tostring(src) .. ":" then
      windows[key] = nil
    end
  end
end)

-- ---------------------------------------------------------------------------
-- Controle des bans a la connexion
-- ---------------------------------------------------------------------------

AddEventHandler("playerConnecting", function(name, setKickReason, deferrals)
  if #bans == 0 then return end
  deferrals.defer()
  local src = source

  CreateThread(function()
    Wait(100)
    deferrals.update("Verification de la liste des bans...")

    local identifiers = GetPlayerIdentifiers(src) or {}
    local license, discord
    for _, identifier in ipairs(identifiers) do
      if identifier:sub(1, 8) == "license:" then license = identifier end
      if identifier:sub(1, 8) == "discord:" then discord = identifier end
    end

    local ban = findBanForIdentifiers(identifiers, getIp(src), license, discord)
    if ban then
      deferrals.done(formatBanMessage(ban))
      return
    end
    deferrals.done()
  end)
end)

-- ---------------------------------------------------------------------------
-- Menu admin / commandes
-- ---------------------------------------------------------------------------

local function reply(src, message)
  if src == 0 then
    print("[fdm-anticheat] " .. message)
  else
    TriggerClientEvent("chat:addMessage", src, {
      color = { 255, 180, 0 },
      args = { "[fdm-anticheat]", message },
    })
  end
end

local function targetFromArgs(src, args)
  local target = tonumber(args[2])
  if not target or target <= 0 then
    reply(src, "Joueur introuvable. Utilisez /fdmac players.")
    return nil
  end
  if not GetPlayerName(target) then
    reply(src, "Ce joueur n'est pas connecte.")
    return nil
  end
  return target
end

RegisterCommand("fdmac", function(src, args)
  if src ~= 0 and not IsPlayerAceAllowed(src, Config.AdminAce) then
    return
  end

  local sub = args[1] or "status"

  if sub == "players" then
    local players = GetPlayers()
    reply(src, ("%d joueur(s) en ligne"):format(#players))
    for _, playerId in ipairs(players) do
      local target = tonumber(playerId)
      local ped = GetPlayerPed(target)
      local health = (ped and ped ~= 0) and GetEntityHealth(ped) or 0
      reply(src, ("#%d %s | %s | vie %d | ping %d"):format(
        target,
        GetPlayerName(target) or "?",
        getLicense(target) or "sans licence",
        health,
        GetPlayerPing(target) or 0
      ))
    end
    return
  end

  if sub == "bans" then
    reply(src, ("%d ban(s) enregistre(s)"):format(#bans))
    for _, ban in ipairs(bans) do
      local expiry = (tonumber(ban.expiresAt) or 0) > 0 and os.date("%d/%m/%Y %H:%M", tonumber(ban.expiresAt)) or "permanent"
      reply(src, ("%s | %s | %s | %s"):format(ban.banId or "?", ban.name or "?", ban.reason or "?", expiry))
    end
    return
  end

  if sub == "ban" then
    local target = targetFromArgs(src, args)
    if not target then return end
    local reason = table.concat(args, " ", 3)
    if reason == "" then reason = "Non precisee" end
    local admin = src > 0 and GetPlayerName(src) or "Console"
    local record = banPlayerInternal(target, reason, "Commande admin", false, true, admin)
    if record then
      reply(src, ("%s banni (%s)."):format(record.name, record.banId))
    else
      reply(src, "Ban impossible (joueur exempte ou invalide).")
    end
    return
  end

  if sub == "unban" then
    local key = args[2]
    if not key then
      reply(src, "Usage: /fdmac unban <banId|license>")
      return
    end
    if removeBanRecord(key) then
      reply(src, "Ban supprime.")
    else
      reply(src, "Ban introuvable.")
    end
    return
  end

  if sub == "kick" then
    local target = targetFromArgs(src, args)
    if not target then return end
    local reason = table.concat(args, " ", 3)
    if reason == "" then reason = "Non precisee" end
    if kickPlayerInternal(target, reason, "Commande admin", false, true) then
      reply(src, "Joueur expulse.")
    else
      reply(src, "Expulsion impossible (joueur exempte ou invalide).")
    end
    return
  end

  if sub == "warn" then
    local target = targetFromArgs(src, args)
    if not target then return end
    local reason = table.concat(args, " ", 3)
    if reason == "" then reason = "Avertissement staff" end
    warnPlayerInternal(target, reason, "Commande admin", false, true)
    reply(src, "Avertissement enregistre.")
    return
  end

  if sub == "whitelist" or sub == "unwhitelist" then
    local target = targetFromArgs(src, args)
    if not target then return end
    local module = args[3]
    if not module or module == "" then
      reply(src, "Usage: /fdmac whitelist <id> <module>")
      return
    end
    tempWhitelist[target] = tempWhitelist[target] or {}
    if sub == "whitelist" then
      tempWhitelist[target][module] = true
      reply(src, ("Module %s ignore pour #%d jusqu'a sa deconnexion."):format(module, target))
    else
      tempWhitelist[target][module] = nil
      reply(src, ("Module %s reactive pour #%d."):format(module, target))
    end
    return
  end

  if sub == "test" then
    report("antiAdmin", "custom", "custom", "LOW", 0, {
      test = true,
      message = "Evenement de test fdm-anticheat",
    }, true)
    reply(src, "Evenement de test en file.")
    return
  end

  if sub == "help" then
    reply(src, "Commandes: status, players, bans, ban <id> <raison>, unban <banId|license>, kick <id> <raison>, warn <id> <raison>, whitelist <id> <module>, unwhitelist <id> <module>, test")
    return
  end

  local enabledModules = 0
  for _, moduleConfig in pairs(Config.Modules) do
    if isOn(moduleConfig) then enabledModules = enabledModules + 1 end
  end

  reply(src, "---- etat ----")
  reply(src, ("version: %s"):format(Config.Version))
  reply(src, ("actif: %s"):format(tostring(Config.Enabled)))
  reply(src, ("endpoint configure: %s"):format(Config.Endpoint ~= "" and "oui" or "non"))
  reply(src, ("token configure: %s"):format(Config.Token ~= "" and "oui" or "non"))
  reply(src, ("heartbeat configure: %s"):format(heartbeatUrl() and "oui" or "non"))
  reply(src, ("modules actifs: %d"):format(enabledModules))
  reply(src, ("punitions auto: %s"):format(Config.Punishments.enabled and "oui" or "non (mode rapport)"))
  reply(src, ("file d'envoi: %d / %d"):format(#queue, Config.MaxQueue))
  reply(src, ("bans: %d"):format(#bans))
  reply(src, ("prochain essai dans: %d s"):format(math.max(0, nextAttemptAt - os.time())))
  reply(src, ("derniere erreur: %s"):format(tostring(lastError)))
  reply(src, "----------------")
end, true)

-- ---------------------------------------------------------------------------
-- Exports (compatibles avec les integrations de type Electron)
-- ---------------------------------------------------------------------------

exports("banPlayer", function(src, reason, details, overrideWhitelist)
  return banPlayerInternal(src, reason, details, false, overrideWhitelist == true) ~= nil
end)

exports("kickPlayer", function(src, reason, details, overrideWhitelist)
  return kickPlayerInternal(src, reason, details, false, overrideWhitelist == true)
end)

exports("warnPlayer", function(src, reason, details, overrideWhitelist)
  return warnPlayerInternal(src, reason, details, false, overrideWhitelist == true)
end)

exports("removeBan", function(banId)
  return removeBanRecord(banId)
end)

exports("getBanInfo", function(banId)
  for _, ban in ipairs(bans) do
    if ban.banId == banId then return ban end
  end
  return nil
end)

exports("getPlayerBans", function(identifiers)
  local values = {}
  if type(identifiers) == "table" then
    for _, value in pairs(identifiers) do
      if type(value) == "string" then values[#values + 1] = value end
    end
  end

  local found = {}
  for _, ban in ipairs(bans) do
    local match = false
    for _, value in ipairs(values) do
      if ban.license == value or ban.discord == value or contains(ban.identifiers, value) then
        match = true
        break
      end
    end
    if match then found[#found + 1] = ban end
  end
  return found
end)

exports("tempWhitelistPlayer", function(src, module)
  src = tonumber(src) or 0
  if src <= 0 or not module or module == "" then return false end
  tempWhitelist[src] = tempWhitelist[src] or {}
  tempWhitelist[src][module] = true
  return true
end)

exports("tempUnWhitelistPlayer", function(src, module)
  src = tonumber(src) or 0
  if src <= 0 or not module then return false end
  local list = tempWhitelist[src]
  if not list then return false end
  list[module] = nil
  return true
end)

exports("getVersion", function()
  return Config.Version
end)

-- ---------------------------------------------------------------------------
-- Demarrage / arret
-- ---------------------------------------------------------------------------

AddEventHandler("onResourceStart", function(resource)
  if resource ~= GetCurrentResourceName() then return end

  if Config.Endpoint == "" or Config.Token == "" then
    if not disabledNoticeShown then
      disabledNoticeShown = true
      warn("endpoint ou token manquant : ingestion desactivee (voir server.cfg)")
    end
    return
  end

  warn("agent actif (serveur %s, mode %s, v%s)", Config.ServerId, Config.Punishments.enabled and "punitions" or "rapport", Config.Version)
end)

AddEventHandler("onResourceStop", function(resource)
  if resource ~= GetCurrentResourceName() then return end
  persistQueue(true)
  saveBans()
end)
