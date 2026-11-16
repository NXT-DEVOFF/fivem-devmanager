--[[
    fdm-anticheat - configuration (v2)

    Toutes les valeurs sensibles viennent de convars (server.cfg), jamais du client.
    Mode rapport par defaut : aucune punition automatique. Les modules peuvent
    recevoir une action ('report' | 'kick' | 'ban'), mais Config.Punishments.enabled
    doit etre passe a true pour les appliquer.
]]

Config = {}

Config.Version = '2.0.0'

-- Activation generale de l'agent.
Config.Enabled = GetConvar('fdm_anticheat_enabled', 'true') == 'true'

-- Endpoint et token d'ingestion (server.cfg). Si l'un des deux est vide,
-- la ressource reste silencieuse et n'envoie rien.
Config.Endpoint = GetConvar('fdm_anticheat_endpoint', '')
Config.Token = GetConvar('fdm_anticheat_token', '')
Config.ServerId = GetConvar('fdm_anticheat_server_id', 'fivem')

-- Heartbeat : permet au panel de savoir si l'agent tourne, meme sans alerte.
Config.HeartbeatEndpoint = GetConvar('fdm_anticheat_heartbeat_endpoint', '')
Config.HeartbeatInterval = 60000

-- Journalisation locale (n'affiche jamais le token).
Config.Debug = GetConvar('fdm_anticheat_debug', 'false') == 'true'

-- File d'envoi.
Config.BatchSize = 25
Config.FlushInterval = tonumber(GetConvar('fdm_anticheat_flush_interval', '5000')) or 5000
if Config.FlushInterval < 1000 then Config.FlushInterval = 1000 end
if Config.FlushInterval > 60000 then Config.FlushInterval = 60000 end
Config.MaxQueue = 500
Config.RetryDelay = 5000
Config.ReportThrottle = 5000 -- meme joueur + meme detection : 1 rapport / 5 s

-- File persistante et liste de bans (dans le dossier de la ressource).
Config.PersistFile = 'queue.json'
Config.PersistInterval = 3000
Config.BanFile = 'bans.json'

-- Exemptions : ACE globale, ACE par module (compatible Electron) et licences.
Config.AdminAce = 'fdm.anticheat.admin'
Config.ExemptAce = 'fdm.anticheat.exempt'
Config.ExemptLicenses = {
  -- 'license:1a2b3c4d5e6f...',
}

-- Punitions : desactivees = mode rapport strict (recommande au depart).
Config.Punishments = {
  enabled = false,
  defaultAction = 'report', -- 'report' | 'kick' | 'ban'
}

-- Controle des deplacements.
Config.MovementCheckInterval = 1000

--[[
    Modules de detection.

    Chaque module peut etre exclu par joueur avec :
      add_ace identifier.license:xxxx fdm.anticheat.bypass.antiNoclip allow
    ou, compatible Electron :
      add_ace identifier.license:xxxx Bypass.antiNoclip allow

    action : 'report' (defaut), 'kick' ou 'ban' (necessite Config.Punishments.enabled).
    severity : 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'.
]]
Config.Modules = {
  antiExplosion = {
    enabled = true,
    action = 'report',
    severity = 'HIGH',
    windowMs = 10000,
    max = 12,
    maxDamageScale = 2.5,
  },
  antiProjectile = {
    enabled = true,
    action = 'report',
    severity = 'MEDIUM',
    windowMs = 10000,
    max = 20,
  },
  antiEntitySpam = {
    enabled = true,
    action = 'report',
    severity = 'MEDIUM',
    windowMs = 10000,
    max = 40,
    whitelistResources = {},
  },
  antiVehicle = {
    enabled = true,
    action = 'report',
    severity = 'HIGH',
    windowMs = 10000,
    max = 15,
    whitelistResources = {},
  },
  antiWeaponDamage = {
    enabled = true,
    action = 'report',
    severity = 'MEDIUM',
    maxDamage = 350,
    windowMs = 10000,
    maxHits = 40,
    spamSeverity = 'MEDIUM',
  },
  antiGodmode = {
    enabled = true,
    action = 'report',
    severity = 'CRITICAL',
    windowMs = 10000,
    minZeroHits = 3,
    healthCheckDamage = 60,
    healthCheckDelayMs = 400,
    minHealthChecks = 2,
  },
  antiTeleport = {
    enabled = true,
    action = 'report',
    severity = 'HIGH',
    maxDistanceFoot = 300.0,
    maxDistanceVehicle = 900.0,
  },
  antiSpeed = {
    enabled = true,
    action = 'report',
    severity = 'MEDIUM',
    maxFootKmh = 80,
    maxVehicleKmh = 400,
  },
  antiNoclip = {
    enabled = true,
    action = 'report',
    severity = 'HIGH',
    maxUpwardSpeed = 25.0,
    maxFootKmh = 250,
  },
  antiSuperJump = {
    enabled = true,
    action = 'report',
    severity = 'MEDIUM',
    maxUpwardSpeed = 12.0,
  },
  antiIllegalWeapon = {
    enabled = true,
    action = 'report',
    severity = 'HIGH',
    -- Hashes JOAAT (nombres). Vide = aucun blocage.
    blockedWeapons = {},
    -- Si non vide, toute arme absente de la liste est signalee.
    allowedWeapons = {},
    whitelistResources = {},
  },
  antiIllegalEntity = {
    enabled = true,
    action = 'report',
    severity = 'HIGH',
    -- Hashes de modeles (vehicules, peds, objets). Vide = aucun blocage.
    blockedModels = {},
    whitelistResources = {},
  },
  antiClearTasks = {
    enabled = true,
    action = 'report',
    severity = 'MEDIUM',
    windowMs = 10000,
    max = 10,
  },
  antiPTFX = {
    enabled = true,
    action = 'report',
    severity = 'MEDIUM',
    windowMs = 10000,
    max = 15,
  },
  antiSyncedScene = {
    enabled = true,
    action = 'report',
    severity = 'MEDIUM',
    windowMs = 10000,
    max = 10,
  },
  antiFire = {
    enabled = true,
    action = 'report',
    severity = 'MEDIUM',
    windowMs = 10000,
    max = 15,
  },
}
